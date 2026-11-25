import { setTimeout as delay } from "node:timers/promises";
import { detailBurstCases, detailKey } from "./k6/detail-cases.js";

const pairs = (cases) => [cases.hotels[0], cases.units[0]];
const details = ({ hotels, units }) => [...hotels, ...units];

export function classifyDetailSelect(statement) {
  const query = statement.replaceAll("\x60", "").replace(/\s*\.\s*/g, ".").trim();
  if (!/^select\s/i.test(query)) return null;
  if (/\bfrom\s+(accommodations|rooms)\s+(\w+)\s+where\s+\2\.id\s*=\s*\?(?:\s|$)/i.test(query))
    return /\bfrom\s+accommodations\b/i.test(query) ? "accommodation" : "room";
  if (/\bfrom\s+accommodations\b/i.test(query)) {
    if (/^select\s+distinct(?:row)?\s+(?:\w+\.)?time_zone\b/i.test(query)) return "listTimeZone";
    return /^select\s+count\s*\(/i.test(query) ? "listCount" : "listContent";
  }
  if (/\bfrom\s+(catalog_media|accommodation_amenities|room_amenities)\b/i.test(query)) return "enrichment";
  return null;
}

function digestSnapshot({ sql }) {
  const rows = sql(
    "SELECT JSON_OBJECT('id',DIGEST,'text',DIGEST_TEXT,'calls',COUNT_STAR,'timerPs',SUM_TIMER_WAIT," +
    "'rowsExamined',SUM_ROWS_EXAMINED) FROM performance_schema.events_statements_summary_by_digest " +
    "WHERE SCHEMA_NAME='reservation_load' AND DIGEST IS NOT NULL;");
  return Object.fromEntries(rows.split(/\r?\n/).filter(Boolean).flatMap((line) => {
    const { text, id, ...counters } = JSON.parse(line);
    const kind = classifyDetailSelect(text);
    return kind ? [[id, { kind, ...counters }]] : [];
  }));
}

export function detailSqlDelta(before, after) {
  const result = {};
  for (const [id, now] of Object.entries(after)) {
    const totals = result[now.kind] ??= { calls: 0, timerPs: 0, rowsExamined: 0 };
    for (const key of Object.keys(totals)) {
      const change = now[key] - (before[id]?.[key] ?? 0);
      if (change < 0) throw new Error("Detail SQL counter moved backwards");
      totals[key] += change;
    }
  }
  return result;
}
export const countSql = (sql, kind) => sql[kind]?.calls ?? 0;
export const detailSnapshot = digestSnapshot;

export function compareDetailReads(result, sql, cache, profile = "reads") {
  const counts = Object.fromEntries(["accommodation", "room"].map((kind) => [kind, Object.entries(result.operations)
    .filter(([name]) => name.startsWith("detail." + kind + "."))
    .reduce((sum, [, group]) => sum + (group.success ?? 0), 0)]));
  const control = result.operations["control.catalog"]?.success ?? 0;
  if (!counts.accommodation || !counts.room || (profile === "reads" ? !control : control) ||
      countSql(sql, "listTimeZone") !== control || countSql(sql, "listContent") !== control)
    throw new Error("Detail/list measurement did not reconcile");
  return Object.fromEntries(Object.entries(counts).map(([kind, requests]) => {
    const loads = countSql(sql, kind);
    const expected = profile === "outage" || cache === "off" ? requests : cache === "cold" ? 4 : 0;
    if (loads !== expected) throw new Error("Detail SQL mismatch: " + kind + ", expected " + expected + ", observed " + loads);
    return [kind, { requests, loads, dbBypassFraction: (requests - loads) / requests }];
  }));
}

const cli = (run, ...args) => run.compose(["exec", "-T", "redis", "redis-cli", "--raw", ...args]);
const keysOf = (group) => [...new Set(group.map(detailKey))];
const readTtls = 'local t={} for i,k in ipairs(KEYS) do t[i]=redis.call("PTTL",k) end return t';
export function detailTtls(run, group) {
  const keys = keysOf(group);
  const ttl = cli(run, "EVAL_RO", readTtls, String(keys.length), ...keys).split(/\r?\n/).map(Number);
  if (ttl.length !== keys.length || !ttl.every(Number.isSafeInteger)) throw new Error("Unexpected Redis TTL response");
  return ttl;
}
export function expectTtls(ttl, max = 0) {
  if (!ttl.length || !ttl.every((ms) => max ? ms > 0 && ms <= max : ms === -2))
    throw new Error("Unexpected initial/final detail cache TTL state: " + ttl.join(","));
  return ttl;
}
function clearKeys(run, group) {
  run.resources(true);
  const keys = keysOf(group);
  if (!keys.length || keys.length > 8) throw new Error("Unexpected number of dedicated detail keys");
  const removed = Number(cli(run, "DEL", ...keys));
  if (!Number.isSafeInteger(removed) || removed < 0 || removed > keys.length) throw new Error("Detail DEL failed");
  return removed;
}
export function prepareDetail(run, cases, cache, maxTtl) {
  const group = details(cases);
  const warmCheck = expectTtls(detailTtls(run, group), cache === "off" ? 0 : maxTtl);
  const cleared = cache === "cold" ? clearKeys(run, group) : 0;
  const initialTtl = expectTtls(detailTtls(run, group), cache === "warm" ? maxTtl : 0);
  return { warmCheck, cleared, initialTtl };
}
export const detailFinalTtls = (run, cases, maxTtl) => expectTtls(detailTtls(run, details(cases)), maxTtl);

export function redisDetailCounters(run) {
  const commandStats = cli(run, "INFO", "commandstats");
  const memory = cli(run, "INFO", "memory").match(/^used_memory:(\d+)\r?$/m)?.[1];
  if (!memory || !commandStats.includes("# Commandstats")) throw new Error("Redis counters unavailable");
  const commands = {};
  for (const line of commandStats.split(/\r?\n/)) {
    const m = /^cmdstat_(get|exists|set|del|pttl):calls=(\d+),usec=(\d+)/.exec(line);
    if (m) commands[m[1]] = { calls: Number(m[2]), usec: Number(m[3]) };
  }
  return { commands, memoryBytes: Number(memory) };
}
export function redisDetailDelta(before, after) {
  const commands = Object.fromEntries(Object.entries(after.commands).map(([name, stats]) => {
    const calls = stats.calls - (before.commands[name]?.calls ?? 0);
    const usec = stats.usec - (before.commands[name]?.usec ?? 0);
    if (calls < 0 || usec < 0) throw new Error("Redis counters reset in measurement");
    return [name, { calls, usec, usecPerCall: calls ? usec / calls : null }];
  }));
  return { commands, beforeMemoryBytes: before.memoryBytes, afterMemoryBytes: after.memoryBytes };
}

export function runDetailBursts(run, cases, maxTtl) {
  const out = {};
  for (const kind of ["accommodation", "room"]) for (const mode of ["same", "distinct"]) {
    const group = detailBurstCases(cases, kind, mode);
    clearKeys(run, group);
    const beforeTtl = expectTtls(detailTtls(run, group));
    const before = detailSnapshot(run);
    const redisBefore = redisDetailCounters(run);
    const requests = JSON.parse(run.fixture("detail-burst", kind, mode));
    const redis = redisDetailDelta(redisBefore, redisDetailCounters(run));
    const sql = detailSqlDelta(before, detailSnapshot(run));
    const afterTtl = expectTtls(detailTtls(run, group), maxTtl);
    const loads = countSql(sql, kind);
    if (requests.length !== 4 || loads < keysOf(group).length || loads > requests.length)
      throw new Error("Burst SQL/HTTP count mismatch");
    out[kind + "." + mode] = { requests, loads, beforeTtl, afterTtl, sql, redis };
  }
  return out;
}

function verifyPairRead(run, cases, maxTtl, previouslyCached, updated = false) {
  const before = detailSnapshot(run);
  const probes = JSON.parse(run.fixture(updated ? "detail-pair-updated" : "detail-pair"));
  const sql = detailSqlDelta(before, detailSnapshot(run));
  if (probes.length !== 2 || ["accommodation", "room"].some((kind) => countSql(sql, kind) !== Number(!previouslyCached)))
    throw new Error("Unexpected DB loads for detail pair");
  return { probes, sql, ttl: expectTtls(detailTtls(run, pairs(cases)), maxTtl) };
}

export async function runDetailLifecycle(run, cases, maxTtl, stop) {
  const group = pairs(cases);
  const initial = expectTtls(detailTtls(run, group), maxTtl);
  const began = Date.now();
  const warmRead = verifyPairRead(run, cases, maxTtl, true);
  if (warmRead.ttl.some((ttl, i) => ttl >= initial[i])) throw new Error("Read unexpectedly reset TTL");
  // Wait for natural expiry from the configured test TTL, never PEXPIRE or FLUSH.
  let expired = warmRead.ttl;
  while (expired.some((ms) => ms !== -2)) {
    if (stop() || Date.now() - began > maxTtl + 3000) throw new Error("Stopped or TTL expiration not observed");
    await delay(Math.min(1200, Math.max(100, ...expired) + 100));
    expired = detailTtls(run, group);
  }
  const elapsedMs = Date.now() - began;
  const reload = verifyPairRead(run, cases, maxTtl, false);
  if (reload.ttl.some((ms) => ms < maxTtl / 2)) throw new Error("Repopulated TTL unexpectedly short");
  if (stop()) throw new Error("Stopped before advancing to isolated update");
  run.resources(true);
  run.fixture("detail-update");
  const afterCommit = expectTtls(detailTtls(run, group));
  const updated = verifyPairRead(run, cases, maxTtl, false, true);
  const updatedHit = verifyPairRead(run, cases, maxTtl, true, true);
  return { expiration: { initial, warmRead, elapsedMs, expired, reload },
    eviction: { afterCommit, updated, updatedHit } };
}

export async function withDetailOutage(run, redisId, measure) {
  const redis = (healthy = false) => {
    const target = run.resources(healthy).services.redis;
    if (!target || target.Id !== redisId) throw new Error("Redis outage target changed");
    return target;
  };
  redis(true);
  try {
    run.docker(["stop", "--time", "3", redisId], { label: "Stop this run's Redis" });
    if (redis().State.Running) throw new Error("This run's Redis did not stop");
    return await measure();
  } finally {
    if (!redis().State.Running) run.docker(["start", redisId], { label: "Restart this run's Redis" });
    for (let i = 0; redis().State.Health?.Status !== "healthy"; i++) {
      if (i === 20) throw new Error("Redis did not recover; use guarded cleanup");
      await delay(500);
    }
    redis(true);
  }
}

export function verifyDetailRecovery(run, cases, maxTtl) {
  const empty = expectTtls(detailTtls(run, pairs(cases)));
  const reload = verifyPairRead(run, cases, maxTtl, false);
  const warm = verifyPairRead(run, cases, maxTtl, true);
  return { empty, reload, warm };
}
