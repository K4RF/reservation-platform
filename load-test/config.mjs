import { plan } from "./k6/profiles.js";

export const OWNED = "reservation.load.run";
export const SERVICES = ["mysql", "redis", "kafka", "backend", "fixture"];
export const servicesFor = (workload) => workload.creation === "peer" ? [...SERVICES, "backend-peer"] : SERVICES;
export const VOLUMES = ["mysql-data", "kafka-data", "kafka-config", "kafka-secrets", "media", "fixture-data"];
export const K6 = "grafana/k6:2.0.0@sha256:a33a0cfdc4d2483d6b7a3a22e726a499ff2831a671a49239104cd34a9937523c";
export const hostEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(path|pathext|systemroot|systemdrive|windir|comspec|home|homedrive|homepath|userprofile|appdata|localappdata|programdata|programfiles(?:\(x86\))?|programw6432|temp|tmp|tmpdir|lang)$/i.test(key)));
export const projectOf = (id) => "reservation-load-" + id;
export function validateId(id) {
  if (!/^[a-f0-9]{24}$/.test(id)) throw new Error("Expected the exact generated 24-character run ID");
  return id;
}
export function checkStay(date, now = Date.now()) {
  const ms = Date.parse(date + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(ms) ||
      new Date(ms).toISOString().slice(0, 10) !== date || ms - now < 9 * 86400000 || ms - now > 150 * 86400000)
    throw new Error("The stay start must be a real YYYY-MM-DD between 9 and 150 days from now");
}
export function argumentsFor([action, ...args]) {
  if (!["prepare", "run", "stop", "reset", "cleanup"].includes(action))
    throw new Error("Use prepare, run, stop, reset or cleanup (see load-test/README.md)");
  const supported = action === "prepare" ? ["confirm", "seed", "stay", "profile", "cache", "room", "catalog-size"] : ["confirm"];
  const id = action === "prepare" ? null : validateId(args.shift());
  const values = {};
  while (args.length) {
    const [key, value, extra] = args.shift().split("=");
    if (!key.startsWith("--") || !supported.includes(key.slice(2)) || !value ||
        extra !== undefined || Object.hasOwn(values, key.slice(2))) throw new Error("Unsupported or repeated option");
    values[key.slice(2)] = value;
  }
  if (values.confirm !== (id ?? "isolated"))
    throw new Error("Explicit confirmation required (--confirm=isolated or --confirm=<run ID>)");
  if (action !== "prepare") return { action, id };
  const { seed, stay, profile = "baseline", cache = "warm", room = "distributed" } = values;
  if (!/^[1-9]\d{0,5}$/.test(seed)) throw new Error("Expected integer --seed=1..999999");
  checkStay(stay);
  const catalogSize = values["catalog-size"];
  return { action, seed: Number(seed), stay, profile, cache, room, catalogSize, workload: plan(profile, cache, room, catalogSize) };
}
export function checkManifest(value, id, engine, requireIdentities = true) {
  if (!value || value.schema !== 1 || value.id !== id || value.project !== projectOf(id) ||
      value.engine !== engine || !/^[a-f0-9]{40}$/.test(value.source) || !/^[a-f0-9]{64}$/.test(value.jarSha256) ||
      !Number.isInteger(value.seed) || value.seed < 1 || value.seed > 999999 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value.stay) ||
      !["preparing", "prepared", "running", "passed", "failed"].includes(value.state) ||
      JSON.stringify(plan(value.profile, value.cache, value.room, value.catalogSize)) !== JSON.stringify(value.workload))
    throw new Error("Invalid run manifest or wrong Docker engine");
  if (requireIdentities && ["prepared", "running", "passed"].includes(value.state) &&
      (!/^sha256:[a-f0-9]{64}$/.test(value.generatorImage) ||
        !/^[a-f0-9]{64}$/.test(value.harnessSha256) ||
        !/^[a-f0-9]{64}$/.test(value.network) ||
        servicesFor(value.workload).some((service) => !/^[a-f0-9]{64}$/.test(value.resources?.[service]))))
    throw new Error("Missing manifest resource identities");
  return value;
}

export function checkResource(record, expectedId, kind, services = SERVICES) {
  const project = projectOf(expectedId);
  const labels = kind === "container" ? record.Config.Labels : record.Labels;
  if (labels?.[OWNED] !== expectedId || labels?.["com.docker.compose.project"] !== project)
    throw new Error("Foreign " + kind + " in run scope");
  if (kind === "network" && (record.Name !== project + "_default" || !record.Internal || record.Driver !== "bridge"))
    throw new Error("Run network is not a private bridge");
  if (kind === "volume" && (!VOLUMES.some((name) => record.Name === project + "_" + name) ||
      record.Driver !== "local" || Object.keys(record.Options ?? {}).length))
    throw new Error("Unexpected storage in run scope");
  if (kind === "container") {
    const service = labels["com.docker.compose.service"];
    const suffix = service === "k6" ? "k6" : service + "-1";
    const bindTargets = { backend: ["/app.jar", "/Observe.java"],
      "backend-peer": ["/app.jar", "/Observe.java"],
      fixture: ["/fixture.mjs", "/catalog-cases.mjs", "/detail-cases.mjs", "/stay-cases.mjs", "/creation-cases.mjs"],
      k6: ["/scripts", "/results"] };
    if (![...services, "k6"].includes(service) || record.Name !== "/" + project + "-" + suffix ||
        record.HostConfig.NetworkMode !== project + "_default" ||
        Object.keys(record.HostConfig.PortBindings ?? {}).length ||
        record.HostConfig.Privileged || record.HostConfig.PublishAllPorts ||
        (record.Mounts ?? []).some((m) => {
          if (m.Type === "volume") return !VOLUMES.some((v) => m.Name === project + "_" + v);
          if (m.Type === "bind") return !bindTargets[service]?.includes(m.Destination) ||
            (m.Destination !== "/results" && m.RW);
          return m.Type !== "tmpfs" || service !== "redis" || m.Destination !== "/data";
        }))
      throw new Error("Unexpected service, host exposure, or mount in run scope");
  }
}
