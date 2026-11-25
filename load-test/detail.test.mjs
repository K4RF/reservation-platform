import { deepEqual, equal, rejects, throws } from "node:assert/strict";
import { test } from "node:test";
import { detailBurstCases, detailCases, detailKey, detailMatches, detailReadCase, detailTtlMs } from "./k6/detail-cases.js";
import { classifyDetailSelect, compareDetailReads, detailSqlDelta, expectTtls, withDetailOutage } from "./detail-diagnostics.mjs";
import { plan } from "./k6/profiles.js";
import { checkMeasurement } from "./verification.mjs";

const fixture = detailCases({
  accommodations: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, city: "City", timeZone: "Asia/Seoul" })),
  rooms: Array.from({ length: 24 }, (_, i) => ({ id: i + 1, parent: Math.floor(i / 3) + 1, price: 12345 })),
}, 344);

test("detail fixture uses independently validated ids, media and metadata cases", () => {
  const first = Array.from({ length: 8 }, (_, i) => detailReadCase(fixture, "first", i));
  equal(new Set(first.map(detailKey)).size, 8);
  equal(new Set(detailBurstCases(fixture, "room", "same").map(detailKey)).size, 1);
  equal(new Set(detailBurstCases(fixture, "room", "distinct").map(detailKey)).size, 4);
  equal(detailKey(first[0]), "reservation:cache:v2:accommodation-detail::1");
  equal(detailKey(first[4]), "reservation:cache:v3:room-detail::1");
  throws(() => detailKey({ kind: "room", id: "*" }));
  equal(detailReadCase(fixture, "distributed", 4), fixture.list);
  equal(detailReadCase(fixture, "outage", 4).kind, "accommodation");
  const image = { mediaId: 2, url: "/api/v1/media/2/content" };
  const test = fixture.units[0];
  const body = { roomId: test.id, accommodationId: test.parent, name: test.title, capacity: test.capacity,
    nightlyPrice: test.price, status: "ACTIVE", representativeImage: image, images: [image],
    metadata: { view: "Courtyard", bedConfiguration: "Queen", areaSquareMeters: 28.5 } };
  equal(detailMatches(test, body), true);
  equal(detailMatches(test, { ...body, metadata: null }), false);
  equal(detailMatches(test, { ...body, accommodationId: 8 }), false);
  equal(detailMatches(test, { ...body, images: [] }), false);
});

test("detail workload compares identical rates and rejects extra closed first-pass iterations", () => {
  const p = plan("detail-reads", "cold", "distributed");
  deepEqual(p, plan("detail-reads", "off", "distributed"));
  deepEqual(p, plan("detail-reads", "warm", "distributed"));
  throws(() => plan("detail-outage", "cold", "distributed"));
  throws(() => plan("detail-lifecycle", "warm", "hot"));
  throws(() => plan("detail-reads", "warm", "distributed", "small"));
  equal(detailTtlMs("detail-reads"), 600_000);
  equal(detailTtlMs("detail-lifecycle"), 15_000);
  const result = { offeredIterations: { first: 8, hot: 12 }, scenarioIterations: { first: 8, hot: 13 },
    count: 21, operations: {} };
  checkMeasurement(result, p, 0);
  throws(() => checkMeasurement({ ...result, scenarioIterations: { ...result.scenarioIterations, first: 9 } }, p, 0));
});

test("SQL attribution excludes enrichment/list and reconciles all detail modes and the control", () => {
  equal(classifyDetailSelect("SELECT a . \x60id\x60 FROM \x60accommodations\x60 a WHERE a . \x60id\x60 = ?"), "accommodation");
  equal(classifyDetailSelect("SELECT r.id FROM rooms r WHERE r.id=?"), "room");
  equal(classifyDetailSelect("SELECT DISTINCTROW a . time_zone FROM accommodations a"), "listTimeZone");
  equal(classifyDetailSelect("select a.id from accommodations a order by a.id limit ?"), "listContent");
  equal(classifyDetailSelect("select count(a.id) from accommodations a"), "listCount");
  equal(classifyDetailSelect("select * from catalog_media m where m.room_id=?"), "enrichment");
  const row = { kind: "room", calls: 8, timerPs: 90, rowsExamined: 8 };
  deepEqual(detailSqlDelta({ abc: row }, { abc: { ...row, calls: 9, timerPs: 150, rowsExamined: 9 } }),
    { room: { calls: 1, timerPs: 60, rowsExamined: 1 } });
  const result = { operations: { "detail.accommodation.media": { success: 12 },
    "detail.room.plain": { success: 8 }, "control.catalog": { success: 3 } } };
  const control = { listContent: { calls: 3 }, listTimeZone: { calls: 3 } };
  equal(compareDetailReads(result, control, "warm").room.dbBypassFraction, 1);
  equal(compareDetailReads(result, { ...control, room: { calls: 4 }, accommodation: { calls: 4 } }, "cold").room.dbBypassFraction, .5);
  equal(compareDetailReads(result, { ...control, room: { calls: 8 }, accommodation: { calls: 12 } }, "off").room.dbBypassFraction, 0);
  throws(() => compareDetailReads(result, { ...control, room: { calls: 8 } }, "off"));
  throws(() => compareDetailReads(result, { ...control, listTimeZone: { calls: 2 } }, "warm"));
  expectTtls([-2, -2]);
  expectTtls([400, 420], 500);
  throws(() => expectTtls([400, -2], 500));
});

test("outage acts only on verified Redis and restores it after a failed measurement", async () => {
  let running = true;
  const ops = [];
  const run = { resources: () => ({ services: { redis: { Id: "owned-redis",
    State: { Running: running, Health: { Status: running ? "healthy" : "unhealthy" } } } } }),
    docker: (cmd) => { ops.push(cmd); running = cmd[0] === "start"; } };
  await rejects(withDetailOutage(run, "different-redis", () => {}), /target changed/);
  deepEqual(ops, []);
  await rejects(withDetailOutage(run, "owned-redis", () => {
    equal(running, false);
    throw new Error("probe failure");
  }), /probe failure/);
  deepEqual(ops, [["stop", "--time", "3", "owned-redis"], ["start", "owned-redis"]]);
  equal(running, true);
});
