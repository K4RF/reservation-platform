import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  appendFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync,
  realpathSync, unlinkSync, writeFileSync,
} from "node:fs";
import { cpus, totalmem, platform, arch, release } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import {
  argumentsFor, checkManifest, checkResource, checkStay, hostEnv, K6, OWNED,
  projectOf, SERVICES, VOLUMES,
} from "./config.mjs";
import { kafkaLag, sample, summarize } from "./metrics.mjs";
import { checkInvariants, checkMeasurement, counters } from "./verification.mjs";
import { seedCatalog } from "./catalog-seed.mjs";
import { catalogSqlDelta, catalogSqlSnapshot, explainCatalog, verifyCatalogSql } from "./catalog-diagnostics.mjs";
import { detailTtlMs } from "./k6/detail-cases.js";
import {
  compareDetailReads, detailFinalTtls, detailSnapshot, detailSqlDelta, prepareDetail,
  redisDetailCounters, redisDetailDelta, runDetailBursts, runDetailLifecycle, verifyDetailRecovery, withDetailOutage,
} from "./detail-diagnostics.mjs";

const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const loadDir = join(root, "load-test");
const scratch = join(root, ".local", "load-test");
const group = "com.docker.compose.project";
const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
function harnessHash() {
  const files = ["compose.yaml", "config.mjs", "run.mjs", "metrics.mjs", "verification.mjs", "fixture.mjs",
    "observe/Observe.java", "k6/baseline.js", "k6/profiles.js", "k6/requests.js",
    "catalog-seed.mjs", "catalog-diagnostics.mjs", "k6/catalog.js", "k6/catalog-cases.js",
    "detail-diagnostics.mjs", "k6/detail.js", "k6/detail-cases.js"];
  const sha = createHash("sha256");
  for (const file of files) sha.update(file + "\0" + hash(safeReal(join(loadDir, ...file.split("/")), "file")));
  return sha.digest("hex");
}
const json = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const lines = (text) => text ? text.split(/\r?\n/) : [];
function safeReal(path, type) {
  const stat = lstatSync(path);
  if (realpathSync(path) !== path || !(type === "directory" ? stat.isDirectory() : stat.isFile()))
    throw new Error("Unexpected filesystem path in run scope");
  return path;
}

