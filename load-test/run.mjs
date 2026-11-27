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
  projectOf, SERVICES, servicesFor, volumesFor,
} from "./config.mjs";
import { kafkaLag, sample, summarize } from "./metrics.mjs";
import { checkInvariants, checkMeasurement, counters } from "./verification.mjs";
import { seedCatalog } from "./catalog-seed.mjs";
import { catalogSqlDelta, catalogSqlSnapshot, explainCatalog, verifyCatalogSql } from "./catalog-diagnostics.mjs";
import { detailTtlMs } from "./k6/detail-cases.js";
import { seedStay } from "./stay-seed.mjs";
import { explainStay, stayChecksums, stayDelta, staySnapshot, verifyStayRead } from "./stay-diagnostics.mjs";
import {
  creationDatabase, creationServerMetrics, prepareCreation, readCreationLedger, reconcileCreation,
} from "./creation-verification.mjs";
import {
  compareDetailReads, detailFinalTtls, detailSnapshot, detailSqlDelta, prepareDetail,
  redisDetailCounters, redisDetailDelta, runDetailBursts, runDetailLifecycle, verifyDetailRecovery, withDetailOutage,
} from "./detail-diagnostics.mjs";
import { lifecycleSnapshot, prepareLifecycle, readLifecycleLedger, reconcileLifecycle } from "./lifecycle-verification.mjs";
import {
  brokerOffsets, kafkaOutage, lifecycleEvents, lifecycleTimings, outageProducerMaxBlockMs, verifyBroker,
} from "./lifecycle-kafka.mjs";
import { pollDelta, pollSnapshot } from "./outbox-poll.mjs";
import { explores, lifecycleReadOnly } from "./k6/lifecycle-cases.js";

