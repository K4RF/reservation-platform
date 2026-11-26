import { test } from "node:test";
import assert from "node:assert/strict";
import { plan } from "./k6/profiles.js";
import { cycleInput, explorationNames, journeyKind } from "./k6/lifecycle-cases.js";
import { reconcileLifecycle } from "./lifecycle-verification.mjs";
import { checkInvariants } from "./verification.mjs";

const fixture = {
  days: ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"],
  rooms: Array.from({ length: 24 }, (_, i) => ({ id: i + 1, price: 10000, firstPrice: 11000, thirdPrice: 11800 })),
  accounts: Array.from({ length: 8 }, (_, i) => ({ memberId: i + 1 })),
};
const exploration = (n) => Object.fromEntries(explorationNames.map((endpoint) => ["explore." + endpoint, { success: n }]));

test("final workloads preserve deliberate mix, distinct owners and the finite hold bound", () => {
  const steady = plan("final-mixed", "warm", "distributed").stages;
  assert.deepEqual(plan("final-mixed", "cold", "distributed").stages, steady);
  assert.deepEqual(plan("final-mixed", "warm", "hot").stages, steady);
  assert.throws(() => plan("final-mixed", "off", "distributed"));
  assert.throws(() => plan("final-stability", "warm", "hot"));
  assert.throws(() => plan("final-read", "warm", "distributed", "expanded"));
  const hold = plan("final-stability", "warm", "distributed").stages.at(-1);
  assert.deepEqual(hold, { name: "hold", rate: 1, seconds: 90, at: 16, vus: 4 });
  assert.equal(steady.reduce((n, s) => n + s.vus, 0), fixture.accounts.length);
  assert.deepEqual(Array.from({ length: 5 }, (_, i) => journeyKind("mixed", i)),
    ["browse", "browse", "browse", "keep", "cycle"]);
  assert.equal(journeyKind("read", 4), "browse");
  const distributed = cycleInput(fixture, "hold", 90, 3);
  const hot = cycleInput(fixture, "hold", 90, 3, "hot");
  assert.equal(distributed.ordinal, 691);
  assert.equal(distributed.created.memberId, hot.created.memberId);
  assert.notEqual(distributed.created.roomId, hot.created.roomId);
});

test("mixed persistence distinguishes confirmed inventory from a completed lifecycle", () => {
  const a = cycleInput(fixture, "low", 3, 0, "hot"), b = cycleInput(fixture, "low", 4, 1, "hot");
  const inventory = fixture.days.map((date) => ({ roomId: 1, date, reserved: 0, version: 0 }));
  const finalRow = (stay, ordinal, reservationId, state) => ({ ...stay, ordinal, reservationId, status: state,
    stayNights: 2, nightlyPriceSnapshot: stay.nights[0].priceSnapshot, freeDays: 180, deadlineDays: 1,
    cancelledAt: state === "CANCELLED" ? "2026-11-26T00:00:00Z" : null,
    fee: state === "CANCELLED" ? stay.fee : null, refund: state === "CANCELLED" ? stay.totalAmount - stay.fee : null });
  const current = { reservations: [finalRow(a.created, a.ordinal, 5, "CONFIRMED"),
    finalRow(b.changed, b.ordinal, 6, "CANCELLED")],
  inventory: inventory.map((row, i) => ({ ...row, reserved: i < 2 ? 1 : 0, version: [3, 3, 2, 0, 0][i] })) };
  const ledgerFor = (a, id, iteration, ops) => ops.flatMap((op) => {
    const context = { ordinal: a.ordinal, ownerIndex: a.ownerIndex, scenario: "low", iteration, op };
    return [{ ...context, event: "dispatch", id: op === "create" ? null : id },
      { ...context, event: "response", outcome: "success", status: op === "create" ? 201 : 200, reservationId: id }];
  });
  const events = [[5, "CREATED"], [6, "CREATED"], [6, "CHANGED"], [6, "CANCELLED"]]
    .map(([aggregateId, eventType], i) => ({ id: i + 5, aggregateId, eventType }));
  const summary = { scenarioIterations: { low: 5 }, operations: { ...exploration(5), "lifecycle.owner_detail": { success: 2 },
    "lifecycle.create": { success: 2 }, "lifecycle.change": { success: 1 }, "lifecycle.cancel": { success: 1 } } };
  const run = { mode: "mixed", roomMode: "hot", first: { fixture, watermarks: { reservation: 4 }, inventory },
    previous: { reservations: [] }, current, events, summary,
    ledger: [...ledgerFor(a, 5, 3, ["create"]), ...ledgerFor(b, 6, 4, ["create", "change", "cancel"])] };
  const result = reconcileLifecycle(run);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.journeys, { browse: 3, keep: 1, cycle: 1 });
  assert.deepEqual(result.counts, { create: 2, change: 1, cancel: 1 });
  const before = { reservations: 4, confirmed: 4, cancelled: 0, outbox: 4 };
  const after = { reservations: 6, confirmed: 5, cancelled: 1, outbox: 8, processed: 8 };
  const accepted = { operations: Object.fromEntries(Object.entries(result.counts)
    .map(([name, success]) => ["reservation." + name, { success }])) };
  assert.doesNotThrow(() => checkInvariants(before, after, accepted, "final-mixed"));
  assert.throws(() => checkInvariants(before, after, accepted, "lifecycle-write"), /did not complete/);
  assert.match(reconcileLifecycle({ ...run, events: events.slice(1) }).errors.join(), /durable event sequence mismatch/);
  current.inventory[0].reserved = 0;
  assert.match(reconcileLifecycle(run).errors.join(), /Inventory quantities\/versions/);
});

test("final read requires all five successful GETs per journey with no persistent change", () => {
  const previous = { reservations: [], inventory: [{ reserved: 0 }] };
  const summary = { scenarioIterations: { low: 2 }, operations: exploration(2) };
  const run = { mode: "read", previous, current: previous, events: [], summary };
  assert.deepEqual(reconcileLifecycle(run).errors, []);
  summary.operations["explore.price"].success = 1;
  assert.match(reconcileLifecycle(run).errors.join(), /Incomplete exploration: price/);
  assert.match(reconcileLifecycle({ ...run, events: [{ id: 1 }] }).errors.join(), /changed persistent state/);
});
