import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  realpathSync,
  rmdirSync,
  unlinkSync,
} from "node:fs";
import { createServer } from "node:net";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import { createInterface } from "node:readline/promises";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { verifyContract } from "./smoke.mjs";

const root = realpathSync(fileURLToPath(new URL("../../", import.meta.url)));
const frontend = join(root, "frontend");
const apiOrigin = "http://127.0.0.1:18099";
const webOrigin = "http://127.0.0.1:15199";
const hold = process.argv.slice(2).includes("--hold");
const auth = process.argv.slice(2).includes("--auth");
const allowedArgs = new Set(["--hold", "--auth"]);
const allowedEnv =
  /^(path|pathext|systemroot|systemdrive|windir|comspec|home|homedrive|homepath|userprofile|appdata|localappdata|programdata|programfiles(?:\(x86\))?|programw6432|temp|tmp|tmpdir|lang)$/i;
const hostEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => allowedEnv.test(key)),
);
const project = `reservation-integration-${randomBytes(6).toString("hex")}`;
const credentials = {
  MYSQL_DATABASE: "reservation_integration",
  MYSQL_USER: "reservation_integration",
  MYSQL_PASSWORD: randomBytes(24).toString("hex"),
  MYSQL_ROOT_PASSWORD: randomBytes(24).toString("hex"),
};
const composeArgs = [
  "compose",
  "--project-name",
  project,
  "--env-file",
  join(root, ".env_sample"),
  "--file",
  join(root, "infra/integration/compose.yaml"),
];
const children = [];
let scratch;
let started = false;

function docker(args, options = {}) {
  const result = spawnSync("docker", args, {
    cwd: root,
    env: { ...hostEnv, ...credentials },
    encoding: "utf8",
    timeout: 180_000,
    windowsHide: true,
    ...options,
  });
  if (result.status !== 0) {
    let detail = (result.stderr ?? "").trim();
    for (const key of ["MYSQL_PASSWORD", "MYSQL_ROOT_PASSWORD"])
      detail = detail.replaceAll(credentials[key], "[redacted]");
    // SQL errors can include input values; report only the Docker exit status for those.
    if (options.input) detail = "";
    throw new Error(
      `Docker ${args[0]} failed (${result.error?.code ?? result.status})${detail ? ": " + detail.slice(-500) : ""}`,
    );
  }
  return result.stdout.trim();
}

function compose(args, options) {
  return docker([...composeArgs, ...args], options);
}

function sql(statement) {
  return compose(
    [
      "exec",
      "-T",
      "mysql",
      "sh",
      "-c",
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root -N -B "$MYSQL_DATABASE"',
    ],
    { input: statement },
  );
}

function seedLoginCode(code, memberId, ttlMs) {
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(code) ||
    !Number.isSafeInteger(memberId) ||
    memberId <= 0 ||
    ![250, 30_000].includes(ttlMs)
  )
    throw new Error("Invalid isolated login code fixture");
  const args = [
    "SET",
    "oauth2:login-code:" + code,
    memberId + ":USER",
    "PX",
    String(ttlMs),
  ];
  const input =
    "*5\r\n" +
    args.map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join("");
  const result = compose(
    ["exec", "-T", "redis", "redis-cli", "--pipe", "--pipe-timeout", "5"],
    { input },
  );
  if (!result.includes("errors: 0, replies: 1"))
    throw new Error("Could not seed an isolated Redis code");
}

function launch(command, args, cwd, env, name) {
  const file = openSync(join(scratch, `${name}.log`), "wx");
  try {
    const child = spawn(command, args, {
      cwd,
      env: { ...hostEnv, ...env },
      stdio: ["ignore", file, file],
      windowsHide: true,
    });
    const stopped = new Promise((resolve) => {
      child.once("error", resolve);
      child.once("exit", resolve);
    });
    children.push({ child, stopped });
    return child;
  } finally {
    closeSync(file);
  }
}

async function ready(child, url) {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null)
      throw new Error("Application process exited before readiness");
    const response = await fetch(url, {
      signal: AbortSignal.timeout(2000),
    }).catch(() => null);
    if (response?.ok) {
      await response.body?.cancel();
      return;
    }
    await response?.body?.cancel();
    await delay(1000);
  }
  throw new Error("Application readiness timed out");
}

