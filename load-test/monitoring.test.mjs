import { test } from "node:test";
import assert from "node:assert/strict";
import { argumentsFor, checkManifest, checkResource, MONITOR_IMAGES, OWNED, projectOf, servicesFor } from "./config.mjs";
import { plan } from "./k6/profiles.js";
import { monitoringProbe } from "../infra/observability/probe.mjs";

const id = "a".repeat(24);
const project = projectOf(id);
const services = servicesFor({}, "on");
const sources = { scrape: "/owned/scrape.secret", prometheus: "/reviewed/prometheus.yml" };
const plus = { [OWNED]: id, "com.docker.compose.project": project };
const prometheus = {
  Name: "/" + project + "-prometheus-1",
  Config: { Labels: { ...plus, "com.docker.compose.service": "prometheus" }, Image: MONITOR_IMAGES.prometheus },
  NetworkSettings: { Networks: { [project + "_default"]: {} } },
  HostConfig: { NetworkMode: project + "_default" },
  Mounts: [
    { Type: "bind", Source: sources.scrape, Destination: "/run/monitoring/scrape.secret", RW: false },
    { Type: "bind", Source: sources.prometheus, Destination: "/etc/prometheus/prometheus.yml", RW: false },
    { Type: "volume", Name: project + "_prometheus-data", Destination: "/prometheus", RW: true },
  ],
};

test("monitoring is explicitly selected, single-backend, and manifest-pinned", () => {
  const stay = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const command = ["prepare", "--confirm=isolated", "--seed=358", "--stay=" + stay, "--profile=smoke"];
  assert.equal(argumentsFor(command).monitoring, undefined);
  assert.equal(argumentsFor([...command, "--monitoring=on"]).monitoring, "on");
  assert.throws(() => argumentsFor([...command, "--monitoring=true"]));
  assert.throws(() => argumentsFor([...command.slice(0, -1), "--profile=create-peer", "--cache=off", "--room=hot", "--monitoring=on"]));
  assert.throws(() => argumentsFor(["monitor-check", id, "--confirm=" + id, "--target=http://backend:9091"]));
  const hash = "b".repeat(64);
  const fixture = { schema: 1, id, project, engine: "engine", source: "a".repeat(40), jarSha256: hash,
    network: hash, generatorImage: "sha256:" + hash, harnessSha256: hash, monitoring: "on", seed: 358, stay,
    state: "prepared", profile: "smoke", cache: "warm", room: "distributed", workload: plan("smoke", "warm", "distributed"),
    resources: Object.fromEntries(services.map((svc) => [svc, hash])),
    images: { prometheus: "sha256:" + hash, grafana: "sha256:" + hash } };
  assert.doesNotThrow(() => checkManifest(fixture, id, "engine"));
  assert.throws(() => checkManifest({ ...fixture, images: {} }, id, "engine"), /identities/);
});

test("monitoring denies foreign identity, config mount, extra network or host exposure", () => {
  const check = (record) => checkResource(record, id, "container", services, sources);
  assert.doesNotThrow(() => check(prometheus));
  assert.throws(() => checkResource(prometheus, id, "container"), /Unexpected service/);
  for (const mutate of [
    (v) => { v.Config.Image = "prom/prometheus:latest"; },
    (v) => { v.Config.Labels[OWNED] = "foreign"; },
    (v) => { v.HostConfig.PortBindings = { "9090/tcp": [{ HostIp: "127.0.0.1" }] }; },
    (v) => { v.NetworkSettings.Networks.development = {}; },
    (v) => { v.Mounts[0].Source = "/foreign/secret"; },
    (v) => { v.Mounts[1].RW = true; },
    (v) => { v.Mounts.pop(); },
  ]) {
    const record = structuredClone(prometheus);
    mutate(record);
    assert.throws(() => check(record));
  }
});

test("probe preserves fresh collected evidence, rejects timeout/stale/missing series without exposing credentials", async () => {
  const clock = 1_800_000_000;
  const pass = (url, options, freshness = clock - 12) => {
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    const u = new URL(url);
    const auth = options.headers.Authorization;
    let status = 200, body;
    if (u.hostname === "prometheus") {
      const expr = u.searchParams.get("query");
      const value = expr.startsWith("timestamp") ? freshness : expr.startsWith("up") ? 1 : expr.startsWith("scrape_duration") ? 0.2 : 110;
      body = { status: "success", data: { resultType: "vector",
        result: freshness === null ? [] : [{ metric: { job: "reservation", instance: "backend:9091" }, value: [clock, String(value)] }] } };
    } else if (u.hostname === "grafana") {
      if (!auth) status = 401;
      else body = u.pathname.endsWith("/health") ? { status: "OK" } :
        { type: "prometheus", uid: "reservation-prometheus", url: "http://prometheus:9090" };
    } else {
      assert.equal(u.hostname, "backend");
      if (!auth || u.port === "8080" || u.pathname.endsWith("/env")) status = 401;
      else body = u.pathname === "/actuator/health" ?
        { status: "UP", groups: ["liveness", "readiness"] } : { status: "UP" };
    }
    return Promise.resolve({ status, json: async () => body });
  };
  const fake = { scrape: "synthetic-credential", grafana: "synthetic-credential-2" };
  const probe = (f) => monitoringProbe(fake, f, () => clock * 1000);
  const good = await probe(pass);
  assert.equal(good.samples, 110);
  assert.equal(good.datasource.healthy, true);
  assert.doesNotMatch(JSON.stringify(good), /synthetic|Basic/);
  await assert.rejects(probe((u, o) => pass(u, o, clock - 45)), /stale/);
  await assert.rejects(probe((u, o) => pass(u, o, null)), /unavailable/);
  await assert.rejects(probe((u, o) => u.endsWith("/actuator/health") ?
    Promise.resolve({ status: 200, json: async () => ({ status: "UP", components: { db: { status: "UP" } } }) }) :
    pass(u, o)), /details/);
  await assert.rejects(probe(async () => { throw new DOMException("internal timeout", "TimeoutError"); }), { name: "TimeoutError" });
});
