import { deepEqual, equal, throws } from "node:assert/strict";
import { test } from "node:test";
import { stayMatches, stayMatrix, stayRows, zoneBoundary } from "./k6/stay-cases.js";
import { plan } from "./k6/profiles.js";
import { classifyStaySelect, stayChecksums, verifyStayRead } from "./stay-diagnostics.mjs";
import { seedStay } from "./stay-seed.mjs";

const stay = "2026-12-30", epoch = Date.parse("2026-11-25T10:30:00Z");
const boundary = zoneBoundary(stay, epoch);

test("fixture distinguishes the exclusive checkout, every occupied date and the capacity boundary", () => {
  const model = stayRows(345, stay, "small", boundary);
  const cases = stayMatrix(model);
  const page = (name) => cases.availability.find((item) => item.name === "availability." + name).expected;
  deepEqual([page("short_hot").total, page("medium_hot").total, page("long_hot").total], [30, 15, 10]);
  equal(page("long_hot").rooms.some(({ id }) => id === 20007), true);
  equal(model.hotels.hot.rooms[7].inventory[7], "closed");
  equal(model.hotels.hot.rooms[2].inventory[1], "missing");
  equal(model.hotels.hot.rooms[3].inventory[1], "closed");
  equal(model.hotels.hot.rooms[4].inventory[1], "empty");
  equal(page("spread").rooms.some(({ capacity }) => capacity === 2), true);
  deepEqual([page("empty_guests").total, page("inactive").total], [0, 0]);
  equal(page("deep_hot").page, 6);
  const expanded = stayMatrix(stayRows(345, stay, "expanded", boundary));
  equal(expanded.availability.find(({ name }) => name === "availability.deep_hot").expected.page, 29);
});

test("advance limits use two different hotel dates at one instant", () => {
  deepEqual(boundary, { west: "2026-11-24", east: "2026-11-26", min: 36, max: 37 });
  const { hotels } = stayRows(345, stay, "small", boundary);
  deepEqual(hotels.west.policy, hotels.east.policy);
  const { controls } = stayMatrix(stayRows(345, stay, "small", boundary));
  const check = controls.find(({ name }) => name === "control.advance_timezone");
  equal(check.status, 409);
  equal(stayMatches(check, { code: "BOOKING_POLICY_007" }), true);
  equal(stayMatches(check, { code: "BOOKING_POLICY_008" }), false);
});

test("journey preserves daily/default IDs and cannot turn a daily price into a stay total", () => {
  const { journeys } = stayMatrix(stayRows(345, stay, "small", boundary));
  const [{ test: page, byRoom }] = journeys;
  const id = page.expected.rooms[0].id, [daily, fallback] = byRoom[id];
  const result = (p) => ({ roomId: id, stayDate: p.expected.date, nightlyPrice: p.expected.price,
    source: p.expected.source, roomDailyPriceId: p.expected.overrideId });
  deepEqual([daily.expected.source, fallback.expected.source], ["DAILY", "DEFAULT"]);
  equal(stayMatches(daily, result(daily)), true);
  equal(stayMatches(fallback, result(fallback)), true);
  equal(stayMatches(fallback, { ...result(fallback), roomDailyPriceId: daily.expected.overrideId }), false);
  equal(stayMatches(daily, { ...result(daily), nightlyPrice: daily.expected.price + fallback.expected.price }), false);
  equal(byRoom[id + 1], undefined);
});

test("stay workload and deterministic insert scope are bounded", () => {
  const p = plan("stay-availability", "off", "distributed", "small");
  deepEqual(p.stayFixture.nights, [1, 3, 7]);
  deepEqual(p.stages, plan("stay-price", "off", "distributed", "expanded").stages);
  throws(() => plan("stay-journey", "warm", "distributed", "expanded"));
  throws(() => plan("stay-availability", "off", "hot", "small"));
  throws(() => plan("stay-availability", "off", "distributed", "unbounded"));
  const statements = [];
  const details = seedStay((sql) => statements.push(sql), 345, stay, "small", epoch);
  equal(details.added.rooms, 80);
  equal(details.added.dailyPrices, 100);
  equal(details.added.inventories, 700);
  equal(statements.length, 1);
  equal(/^\s*START TRANSACTION;[\s\S]*COMMIT;$/.test(statements[0]), true);
  throws(() => stayChecksums(() => "reservation_load.rooms\t123"));
});

test("SQL attribution separates counts and accounts for the 1+2 journey", () => {
  const samples = [
    ["SELECT COUNT(r.id) FROM rooms r WHERE (SELECT COUNT(i.id) FROM room_inventories i)>0", "availabilityCount"],
    ["SELECT r.id FROM rooms r JOIN accommodations a ON a.id=r.accommodation_id WHERE (SELECT COUNT(i.id) FROM room_inventories i)>0", "availabilityContent"],
    ["select p.id from accommodation_booking_policies p where p.accommodation_id=?", "bookingPolicy"],
    ["select a.id from accommodations a where a . id = ?", "accommodation"],
    ["select r.id from rooms r where r.id=?", "room"],
    ["select d.id from room_daily_prices d where d.room_id=?", "dailyPrice"],
  ];
  for (const [q, kind] of samples) equal(classifyStaySelect(q), kind);
  equal(classifyStaySelect("update rooms set nightly_price=1"), null);
  const result = { operations: { "availability.medium_hot": { success: 2 },
    "price.journey_daily": { success: 2 }, "price.journey_default": { success: 2 } }, count: 6 };
  const types = { "availability.medium_hot": "page", "price.journey_daily": "DAILY", "price.journey_default": "DEFAULT" };
  const totals = Object.fromEntries(["accommodation", "bookingPolicy", "availabilityContent", "room", "dailyPrice"]
    .map((kind, n) => [kind, { calls: n < 3 ? 2 : 4 }]));
  deepEqual(verifyStayRead("journey", result, { totals }, types), { availability: 2, price: 4, DAILY: 2, DEFAULT: 2 });
  throws(() => verifyStayRead("journey", result, { totals: { ...totals, dailyPrice: { calls: 2 } } }, types));
});
