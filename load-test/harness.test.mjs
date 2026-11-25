import { deepEqual, equal, throws } from "node:assert/strict";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { argumentsFor, checkManifest, checkResource, checkStay, OWNED, projectOf, SERVICES } from "./config.mjs";
import { plan } from "./k6/profiles.js";
import { summarize } from "./metrics.mjs";
import { checkInvariants, checkMeasurement } from "./verification.mjs";
import { pollDelta, pollSnapshot } from "./outbox-poll.mjs";

const id = "b".repeat(24);
const project = projectOf(id);
const labels = { [OWNED]: id, "com.docker.compose.project": project };

test("no arbitrary URL/production address, implicit confirmation or path traversal", () => {
  throws(() => argumentsFor(["prepare"]));
  throws(() => argumentsFor(["run", "../develop", "--confirm=../develop"]));
  throws(() => argumentsFor(["run", id, "--confirm=isolated"]));
  throws(() => argumentsFor(["run", id, "--confirm=" + id, "--target=https://production.example.test"]));
  throws(() => argumentsFor(["run", id, "--confirm=" + id + "=http://localhost:8080"]));
  deepEqual(argumentsFor(["cleanup", id, "--confirm=" + id]), { action: "cleanup", id });
});

test("manifest and isolation metadata reject foreign engine, labels, names and exposure", () => {
  const m = { schema: 1, id, project, engine: "local", source: "a".repeat(40), jarSha256: "a".repeat(64),
    seed: 342, stay: "2026-12-28", state: "prepared", profile: "baseline", cache: "warm",
    room: "distributed", workload: plan("baseline", "warm", "distributed"),
    network: "c".repeat(64), generatorImage: "sha256:" + "c".repeat(64), harnessSha256: "c".repeat(64),
    resources: Object.fromEntries(SERVICES.map((service) => [service, "c".repeat(64)])) };
  equal(checkManifest(m, id, "local"), m);
  throws(() => checkManifest(m, id, "other"), /manifest/);
  throws(() => checkManifest({ ...m, workload: { ...m.workload, writers: 99 } }, id, "local"), /manifest/);
  const network = { Name: project + "_default", Internal: true, Driver: "bridge", Labels: labels };
  checkResource(network, id, "network");
  throws(() => checkResource({ ...network, Name: "develop_default" }, id, "network"));
  throws(() => checkResource({ ...network, Internal: false }, id, "network"));
  const volume = { Name: project + "_mysql-data", Driver: "local", Labels: labels };
  checkResource(volume, id, "volume");
  throws(() => checkResource({ ...volume, Labels: {} }, id, "volume"));
  throws(() => checkResource({ ...volume, Options: { device: "external" } }, id, "volume"));
  const container = { Name: "/" + project + "-backend-1",
    Config: { Labels: { ...labels, "com.docker.compose.service": "backend" } },
    HostConfig: { NetworkMode: network.Name, PortBindings: {} } };
  checkResource(container, id, "container");
  throws(() => checkResource({ ...container, HostConfig: { ...container.HostConfig,
    PortBindings: { "8080/tcp": [{ HostPort: "8080" }] } } }, id, "container"));
  throws(() => checkResource({ ...container, HostConfig: { NetworkMode: "host" } }, id, "container"));
});

test("cache and capacity experiment boundaries are explicit", () => {
  throws(() => plan("exhaustion", "warm", "distributed"));
  throws(() => plan("mixed", "cold", "hot"));
  deepEqual(plan("read-heavy", "cold", "distributed"), { reads: 8 });
  checkStay("2026-12-28", Date.parse("2026-11-23T00:00:00Z"));
  throws(() => checkStay("2026-11-31", Date.parse("2026-11-01T00:00:00Z")));
  throws(() => checkStay("2026-11-24", Date.parse("2026-11-23T00:00:00Z")));
});