function command(bin, args, { env = hostEnv, input, timeout = 50_000, label = bin } = {}) {
  const result = spawnSync(bin, args, { cwd: root, env, input, encoding: "utf8", timeout,
    windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  // Docker, Java, SQL and API diagnostics can contain secrets. Never echo their stderr.
  if (result.status !== 0) throw new Error(label + " failed (" + (result.error?.code ?? result.status) + ")");
  return result.stdout.trim();
}

function getRuntime() {
  const context = command("docker", ["context", "show"]);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(context)) throw new Error("Invalid Docker context");
  const endpoint = command("docker", ["context", "inspect", context, "--format", "{{.Endpoints.docker.Host}}"]);
  if (!/^(npipe:\/\/|unix:\/\/)/.test(endpoint)) throw new Error("Remote Docker contexts are refused");
  const docker = (args, options) => command("docker", ["--context", context, ...args], options);
  const info = JSON.parse(docker(["info", "--format",
    '{"engine":"{{.ID}}","version":"{{.ServerVersion}}","cpus":{{.NCPU}},"bytes":{{.MemTotal}},"os":"{{.OSType}}"}']));
  if (!info.engine || info.os !== "linux") throw new Error("Local Docker Linux engine required");
  return { docker, context, info };
}

function openRun(runtime, m) {
  const { id, project } = m;
  const dir = safeReal(join(scratch, id), "directory");
  const results = safeReal(join(dir, "results"), "directory");
  const env = { ...hostEnv, LOAD_ID: id, LOAD_RESULTS: results,
    LOAD_JAR: join(root, "backend", "build", "libs", m.jar), LOAD_CACHE: String(m.cache !== "off"),
    ...(m.workload.detail ? { LOAD_DETAIL_TTL: String(detailTtlMs(m.profile)) + "ms" } : {}),
    LOAD_OUTPUT_USER: (process.getuid?.() ?? 0) + ":" + (process.getgid?.() ?? 0),
    // Only used by 'up'; exec/run/down refer to the existing service environments.
    LOAD_DB_PASSWORD: randomBytes(24).toString("hex"),
    LOAD_ROOT_PASSWORD: randomBytes(24).toString("hex"),
    LOAD_JWT: randomBytes(32).toString("base64") };
  const emptyEnv = safeReal(join(dir, "empty.env"), "file");
  if (lstatSync(emptyEnv).size !== 0) throw new Error("The isolated Compose env file is not empty");
  const composeArgs = ["compose", "--project-name", project, "--project-directory", loadDir,
    "--env-file", emptyEnv, "--file", join(loadDir, "compose.yaml")];
  const compose = (args, options = {}) => runtime.docker([...composeArgs, ...args],
    { label: "Compose " + args.slice(0, args[0] === "exec" ? 1 : 2).join(" "), ...options, env });
  const docker = runtime.docker;

  function resources(required = false) {
    // Consider both ownership labels and all reserved names. An unexpected or foreign
    // resource must block even cleanup; never fall back to a broad Compose down/prune.
    const records = (kind, ids) => ids.length ? JSON.parse(docker([kind, "inspect", ...ids])) : [];
    const containers = records("container", [...new Set([
      ...lines(docker(["ps", "-aq", "--filter", "label=" + group + "=" + project])),
      ...lines(docker(["ps", "-aq", "--filter", "label=" + OWNED + "=" + id])),
      ...lines(docker(["ps", "-a", "--format", "{{.ID}} {{.Names}}"]))
        .filter((row) => row.split(" ")[1]?.startsWith(project + "-")).map((row) => row.split(" ")[0]),
    ])]);
    const named = (kind, names) => records(kind, [...new Set([
      ...lines(docker([kind, "ls", "--format", "{{.Name}}", "--filter", "label=" + group + "=" + project])),
      ...lines(docker([kind, "ls", "--format", "{{.Name}}", "--filter", "label=" + OWNED + "=" + id])),
      ...lines(docker([kind, "ls", "--format", "{{.Name}}"])).filter((name) => name.startsWith(project + "_") || names.includes(name)),
    ])]);
    // A short docker ps ID and full ID may identify the same object.
    const unique = [...new Map(containers.map((c) => [c.Id, c])).values()];
    const networks = named("network", [project + "_default"]);
    const volumes = named("volume", VOLUMES.map((v) => project + "_" + v));
    for (const [kind, list] of [["container", unique], ["network", networks], ["volume", volumes]])
      for (const row of list) checkResource(row, id, kind);
    const services = Object.fromEntries(unique.map((c) => [c.Config.Labels["com.docker.compose.service"], c]));
    for (const n of networks)
      if (Object.keys(n.Containers ?? {}).some((container) => !unique.some((c) => c.Id === container)))
        throw new Error("Foreign attachment to the run network");
    if (required && (networks.length !== 1 || volumes.length !== VOLUMES.length ||
        SERVICES.some((svc) => !services[svc]?.State.Running ||
          (m.resources && m.resources[svc] !== services[svc].Id)) ||
        (m.network && m.network !== networks[0].Id) ||
        ["mysql", "redis", "kafka"].some((svc) => services[svc].State.Health?.Status !== "healthy")))
      throw new Error("Run resources missing, replaced, or unhealthy");
    return { services, networks, volumes };
  }
  function sql(statement) {
    return compose(["exec", "-T", "mysql", "sh", "-c",
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --default-character-set=utf8mb4 --batch --raw --skip-column-names -u root "$MYSQL_DATABASE"'],
    { label: "Isolated SQL", input: statement, timeout: 15_000 });
  }
  const fixture = (...args) => compose(["exec", "-T", "fixture", "node", "/fixture.mjs", ...args],
    { label: "Fixture " + args[0], timeout: 180_000 });
  return { dir, results, docker, compose, composeArgs, env, resources, sql, fixture, context: runtime.context };
}

function withLock(run, fn) {
  const lock = join(run.dir, "operation.lock");
  if (existsSync(lock)) {
    safeReal(lock, "file");
    const owner = Number(readFileSync(lock, "utf8"));
    if (!Number.isSafeInteger(owner) || owner < 1) throw new Error("Malformed operation lock");
    let active = true;
    try { process.kill(owner, 0); } catch (error) { active = error.code !== "ESRCH"; }
    if (active) throw new Error("Another local runner owns this run");
    throw new Error("Stale operation lock; verify the recorded PID locally before removing it");
  }
  writeFileSync(lock, String(process.pid), { flag: "wx" });
  return Promise.resolve().then(fn).finally(() => unlinkSync(lock));
}

async function prepare(runtime, settings) {
  safeReal(root, "directory");
  for (const path of [join(root, ".local"), scratch]) {
    if (!existsSync(path)) mkdirSync(path);
    safeReal(path, "directory");
  }
  const libs = join(root, "backend", "build", "libs");
  const jars = readdirSync(libs).filter((file) => file.endsWith(".jar") && !file.endsWith("-plain.jar"));
  if (jars.length !== 1) throw new Error("Build exactly one Boot JAR using the Gradle Wrapper");
  checkStay(settings.stay);
  const id = randomBytes(12).toString("hex");
  const dir = join(scratch, id);
  mkdirSync(dir);
  mkdirSync(join(dir, "results"));
  writeFileSync(join(dir, "empty.env"), "", { flag: "wx" });
  const { action: _action, ...inputs } = settings;
  const m = { ...inputs, schema: 1, id, project: projectOf(id), engine: runtime.info.engine,
    state: "preparing", source: command("git", ["rev-parse", "HEAD"]), jar: jars[0],
    worktreeDirty: Boolean(command("git", ["status", "--porcelain"])),
    harnessSha256: harnessHash(),
    jarSha256: hash(safeReal(join(libs, jars[0]), "file")),
    host: { platform: platform(), arch: arch(), release: release(), cpus: cpus().length, ramBytes: totalmem() },
    docker: { ...runtime.info }, generator: K6, sourceKind: "packaged Backend direct HTTP", created: new Date().toISOString(),
  };
  const path = join(dir, "manifest.json");
  json(path, m);
  const run = openRun(runtime, m);
  console.log("Isolated run " + id + " (no host ports)");
  await withLock(run, async () => {
    try {
      const scope = run.resources();
      if (Object.keys(scope.services).length || scope.volumes.length || scope.networks.length)
        throw new Error("Generated namespace is not empty");
      run.compose(["up", "-d", "--wait", "--wait-timeout", "160"], { timeout: 210_000, label: "Isolated startup" });
      const owned = run.resources(true);
      m.resources = Object.fromEntries(SERVICES.map((name) => [name, owned.services[name].Id]));
      m.network = owned.networks[0].Id;
      m.images = Object.fromEntries(SERVICES.map((name) => [name, owned.services[name].Image]));
      try {
        m.generatorImage = run.docker(["image", "inspect", "--format", "{{.Id}}", K6]);
      } catch {
        run.docker(["pull", K6], { timeout: 180_000, label: "Pinned k6 image download" });
        m.generatorImage = run.docker(["image", "inspect", "--format", "{{.Id}}", K6]);
      }
      run.fixture("ready");
      if (run.sql("SELECT DATABASE();") !== "reservation_load") throw new Error("Unexpected isolated DB");
      run.compose(["exec", "-T", "backend", "sh", "-c",
        'test ! -e /isolated/.env && test ! -e /.env && javac -d /tmp /Observe.java']);
      m.state = "prepared";
      json(path, m);
      console.log("Prepared. Next: run " + id + " --confirm=" + id);
    } catch (error) {
      m.state = "failed";
      json(path, m);
      throw error;
    }
  });
}

async function drain(run) {
  for (let attempts = 0; attempts < 50; attempts++) {
    const db = JSON.parse(run.sql(counters));
    if (!db.pending && !db.unmatchedEvents && db.outbox === db.processed) {
      const lag = kafkaLag(run.compose);
      if (lag.length === 3 && lag.every(({ lag }) => lag === 0)) return { db, lag };
    }
    await delay(1000);
  }
  throw new Error("Outbox/Consumer drain did not converge");
}

function clearDetail(run) {
  for (const [prefix, name] of [["v2", "accommodation-detail"], ["v3", "room-detail"]]) {
    const key = "reservation:cache:" + prefix + ":" + name + "::";
    const list = lines(run.compose(["exec", "-T", "redis", "redis-cli", "--scan", "--pattern", key + "*"]));
    if (list.length > 32 || list.some((value) => !value.startsWith(key) || !/^[1-9]\d*$/.test(value.slice(key.length))))
      throw new Error("Unrecognized cache keys; no keys were removed");
    if (list.length) run.compose(["exec", "-T", "redis", "redis-cli", "DEL", ...list]);
  }
}

function measured(run, m) {
  const result = spawn("docker", ["--context", run.context, ...run.composeArgs, "run",
    "--no-deps", "--pull", "never", "--rm", "--name", m.project + "-k6", "-T",
    "-e", "LOAD_PROFILE=" + m.profile, "-e", "LOAD_CACHE_MODE=" + m.cache, "-e", "LOAD_ROOM_MODE=" + m.room,
    ...(m.workload.catalog ? ["-e", "LOAD_CATALOG_SIZE=" + m.catalogSize] : []),
    "k6", "run", "--quiet", "--out", "json=/results/raw.jsonl",
    m.workload.catalog ? "/scripts/catalog.js" : m.workload.detail ? "/scripts/detail.js" : "/scripts/baseline.js"],
    { cwd: root, env: run.env, stdio: "ignore", windowsHide: true });
  const cancel = () => {
    try {
      const k6 = run.resources().services.k6;
      if (k6?.State.Running) run.docker(["stop", "--time", "3", k6.Id]);
    } catch { /* leave the run for an explicit stop and inspection */ }
  };
  const timer = setTimeout(cancel, 65_000);
  process.once("SIGINT", cancel);
  return new Promise((resolve, reject) => {
    result.once("error", () => reject(new Error("Could not start the load generator")));
    result.once("exit", (code) => resolve(code));
  }).finally(() => {
    clearTimeout(timer);
    process.removeListener("SIGINT", cancel);
  });
}

async function execute(run, m, path) {
  if (m.state !== "prepared") throw new Error("Run is not fresh; use reset for a new namespace");
  checkStay(m.stay);
  run.resources(true);
  if (run.docker(["image", "inspect", "--format", "{{.Id}}", K6]) !== m.generatorImage)
    throw new Error("Pinned k6 image changed since preparation");
  if (hash(safeReal(run.env.LOAD_JAR, "file")) !== m.jarSha256)
    throw new Error("Boot JAR changed after preparation");
  if (harnessHash() !== m.harnessSha256)
    throw new Error("Harness changed after preparation");
  if (readdirSync(run.results).length) throw new Error("Run results directory must be empty");
  m.state = "running";
  json(path, m);
  const report = (name, value) => json(join(run.results, name), value);
  const stop = join(run.dir, "stop.request");
  const observe = (phase) => appendFileSync(join(run.results, "observations.jsonl"),
    JSON.stringify(sample({ ...run, phase, services: () => lines(run.docker(["ps", "-q",
      "--filter", "label=" + group + "=" + m.project, "--filter", "label=" + OWNED + "=" + m.id])) })) + "\n");
  try {
    const start = Date.now();
    if (JSON.parse(run.sql(counters)).members !== 0) throw new Error("Seed requires an empty owned database");
    const adminId = Number(run.fixture("admin"));
    if (!Number.isSafeInteger(adminId) || adminId < 1 ||
        run.sql("UPDATE members SET role='ADMIN' WHERE id=" + adminId +
          " AND email='load-admin@example.test' AND role='USER'; SELECT ROW_COUNT();") !== "1")
      throw new Error("Cannot grant fixture admin in the isolated DB");
    const seeded = JSON.parse(run.fixture("seed", String(m.seed), m.stay, m.profile));
    const pre = await drain(run);
    for (const [key, value] of Object.entries(seeded.counts))
      if (pre.db[key] !== value) throw new Error("Seed count mismatch: " + key);
    report("seed.json", seeded);
    run.fixture("smoke", m.workload.detail ? "off" : m.cache);
    if (m.workload.catalog) {
      const catalog = seedCatalog(run.sql, m.seed, m.stay, m.catalogSize);
      const afterSeed = JSON.parse(run.sql(counters));
      for (const [key, value] of Object.entries(catalog.added))
        if (afterSeed[key] !== pre.db[key] + value) throw new Error("Catalog seed count mismatch: " + key);
      pre.db = afterSeed;
      const contracts = JSON.parse(run.fixture("catalog-preflight", String(m.seed), m.catalogSize));
      report("catalog-fixture.json", { ...catalog, ...contracts });
    }
    const detail = m.workload.detail;
    const maxTtl = detail && detailTtlMs(m.profile);
    let cases;
    if (detail) {
      const fixture = JSON.parse(run.fixture("detail-preflight", String(m.seed)));
      cases = fixture.cases;
      report("detail-fixture.json", {
        payloads: fixture.probes.map(({ name, bytes }) => ({ name, bytes })),
        ttlMs: maxTtl, cacheEnabled: m.cache !== "off",
        ...prepareDetail(run, cases, m.cache, maxTtl),
      });
    } else if (m.cache === "cold") clearDetail(run);
    observe("before");
    if (existsSync(stop)) throw new Error("Stopped before starting k6");
    if (detail === "lifecycle") {
      report("detail-lifecycle.json", await runDetailLifecycle(run, cases, maxTtl, () => existsSync(stop)));
      const post = await drain(run);
      checkInvariants(pre.db, post.db, { operations: {} }, m.profile);
      if (JSON.stringify(pre.db) !== JSON.stringify(post.db)) throw new Error("Lifecycle changed unrelated counts");
      report("verification.json", { before: pre.db, after: post.db, lag: post.lag });
      run.resources(true);
      m.state = "passed";
      console.log("PASS: natural TTL expiration, reload and after-commit eviction");
      return;
    }
    const redisBefore = detail === "reads" && redisDetailCounters(run);
    let sqlBefore, sqlAfter;
    const measure = async () => {
      if (existsSync(stop)) throw new Error("Stopped before starting k6");
      if (detail) sqlBefore = detailSnapshot(run);
      m.measurement = { seedAndWarmupMs: Date.now() - start, startedAt: new Date().toISOString() };
      json(path, m);
      const generator = measured(run, m);
      const interval = setInterval(() => observe("measurement"), 5000);
      let code;
      try { code = await generator; } finally { clearInterval(interval); }
      m.measurement.endedAt = new Date().toISOString();
      m.measurement.generatorCode = code;
      if (detail) sqlAfter = detailSnapshot(run);
      return code;
    };
    const catalogBefore = m.workload.catalog && catalogSqlSnapshot(run.sql);
    const code = detail === "outage" ? await withDetailOutage(run, m.resources.redis, measure) : await measure();
    const sqlDelta = catalogBefore && catalogSqlDelta(catalogBefore, catalogSqlSnapshot(run.sql));
    if (sqlDelta) report("catalog-sql.json", sqlDelta);
    const detailSql = detail && detailSqlDelta(sqlBefore, sqlAfter);
    const redisDelta = redisBefore && redisDetailDelta(redisBefore, redisDetailCounters(run));
    if (detail) report("detail-metrics.json", { sql: detailSql, redis: redisDelta || null });
    const drainStarted = Date.now();
    let post;
    try {
      post = await drain(run);
    } catch (error) {
      report("verification.json", { before: pre.db, after: JSON.parse(run.sql(counters)),
        drainMs: Date.now() - drainStarted, drained: false });
      throw error;
    }
    report("verification.json", { before: pre.db, after: post.db, lag: post.lag, drainMs: Date.now() - drainStarted });
    observe("after");
    const result = summarize(safeReal(join(run.results, "raw.jsonl"), "file"), m.workload);
    report("summary.json", result);
    checkInvariants(pre.db, post.db, result, m.profile);
    run.resources(true);
    checkMeasurement(result, m.workload, code);
    if (m.workload.catalog) {
      verifyCatalogSql(result, sqlDelta);
      run.fixture("catalog-check");
      if (m.workload.catalog !== "journey")
        report("catalog-plans.json", explainCatalog(run, m.workload.catalog));
    }
    if (detail) {
      const counts = compareDetailReads(result, detailSql, m.cache, detail);
      const finalTtl = detail === "outage" ? null : detailFinalTtls(run, cases, m.cache === "off" ? 0 : maxTtl);
      report("detail-metrics.json", { sql: detailSql, redis: redisDelta || null, counts, finalTtl });
      if (detail === "outage") report("detail-recovery.json", verifyDetailRecovery(run, cases, maxTtl));
      if (detail === "reads" && m.cache === "cold") {
        if (existsSync(stop)) throw new Error("Stopped before detail burst");
        report("detail-bursts.json", runDetailBursts(run, cases, maxTtl));
      }
    }
    m.state = "passed";
    console.log("PASS: " + result.count + " measured requests; DB, inventory, snapshot and events verified");
  } catch (error) {
    m.state = "failed";
    throw error;
  } finally {
    json(path, m);
  }
}

let active;
try {
  const options = argumentsFor(process.argv.slice(2));
  const runtime = getRuntime();
  if (options.action === "prepare") await prepare(runtime, options);
  else {
    active = options.id;
    safeReal(join(root, ".local"), "directory");
    safeReal(scratch, "directory");
    const dir = safeReal(join(scratch, active), "directory");
    const path = safeReal(join(dir, "manifest.json"), "file");
    const m = checkManifest(readJson(path), active, runtime.info.engine, options.action !== "cleanup");
    if (typeof m.jar !== "string" || basename(m.jar) !== m.jar || !/^[a-zA-Z0-9_.-]+\.jar$/.test(m.jar))
      throw new Error("Invalid Boot JAR name");
    const run = openRun(runtime, m);
    if (options.action === "stop") {
      const generator = run.resources().services.k6;
      const stop = join(run.dir, "stop.request");
      if (m.state === "running" && !existsSync(stop)) writeFileSync(stop, "", { flag: "wx" });
      if (generator?.State.Running) run.docker(["stop", "--time", "3", generator.Id]);
      console.log("Stop requested for this run only (stack preserved).");
    } else await withLock(run, async () => {
      if (options.action === "run") await execute(run, m, path);
      if (options.action === "cleanup") {
        if (run.resources().services.k6?.State.Running) throw new Error("Stop the owned generator first");
        run.compose(["--profile", "generator", "down", "--volumes"], { timeout: 60_000, label: "Owned cleanup" });
        const remaining = run.resources();
        if (Object.keys(remaining.services).length || remaining.networks.length || remaining.volumes.length)
          throw new Error("Owned resources remain");
        console.log("Only this run's Docker resources removed; manifests and artifacts kept.");
      }
      if (options.action === "reset") {
        run.resources();
        await prepare(runtime, Object.fromEntries(["seed", "stay", "profile", "cache", "room", "catalogSize", "workload"]
          .map((key) => [key, m[key]])));
      }
    });
  }
} catch (error) {
  console.error(error instanceof SyntaxError ? "Invalid run document or response" : error.message);
  console.error("No failed state was auto-cleaned. Inspect the run ID and use explicit cleanup.");
  process.exitCode = 1;
}