async function freePort(port) {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", () =>
      reject(new Error(`Port ${port} is unavailable`)),
    );
    listener.listen(port, "127.0.0.1", () => listener.close(resolve));
  });
}

async function removeDirectory(path) {
  for (let attempt = 0; ; attempt++) {
    try {
      rmdirSync(path);
      return;
    } catch (error) {
      // Windows may release a stopped process's working directory asynchronously.
      if (!["EBUSY", "EPERM"].includes(error.code) || attempt >= 20)
        throw error;
      await delay(250);
    }
  }
}

function inside(parent, path) {
  const pathFromParent = relative(parent, path);
  return (
    pathFromParent &&
    !isAbsolute(pathFromParent) &&
    !pathFromParent.startsWith("..")
  );
}

let passed = false;
try {
  if (process.argv.slice(2).some((arg) => !allowedArgs.has(arg)))
    throw new Error(
      "Usage: node scripts/integration/run.mjs [--auth] [--hold]",
    );
  const fixturePassword = process.env.INTEGRATION_FIXTURE_PASSWORD || undefined;
  const passwordBytes = Buffer.byteLength(fixturePassword ?? "");
  if (fixturePassword && (!hold || passwordBytes > 72 || passwordBytes < 12))
    throw new Error("Manual fixture password requires --hold and 12–72 bytes");
  const java = spawnSync("java", ["-XshowSettings:properties", "-version"], {
    env: hostEnv,
    encoding: "utf8",
    windowsHide: true,
    timeout: 15_000,
  });
  const javaHome = java.stderr?.match(/^\s*java\.home = (.+)$/m)?.[1]?.trim();
  if (
    java.status !== 0 ||
    !javaHome ||
    !/version "21(?:\.|")/.test(java.stderr)
  )
    throw new Error("Java 21 must be on PATH");
  const javaExecutable = join(
    javaHome,
    "bin",
    process.platform === "win32" ? "java.exe" : "java",
  );
  const jars = join(root, "backend/build/libs");
  const artifacts = readdirSync(jars).filter(
    (name) => name.endsWith(".jar") && !name.endsWith("-plain.jar"),
  );
  if (artifacts.length !== 1)
    throw new Error(
      "Build exactly one Boot JAR with the checked-in Gradle Wrapper",
    );
  const endpoint = docker([
    "context",
    "inspect",
    "--format",
    "{{.Endpoints.docker.Host}}",
  ]);
  if (!/^(npipe:\/\/|unix:\/\/)/.test(endpoint))
    throw new Error(
      "A local Docker daemon is required; remote contexts are refused",
    );
  if (
    docker([
      "ps",
      "-aq",
      "--filter",
      `label=com.docker.compose.project=${project}`,
    ]) ||
    docker([
      "volume",
      "ls",
      "-q",
      "--filter",
      `label=com.docker.compose.project=${project}`,
    ]) ||
    docker([
      "network",
      "ls",
      "-q",
      "--filter",
      `label=com.docker.compose.project=${project}`,
    ])
  )
    throw new Error("The generated Compose project is not empty");
  await Promise.all([15199, 18099, 53399, 56399, 59399].map(freePort));
  const local = join(root, ".local");
  mkdirSync(local, { recursive: true });
  if (!inside(root, realpathSync(local)))
    throw new Error("The local scratch root is outside the repository");
  scratch = mkdtempSync(join(local, "integration-"));
  const backendCwd = join(scratch, "backend");
  mkdirSync(backendCwd);
  console.log(
    `Starting isolated Docker project ${project} and scratch ${basename(scratch)}`,
  );
  started = true;
  compose(["up", "-d", "--wait", "--wait-timeout", "150"]);
  console.log("MySQL 8.4, Redis 7.4, Kafka 4.3.1 healthy");
  const backend = launch(
    javaExecutable,
    [
      "-jar",
      join(jars, artifacts[0]),
      "--server.address=127.0.0.1",
      "--server.port=18099",
    ],
    backendCwd,
    {
      DB_URL: "jdbc:mysql://127.0.0.1:53399/reservation_integration",
      MYSQL_USER: credentials.MYSQL_USER,
      MYSQL_PASSWORD: credentials.MYSQL_PASSWORD,
      REDIS_HOST: "127.0.0.1",
      REDIS_PORT: "56399",
      KAFKA_BOOTSTRAP_SERVERS: "127.0.0.1:59399",
      MEDIA_STORAGE_ROOT: join(scratch, "media"),
      JWT_SECRET: randomBytes(32).toString("base64"),
      JWT_ISSUER: project,
      ...(auth ? { JWT_ACCESS_TOKEN_EXPIRATION: "12s" } : {}),
      GOOGLE_CLIENT_ID: "integration-placeholder",
      GOOGLE_CLIENT_SECRET: "integration-placeholder",
      OAUTH2_FRONTEND_BASE_URL: webOrigin,
    },
    "backend",
  );
  await ready(backend, `${apiOrigin}/v3/api-docs`);
  const vite = launch(
    process.execPath,
    [
      join(frontend, "node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "15199",
      "--strictPort",
    ],
    frontend,
    {
      VITE_API_BASE_URL: "/api/v1",
      API_PROXY_TARGET: apiOrigin,
      VITE_OAUTH2_BACKEND_URL: apiOrigin,
    },
    "vite",
  );
  await ready(vite, `${webOrigin}/api/v1/accommodations`);
  const fixtures = await verifyContract({
    apiOrigin,
    webOrigin,
    sql,
    fixturePassword,
  });
  if (auth) {
    const { verifyAuth } =
      await import("../../frontend/scripts/auth-integration.mjs");
    await verifyAuth({ webOrigin, fixtures, seedLoginCode });
  }
  if (hold) {
    console.log(
      `Browser: ${webOrigin}/   Swagger: ${apiOrigin}/swagger-ui.html`,
    );
    console.log(
      "Press Enter when finished; only this run's resources will be removed.",
    );
    const input = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      await input.question("");
    } finally {
      input.close();
    }
  }
  passed = true;
} catch (error) {
  // Do not print responses, request data, tokens or inherited subprocess error objects.
  console.error(error.message);
  if (scratch)
    console.error(
      `Inspect the isolated logs locally: .local/${basename(scratch)}`,
    );
  process.exitCode = 1;
} finally {
  for (const { child } of children) child.kill();
  await Promise.all(children.map(({ stopped }) => stopped));
  if (started && passed) {
    try {
      compose(["down", "--volumes"]);
      const resolved = realpathSync(scratch);
      const resolvedParent = realpathSync(dirname(scratch));
      if (
        !inside(root, resolvedParent) ||
        dirname(resolved) !== resolvedParent ||
        !/^integration-[A-Za-z0-9]+$/.test(basename(resolved))
      )
        throw new Error("Refusing to delete an unexpected scratch path");
      const mediaRoot = join(resolved, "media");
      if (realpathSync(mediaRoot) !== mediaRoot)
        throw new Error("Refusing to clean an unexpected Media directory");
      const files = readdirSync(mediaRoot, { withFileTypes: true });
      if (
        files.some(
          (entry) =>
            !entry.isFile() ||
            !/^[a-f0-9-]{36}\.(png|jpg|jpeg|webp)$/.test(entry.name),
        )
      )
        throw new Error(
          "Unexpected Media contents; inspect the isolated scratch path",
        );
      for (const file of files) unlinkSync(join(mediaRoot, file.name));
      await removeDirectory(mediaRoot);
      await removeDirectory(join(resolved, "backend"));
      for (const name of ["backend.log", "vite.log"])
        unlinkSync(join(resolved, name));
      await removeDirectory(resolved);
      console.log(
        "Removed only the isolated project, its volumes and scratch files",
      );
    } catch (error) {
      console.error(error.message);
      console.error(
        `Check scoped cleanup for ${project} and .local/${basename(scratch)}`,
      );
      process.exitCode = 1;
    }
  } else if (started) {
    console.error(
      `Isolation preserved for inspection: ${project}; see the runbook for scoped cleanup`,
    );
  }
}