const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const loadDir = join(root, "load-test");
const monitorDir = join(root, "infra", "observability");
const scratch = join(root, ".local", "load-test");
const group = "com.docker.compose.project";
const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
function harnessHash() {
  const files = ["compose.yaml", "config.mjs", "run.mjs", "metrics.mjs", "verification.mjs", "fixture.mjs",
    "observe/Observe.java", "k6/baseline.js", "k6/profiles.js", "k6/requests.js",
    "catalog-seed.mjs", "catalog-diagnostics.mjs", "k6/catalog.js", "k6/catalog-cases.js",
    "detail-diagnostics.mjs", "k6/detail.js", "k6/detail-cases.js",
    "stay-seed.mjs", "stay-diagnostics.mjs", "k6/stay.js", "k6/stay-cases.js",
    "creation-verification.mjs", "k6/creation.js", "k6/creation-cases.js",
    "lifecycle-verification.mjs", "lifecycle-kafka.mjs", "k6/lifecycle.js", "k6/lifecycle-cases.js", "outbox-poll.mjs"];
  const sha = createHash("sha256");
  for (const file of files) sha.update(file + "\0" + hash(safeReal(join(loadDir, ...file.split("/")), "file")));
  for (const file of ["compose.yaml", "prometheus.yml", "datasource.yml", "probe.mjs"])
    sha.update("monitoring/" + file + "\0" + hash(safeReal(join(monitorDir, file), "file")));
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
  const expected = servicesFor(m.workload, m.monitoring);
  const allowedVolumes = volumesFor(expected);
  const monitorSources = { scrape: join(dir, "scrape.secret"), grafana: join(dir, "grafana.secret"),
    prometheus: join(monitorDir, "prometheus.yml"), datasource: join(monitorDir, "datasource.yml") };
  const env = { ...hostEnv, LOAD_ID: id, LOAD_RESULTS: results,
    LOAD_JAR: join(root, "backend", "build", "libs", m.jar), LOAD_CACHE: String(m.cache !== "off"),
    ...(m.workload.detail ? { LOAD_DETAIL_TTL: String(detailTtlMs(m.profile)) + "ms" } : {}),
    ...(m.workload.creation ? { LOAD_CREATE_OBSERVATION: "TRACE" } : {}),
    ...(m.workload.lifecycle && !lifecycleReadOnly(m.workload.lifecycle) ? { LOAD_LIFECYCLE_OBSERVATION: "TRACE" } : {}),
    ...(m.outboxPoll ? { LOAD_OUTBOX_POLL: m.outboxPoll } : {}),
    ...(m.monitoring ? { LOAD_MONITOR_CONFIG: monitorDir, LOAD_SCRAPE_FILE: monitorSources.scrape,
      LOAD_GRAFANA_FILE: monitorSources.grafana } : {}),
    // Bound metadata lookup only in the controlled fault probe; all healthy profiles use Kafka's defaults.
    LOAD_PRODUCER_CONFIG: m.workload.lifecycle === "broker-down" ?
      JSON.stringify({ "spring.kafka.producer.properties[max.block.ms]": String(outageProducerMaxBlockMs) }) : "{}",
    LOAD_OUTPUT_USER: (process.getuid?.() ?? 0) + ":" + (process.getgid?.() ?? 0),
    // Only used by 'up'; exec/run/down refer to the existing service environments.
    LOAD_DB_PASSWORD: randomBytes(24).toString("hex"),
    LOAD_ROOT_PASSWORD: randomBytes(24).toString("hex"),
    LOAD_JWT: randomBytes(32).toString("base64") };
  const emptyEnv = safeReal(join(dir, "empty.env"), "file");
  if (lstatSync(emptyEnv).size !== 0) throw new Error("The isolated Compose env file is not empty");
  const composeArgs = ["compose", "--project-name", project, "--project-directory", loadDir,
    "--env-file", emptyEnv, "--file", join(loadDir, "compose.yaml"),
    ...(m.monitoring ? ["--file", safeReal(join(monitorDir, "compose.yaml"), "file")] : []),
    ...(m.workload.creation === "peer" ? ["--profile", "creation-peer"] : [])];
  const compose = (args, options = {}) => runtime.docker([...composeArgs, ...args],
    { label: "Compose " + args.slice(0, args[0] === "exec" ? 1 : 2).join(" "), ...options, env });
  const docker = runtime.docker;

  function resources(required = false, expectedServices = expected) {
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
    const volumes = named("volume", allowedVolumes.map((v) => project + "_" + v));
    for (const [kind, list] of [["container", unique], ["network", networks], ["volume", volumes]])
      for (const row of list) checkResource(row, id, kind, expected, monitorSources);
    const services = Object.fromEntries(unique.map((c) => [c.Config.Labels["com.docker.compose.service"], c]));
    if (Object.entries(services).some(([svc, record]) =>
      (m.resources?.[svc] && m.resources[svc] !== record.Id) || (m.images?.[svc] && m.images[svc] !== record.Image)) ||
      networks.some((n) => m.network && m.network !== n.Id))
      throw new Error("Run identities were replaced; no cleanup performed");
    for (const n of networks)
      if (Object.keys(n.Containers ?? {}).some((container) => !unique.some((c) => c.Id === container)))
        throw new Error("Foreign attachment to the run network");
    if (required && (networks.length !== 1 || volumes.length !== allowedVolumes.length ||
        expectedServices.some((svc) => !services[svc]?.State.Running ||
          (m.resources && m.resources[svc] !== services[svc].Id)) ||
        (m.network && m.network !== networks[0].Id) ||
        (m.outboxPoll && !services.backend.Config.Env.includes("RESERVATION_KAFKA_OUTBOX_PUBLISH_INTERVAL=" + m.outboxPoll)) ||
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
  async function monitor() {
    if (!m.monitoring) throw new Error("This run has no monitoring services");
    resources(true);
    const secrets = Object.fromEntries(["scrape", "grafana"].map((name) =>
      [name, readFileSync(safeReal(monitorSources[name], "file"), "utf8").trim()]));
    if (Object.values(secrets).some((value) => !/^[A-Za-z0-9_-]{43}$/.test(value)))
      throw new Error("Invalid scoped monitoring credential");
    const script = readFileSync(safeReal(join(monitorDir, "probe.mjs"), "file"), "utf8") +
      "\nconsole.log(JSON.stringify(await monitoringProbe(" + JSON.stringify(secrets) + ")));";
    const deadline = Date.now() + 65_000;
    do {
      try {
        return JSON.parse(compose(["exec", "-T", "fixture", "node", "--input-type=module", "-"],
          { label: "Internal monitoring probe", input: script, timeout: 10_000 }));
      } catch { await delay(1300); }
    } while (Date.now() < deadline);
    throw new Error("Authenticated scrape or provisioned datasource did not become healthy");
  }
  const removeCredentials = () => {
    for (const name of ["scrape", "grafana"])
      if (m.monitoring && existsSync(monitorSources[name])) unlinkSync(safeReal(monitorSources[name], "file"));
  };
  return { dir, results, docker, compose, composeArgs, env, resources, sql, fixture, monitor, removeCredentials, context: runtime.context };
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
  if (settings.workload.creation === "peer" && (runtime.info.cpus < 6 || runtime.info.bytes < 7 * 1024 ** 3))
    throw new Error("Peer probe requires a local engine with at least 6 CPUs and 7 GiB");
  if (settings.monitoring && (runtime.info.cpus < 6 || runtime.info.bytes < 6 * 1024 ** 3))
    throw new Error("Monitoring requires a local engine with at least 6 CPUs and 6 GiB");
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
  mkdirSync(dir, { mode: 0o700 });
  mkdirSync(join(dir, "results"));
  writeFileSync(join(dir, "empty.env"), "", { flag: "wx" });
  if (settings.monitoring) for (const service of ["scrape", "grafana"])
    writeFileSync(join(dir, service + ".secret"), randomBytes(32).toString("base64url"), { flag: "wx", mode: 0o644 });
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
  const initialServices = m.monitoring ? servicesFor(m.workload, m.monitoring) : SERVICES;
  console.log("Isolated run " + id + " (no host ports)");
  await withLock(run, async () => {
    try {
      const scope = run.resources();
      if (Object.keys(scope.services).length || scope.volumes.length || scope.networks.length)
        throw new Error("Generated namespace is not empty");
      run.compose(["up", "-d", "--wait", "--wait-timeout", "160", ...initialServices], { timeout: 210_000, label: "Isolated startup" });
      run.resources(true, initialServices);
      run.fixture("ready");
      if (m.workload.creation === "peer") {
        // Let the primary finish the initial Hibernate schema update before adding a peer.
        run.compose(["up", "-d", "--no-deps", "backend-peer"], { label: "Isolated peer startup" });
        run.resources(true);
        run.fixture("ready-peer");
      }
      const owned = run.resources(true);
      m.resources = Object.fromEntries(servicesFor(m.workload, m.monitoring).map((name) => [name, owned.services[name].Id]));
      m.network = owned.networks[0].Id;
      m.images = Object.fromEntries(servicesFor(m.workload, m.monitoring).map((name) => [name, owned.services[name].Image]));
      if (m.images["backend-peer"] && m.images["backend-peer"] !== m.images.backend)
        throw new Error("Isolated peer image does not match the primary");
      try {
        m.generatorImage = run.docker(["image", "inspect", "--format", "{{.Id}}", K6]);
      } catch {
        run.docker(["pull", K6], { timeout: 180_000, label: "Pinned k6 image download" });
        m.generatorImage = run.docker(["image", "inspect", "--format", "{{.Id}}", K6]);
      }
      if (run.sql("SELECT DATABASE();") !== "reservation_load") throw new Error("Unexpected isolated DB");
      for (const service of servicesFor(m.workload).filter((name) => name.startsWith("backend")))
        run.compose(["exec", "-T", service, "sh", "-c",
          'test ! -e /isolated/.env && test ! -e /.env && javac -d /tmp /Observe.java']);
      if (m.monitoring) m.monitoringStartup = await run.monitor();
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

async function drain(run, budget = Infinity) {
  const deadline = Date.now() + budget;
  for (let attempts = 0; attempts < 50 && Date.now() < deadline; attempts++) {
    const db = JSON.parse(run.sql(counters));
    if (!db.pending && !db.unmatchedEvents && db.outbox === db.processed) {
      const lag = kafkaLag(run.compose, Math.max(1, Math.min(50_000, deadline - Date.now())));
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
  const ledger = m.workload.creation ? "creation" :
    m.workload.lifecycle && !lifecycleReadOnly(m.workload.lifecycle) ? "lifecycle" : null;
  const result = spawn("docker", ["--context", run.context, ...run.composeArgs, "run",
    "--no-deps", "--pull", "never", "--rm", "--name", m.project + "-k6", "-T",
    "-e", "LOAD_PROFILE=" + m.profile, "-e", "LOAD_CACHE_MODE=" + m.cache, "-e", "LOAD_ROOM_MODE=" + m.room,
    ...(m.workload.catalog || m.workload.stayRead ? ["-e", "LOAD_CATALOG_SIZE=" + m.catalogSize] : []),
    "k6", ...(ledger ? ["--log-format=raw"] : []), "run", "--quiet", "--out", "json=/results/raw.jsonl",
    ...(ledger ? ["--console-output=/results/" + ledger + "-ledger.jsonl"] : []),
    m.workload.lifecycle ? "/scripts/lifecycle.js" : m.workload.creation ? "/scripts/creation.js" :
      m.workload.stayRead ? "/scripts/stay.js" :
      m.workload.catalog ? "/scripts/catalog.js" :
      m.workload.detail ? "/scripts/detail.js" : "/scripts/baseline.js"],
    { cwd: root, env: run.env, stdio: "ignore", windowsHide: true });
  const cancel = () => {
    try {
      const k6 = run.resources().services.k6;
      if (k6?.State.Running) run.docker(["stop", "--time", "3", k6.Id]);
    } catch { /* leave the run for an explicit stop and inspection */ }
  };
  const timer = setTimeout(cancel, m.workload.lifecycle === "stability" ? 145_000 : 65_000);
  process.once("SIGINT", cancel);
  return new Promise((resolve, reject) => {
    result.once("error", () => reject(new Error("Could not start the load generator")));
    result.once("exit", (code) => resolve(code));
  }).finally(() => {
    clearTimeout(timer);
    process.removeListener("SIGINT", cancel);
  });
}

async function settleCreation(run, m, report) {
  const ledgerPath = join(run.results, "creation-ledger.jsonl");
  const ledger = existsSync(ledgerPath) ? readCreationLedger(readFileSync(safeReal(ledgerPath, "file"), "utf8")) : [];
  const dispatched = ledger.filter((row) => row.event === "dispatch").length;
  const names = servicesFor(m.workload).filter((name) => name.startsWith("backend"));
  const read = () => {
    const instances = Object.fromEntries(names.map((name) => [name, run.docker([
      "logs", "--since", m.measurement.startedAt, m.resources[name],
    ], { label: "Isolated server observation" })]));
    return { total: creationServerMetrics(Object.values(instances).join("\n")),
      instances: Object.fromEntries(Object.entries(instances).map(([name, log]) => [name, creationServerMetrics(log)])) };
  };
  let observation = read();
  const cutoff = Date.now() + 34_000;
  while (observation.total.finished < dispatched && Date.now() < cutoff) {
    await delay(1000);
    observation = read();
  }
  report("creation-server.json", observation);
  return { ledger, observation };
}

async function finishLifecycle(run, m, { first, previous, offsets, pre, code, measureError, report }) {
  const mode = m.workload.lifecycle;
  const raw = join(run.results, "raw.jsonl"), ledgerPath = join(run.results, "lifecycle-ledger.jsonl");
  const summary = existsSync(raw) && summarize(safeReal(raw, "file"), m.workload);
  if (summary) report("summary.json", summary);
  const ledger = existsSync(ledgerPath) ? readLifecycleLedger(readFileSync(safeReal(ledgerPath, "file"), "utf8")) : [];
  // Ambiguous requests may still commit; allow a bounded settle window and never send them again.
  if (measureError || code !== 0 || ledger.filter((x) => x.event === "dispatch").length !==
      ledger.filter((x) => x.event === "response").length || ledger.some((x) => x.outcome === "unconfirmed_write"))
    await delay(6500);
  const started = Date.now();
  let post, drainError;
  try { post = await drain(run, 50_000); } catch (error) { drainError = error; }
  report("verification.json", { before: pre.db, after: post?.db ?? JSON.parse(run.sql(counters)),
    lag: post?.lag, drained: !!post, drainMs: Date.now() - started });
  const events = lifecycleEvents(run, first.watermarks.outbox);
  const current = lifecycleSnapshot(run, first, mode);
  const reconciled = reconcileLifecycle({ mode, first, previous, current, events, ledger, summary, roomMode: m.room });
  report("lifecycle-reconciliation.json", reconciled);
  const timings = !lifecycleReadOnly(mode) && lifecycleTimings(run.docker([
    "logs", "--since", m.measurement.startedAt, m.resources.backend,
  ], { label: "Isolated Outbox observation" }), events);
  if (timings) report("lifecycle-timings.json", timings);
  if (measureError || drainError) throw measureError ?? drainError;
  if (!summary || reconciled.errors.length) throw new Error("Lifecycle reconciliation failed; inspect scoped artifacts, never retry writes");
  const operations = Object.fromEntries(Object.entries(reconciled.counts)
    .map(([name, success]) => ["reservation." + name, { success }]));
  checkInvariants(pre.db, post.db, { operations }, m.profile);
  checkMeasurement(summary, m.workload, code);
  if (timings && (timings.brokerAckWaitMs.count < events.length ||
      timings.publishedRowsInCommittedBatches !== events.length || !timings.committedNonemptyBatchMs.count))
    throw new Error("Missing Publisher timing evidence");
  if (mode === "write") {
    const { id, ownerIndex } = reconciled.records[0];
    const controls = JSON.parse(run.fixture("lifecycle-controls", String(id), String(ownerIndex)));
    report("lifecycle-controls.json", controls);
    if (JSON.stringify(current) !== JSON.stringify(lifecycleSnapshot(run, first, mode)) ||
        JSON.stringify(post.db) !== JSON.stringify(JSON.parse(run.sql(counters))) ||
        JSON.stringify(events) !== JSON.stringify(lifecycleEvents(run, first.watermarks.outbox)))
      throw new Error("A rejected control changed durable state");
  }
  report("lifecycle-broker.json", await verifyBroker(run, { m, before: offsets, events,
    drain: (target) => drain(target, 50_000), canary: mode === "write", report }));
  run.resources(true);
  return summary;
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
  let monitoringBefore;
  const finishMonitoring = async () => {
    if (!m.monitoring) return;
    try {
      report("monitoring.json", { state: "collected", before: monitoringBefore, after: await run.monitor() });
    } catch (error) {
      report("monitoring.json", { state: "unavailable", before: monitoringBefore });
      throw error;
    }
  };
  const stop = join(run.dir, "stop.request");
  const observe = (phase) => appendFileSync(join(run.results, "observations.jsonl"),
    JSON.stringify(sample({ ...run, phase, peer: m.workload.creation === "peer",
      brokerUnavailable: m.workload.lifecycle === "broker-down" && phase === "measurement",
      services: () => lines(run.docker(["ps", "-q",
      "--filter", "label=" + group + "=" + m.project, "--filter", "label=" + OWNED + "=" + m.id])) })) + "\n");
  try {
    const start = Date.now();
    if (m.monitoring) {
      try {
        monitoringBefore = await run.monitor();
        report("monitoring.json", { state: "in-progress", before: monitoringBefore });
      } catch (error) {
        report("monitoring.json", { state: "unavailable" });
        throw error;
      }
    }
    if (JSON.parse(run.sql(counters)).members !== 0) throw new Error("Seed requires an empty owned database");
    const adminId = Number(run.fixture("admin"));
    if (!Number.isSafeInteger(adminId) || adminId < 1 ||
        run.sql("UPDATE members SET role='ADMIN' WHERE id=" + adminId +
          " AND email='load-admin@example.test' AND role='USER'; SELECT ROW_COUNT();") !== "1")
      throw new Error("Cannot grant fixture admin in the isolated DB");
    const seeded = JSON.parse(run.fixture("seed", String(m.seed), m.stay, m.profile));
    let pre = await drain(run);
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
    const stayRead = m.workload.stayRead;
    let stayContracts, stayBefore;
    if (stayRead) {
      const added = seedStay(run.sql, m.seed, m.stay, m.catalogSize);
      const afterSeed = JSON.parse(run.sql(counters));
      for (const [key, value] of Object.entries(added.added))
        if (afterSeed[key] !== pre.db[key] + value) throw new Error("Stay seed count mismatch: " + key);
      pre.db = afterSeed;
      stayContracts = JSON.parse(run.fixture("stay-preflight", String(m.seed), m.stay, m.catalogSize,
        JSON.stringify(added.boundary)));
      report("stay-fixture.json", { ...added, ...stayContracts, fixtureSpec: m.workload.stayFixture });
      stayBefore = stayChecksums(run.sql);
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
    const creation = m.workload.creation;
    const createSeed = creation && prepareCreation(run, creation);
    if (createSeed) report("creation-fixture.json", {
      initialMax: createSeed.initialMax, eligibleAccounts: createSeed.fixture.accounts.length,
      days: createSeed.fixture.days, endDate: createSeed.fixture.endDate, inventory: createSeed.included,
      lockWaitMs: 3000, leaseMs: 30000, maxAttempts: 3,
    });
    const lifecycle = m.workload.lifecycle;
    const journey = explores(lifecycle);
    let first, previous, offsets;
    if (lifecycle) {
      if (lifecycle === "history") {
        report("lifecycle-history-fixture.json", JSON.parse(run.fixture("lifecycle-history")));
        pre = await drain(run, 50_000);
        if (pre.db.reservations !== seeded.counts.reservations + 30) throw new Error("Unexpected history reservation count");
      }
      first = prepareLifecycle(run);
      previous = lifecycleSnapshot(run, first, lifecycle);
      offsets = brokerOffsets(run);
      m.lifecycleWatermark = first.watermarks.outbox;
      report("lifecycle-fixture.json", { watermarks: first.watermarks, offsets, days: first.fixture.days });
    }
    observe("before");
    let idlePolls;
    if (m.outboxPoll) {
      const idle = pollSnapshot(run.sql);
      await delay(6000);
      idlePolls = pollDelta(idle, pollSnapshot(run.sql));
      if (idlePolls.rowsSent) throw new Error("Idle Outbox probe unexpectedly returned pending rows");
    }
    if (existsSync(stop)) throw new Error("Stopped before starting k6");
    if (detail === "lifecycle") {
      report("detail-lifecycle.json", await runDetailLifecycle(run, cases, maxTtl, () => existsSync(stop)));
      const post = await drain(run);
      checkInvariants(pre.db, post.db, { operations: {} }, m.profile);
      if (JSON.stringify(pre.db) !== JSON.stringify(post.db)) throw new Error("Lifecycle changed unrelated counts");
      report("verification.json", { before: pre.db, after: post.db, lag: post.lag });
      run.resources(true);
      await finishMonitoring();
      m.state = "passed";
      console.log("PASS: natural TTL expiration, reload and after-commit eviction");
      return;
    }
    const redisBefore = detail === "reads" && redisDetailCounters(run);
    let sqlBefore, sqlAfter, staySqlBefore, staySqlAfter;
    let activePolls;
    let journeyCache;
    const measure = async () => {
      if (existsSync(stop)) throw new Error("Stopped before starting k6");
      if (detail) sqlBefore = detailSnapshot(run);
      if (stayRead) staySqlBefore = staySnapshot(run.sql);
      const pollsBefore = idlePolls && pollSnapshot(run.sql);
      const cacheBefore = journey && redisDetailCounters(run);
      m.measurement = { seedAndWarmupMs: Date.now() - start, startedAt: new Date().toISOString() };
      json(path, m);
      const generator = measured(run, m);
      const interval = setInterval(() => observe("measurement"), 5000);
      let code;
      try { code = await generator; } finally { clearInterval(interval); }
      m.measurement.endedAt = new Date().toISOString();
      m.measurement.generatorCode = code;
      if (detail) sqlAfter = detailSnapshot(run);
      if (stayRead) staySqlAfter = staySnapshot(run.sql);
      if (pollsBefore) activePolls = pollDelta(pollsBefore, pollSnapshot(run.sql));
      if (cacheBefore) journeyCache = redisDetailDelta(cacheBefore, redisDetailCounters(run));
      return code;
    };
    const catalogBefore = m.workload.catalog && catalogSqlSnapshot(run.sql);
    let code, measureError;
    try {
      code = detail === "outage" || creation === "redis-down" ?
        await withDetailOutage(run, m.resources.redis, measure) : lifecycle === "broker-down" ?
          await kafkaOutage(run, m, measure, report) : await measure();
    } catch (error) {
      if ((!creation && !lifecycle) || !m.measurement?.startedAt) throw error;
      measureError = error;
    }
    if (lifecycle) {
      if (journeyCache) report("journey-cache.json", journeyCache);
      if (idlePolls) report("outbox-poll.json", { interval: m.outboxPoll, idle: idlePolls, active: activePolls });
      const summary = await finishLifecycle(run, m, { first, previous, offsets, pre, code, measureError, report });
      observe("after");
      await finishMonitoring();
      m.state = "passed";
      console.log("PASS: " + summary.count + " measured requests; lifecycle, DB and Kafka verified");
      return;
    }
    const sqlDelta = catalogBefore && catalogSqlDelta(catalogBefore, catalogSqlSnapshot(run.sql));
    if (sqlDelta) report("catalog-sql.json", sqlDelta);
    const staySql = stayRead && stayDelta(staySqlBefore, staySqlAfter);
    if (staySql) report("stay-sql.json", staySql);
    const detailSql = detail && detailSqlDelta(sqlBefore, sqlAfter);
    const redisDelta = redisBefore && redisDetailDelta(redisBefore, redisDetailCounters(run));
    if (detail) report("detail-metrics.json", { sql: detailSql, redis: redisDelta || null });
    const settled = creation && await settleCreation(run, m, report);
    const reconcile = () => {
      run.resources();
      const result = reconcileCreation({ mode: creation, fixture: createSeed.fixture, ledger: settled.ledger,
        db: creationDatabase(run, createSeed.initialMax), beforeInventory: createSeed.inventory,
        finished: settled.observation.total.finished });
      report("creation-reconciliation.json", result);
      return result;
    };
    const drainStarted = Date.now();
    let post;
    try {
      post = await drain(run);
    } catch (error) {
      report("verification.json", { before: pre.db, after: JSON.parse(run.sql(counters)),
        drainMs: Date.now() - drainStarted, drained: false });
      if (creation) reconcile();
      throw error;
    }
    report("verification.json", { before: pre.db, after: post.db, lag: post.lag, drainMs: Date.now() - drainStarted });
    const reconciled = creation && reconcile();
    observe("after");
    if (measureError) throw measureError;
    const result = summarize(safeReal(join(run.results, "raw.jsonl"), "file"), m.workload);
    report("summary.json", result);
    if (creation) {
      const server = settled.observation.total;
      const { counts, errors } = reconciled;
      if (errors.length || server.beyondLease || server.notOwned || server.releaseFailed ||
          server.returned !== counts.committed || server.attempts !== server.acquired + server.retryAttempts ||
          (creation === "peer" && Object.values(settled.observation.instances).some((x) => !x.returned)) ||
          result.count !== counts.dispatch || counts.success !== (result.operations["reservation.create"]?.success ?? 0))
        throw new Error("Creation reconciliation failed; inspect the scoped artifacts, never retry writes");
      checkInvariants(pre.db, post.db, { operations: { "reservation.create": { success: counts.committed } } }, m.profile);
    } else checkInvariants(pre.db, post.db, result, m.profile);
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
    if (stayRead) {
      const totals = verifyStayRead(stayRead, result, staySql, stayContracts.responseTypes);
      report("stay-outcomes.json", totals);
      run.fixture("stay-check");
      const after = stayChecksums(run.sql);
      if (JSON.stringify(stayBefore) !== JSON.stringify(after) || JSON.stringify(pre.db) !== JSON.stringify(post.db))
        throw new Error("Read-only stay fixture changed");
      report("stay-readonly.json", { before: stayBefore, after });
      if (stayRead !== "journey") report("stay-plans.json", explainStay(run, stayRead));
    }
    await finishMonitoring();
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
      if (options.action === "monitor-check") {
        if (!m.monitoring || !["prepared", "passed"].includes(m.state) || harnessHash() !== m.harnessSha256)
          throw new Error("An unchanged prepared or passed monitoring run is required");
        console.log(JSON.stringify(await run.monitor()));
      }
      if (options.action === "cleanup") {
        if (run.resources().services.k6?.State.Running) throw new Error("Stop the owned generator first");
        run.compose(["--profile", "generator", "down", "--volumes"], { timeout: 60_000, label: "Owned cleanup" });
        const remaining = run.resources();
        if (Object.keys(remaining.services).length || remaining.networks.length || remaining.volumes.length)
          throw new Error("Owned resources remain");
        run.removeCredentials();
        console.log("Only this run's Docker resources removed; manifests and artifacts kept.");
      }
      if (options.action === "reset") {
        run.resources();
        await prepare(runtime, Object.fromEntries(["seed", "stay", "profile", "cache", "room", "catalogSize", "outboxPoll", "monitoring", "workload"]
          .map((key) => [key, m[key]])));
      }
    });
  }
} catch (error) {
  console.error(error instanceof SyntaxError ? "Invalid run document or response" : error.message);
  console.error("No failed state was auto-cleaned. Inspect the run ID and use explicit cleanup.");
  process.exitCode = 1;
}