test("Outbox comparison accepts only bounded lifecycle settings at prepare and manifest validation", () => {
  const stay = new Date(Date.now() + 35 * 86400000).toISOString().slice(0, 10);
  const args = ["prepare", "--confirm=isolated", "--seed=347", "--stay=" + stay, "--cache=off"];
  const lifecycle = [...args, "--profile=lifecycle-write"];
  equal(argumentsFor([...lifecycle, "--outbox-poll=1s"]).outboxPoll, "1s");
  equal(argumentsFor([...lifecycle, "--outbox-poll=250ms"]).outboxPoll, "250ms");
  equal(argumentsFor(lifecycle).outboxPoll, undefined);
  throws(() => argumentsFor([...lifecycle, "--outbox-poll=1ms"]));
  throws(() => argumentsFor([...args, "--profile=lifecycle-broker-down", "--outbox-poll=250ms"]));
  throws(() => argumentsFor(["run", id, "--confirm=" + id, "--outbox-poll=1s"]));

  const manifest = { schema: 1, id, project, engine: "local", source: "a".repeat(40), jarSha256: "a".repeat(64),
    seed: 347, stay, state: "prepared", profile: "lifecycle-history", cache: "off", room: "distributed",
    outboxPoll: "250ms", workload: plan("lifecycle-history", "off", "distributed") };
  equal(checkManifest(manifest, id, "local", false), manifest);
  throws(() => checkManifest({ ...manifest, outboxPoll: "2s" }, id, "local", false));
});

test("Outbox poll deltas retain empty-query cost and reject absent or reset counters", () => {
  const before = { sampledAtMs: 1000, polls: 12, statementPs: 2e9, rowsSent: 4, rowsExamined: 6 };
  const after = { ...before, sampledAtMs: 7000, polls: 35, statementPs: 5e9 };
  deepEqual(pollSnapshot((sql) => {
    equal(sql.includes("events_statements_summary_by_digest"), true);
    equal(sql.includes("RESERVATION_OUTBOX_EVENTS% FOR UPDATE"), true);
    return JSON.stringify(after);
  }), after);
  deepEqual(pollDelta(before, after), { wallMs: 6000, polls: 23, pollsPerSecond: 23 / 6,
    statementMs: 3, rowsSent: 0, rowsExamined: 0 });
  throws(() => pollDelta(before, { ...after, polls: before.polls }));
  throws(() => pollDelta(before, { ...after, statementPs: 0 }));
});

test("expected rejection remains in HTTP error rate and endpoint histograms", () => {
  const dir = mkdtempSync(join(tmpdir(), "reservation-load-test-"));
  const path = join(dir, "sample.jsonl");
  const records = [20, 2, 4, 30].flatMap((value, i) => {
    const tags = { name: "reservation.create", scenario: "write", status: i ? "409" : "201" };
    const point = (metric, value, tags) => ({ type: "Point", metric, data: {
      value, tags, time: new Date(i * 1000).toISOString(),
    } });
    return [point("http_req_duration", value, tags), point("http_reqs", 1, tags),
      point("load_operations", 1, { ...tags, outcome: i ? "expected_rejection" : "success",
        domain: i ? "INVENTORY_005" : "none_or_other" }), point("iterations", 1, tags)];
  });
  writeFileSync(path, records.map((point) => JSON.stringify(point)).join("\n"), { flag: "wx" });
  try {
    const results = summarize(path, plan("exhaustion", "warm", "hot"));
    equal(results.count, 4);
    deepEqual(results.operations["reservation.create"], { success: 1, expected_rejection: 3 });
    deepEqual(results.offeredIterations, { read: 0, write: 4 });
    const endpoint = results.durations["write/reservation.create"];
    equal(endpoint.httpErrorRate, 0.75);
    equal(endpoint.p50, 4);
    equal(endpoint.p99, 30);
    equal(endpoint.p99Sparse, true);
    const before = { reservations: 4, confirmed: 4, cancelled: 0, outbox: 4 };
    const after = { reservations: 5, confirmed: 5, cancelled: 0, outbox: 5, processed: 5 };
    checkInvariants(before, after, results, "exhaustion");
    throws(() => checkInvariants(before, { ...after, inventoryMismatch: 1 }, results, "exhaustion"));
    throws(() => checkInvariants(before, { ...after, processed: 4 }, results, "exhaustion"));
  } finally {
    unlinkSync(path);
    rmdirSync(dir);
  }
});

test("only the open workload allows one end-boundary arrival, never a deficit or drop", () => {
  const p = plan("read-heavy", "warm", "distributed");
  const observed = { count: 100, dropped: 0, transportErrors: 0, operations: {},
    offeredIterations: { read: 24, write: 0 }, scenarioIterations: { read: 25 } };
  checkMeasurement(observed, p, 0);
  throws(() => checkMeasurement({ ...observed, dropped: 1 }, p, 0));
  throws(() => checkMeasurement({ ...observed, scenarioIterations: { read: 23 } }, p, 0));
  throws(() => checkMeasurement({ ...observed, scenarioIterations: { read: 26 } }, p, 0));
  throws(() => checkMeasurement(observed, plan("baseline", "warm", "distributed"), 0));
  throws(() => checkMeasurement(observed, p, 1));
});
