import test from "node:test";
import assert from "node:assert/strict";
import { plan } from "./k6/profiles.js";
import { cycleInput, historyDefinitions, historyMatches, matchesCancellation, raceInput } from "./k6/lifecycle-cases.js";
import { lifecycleTimings, matchEventOrder } from "./lifecycle-kafka.mjs";
import { readLifecycleLedger, reconcileLifecycle } from "./lifecycle-verification.mjs";

const days = ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"];
const fixture = { days, endDate: "2027-01-04",
  rooms: Array.from({ length: 24 }, (_, i) => ({ id: i + 1, price: 10001, firstPrice: 11001, thirdPrice: 11801 })),
  accounts: Array.from({ length: 8 }, (_, i) => ({ memberId: i + 1, reservationId: i < 4 ? i + 1 : null })) };

test("lifecycle plans are bounded; date changes share one night and preserve distinct owners/rooms", () => {
  const spec = plan("lifecycle-write", "off", "distributed");
  assert.deepEqual(spec.stages.map(({ name, rate, seconds }) => [name, rate, seconds]),
    [["low", 1, 6], ["ramp", 2, 6], ["steady", 3, 8]]);
  assert.throws(() => plan("lifecycle-write", "warm", "distributed"));
  assert.throws(() => plan("lifecycle-broker-down", "off", "hot"));
  assert.throws(() => plan("lifecycle-history", "off", "distributed", "expanded"));
  const a = cycleInput(fixture, "steady", 0, 0);
  const b = cycleInput(fixture, "steady", 1, 1);
  assert.notEqual(a.created.memberId, b.created.memberId);
  assert.notEqual(a.created.roomId, b.created.roomId);
  assert.deepEqual(a.created.nights.map((n) => n.stayDate), days.slice(0, 2));
  assert.deepEqual(a.changed.nights.map((n) => n.stayDate), days.slice(1, 3));
  assert.equal(a.changed.totalAmount, 21802);
  const cancellation = { reservationId: 9, status: "CANCELLED", cancelledAt: "2026-11-25T04:00:00Z",
    totalAmount: 21802, cancellationFeeRate: 30, cancellationFeeAmount: 6540.6, estimatedRefundAmount: 15261.4 };
  assert.equal(matchesCancellation(a.changed, 9, cancellation), true);
  assert.equal(matchesCancellation(a.changed, 9, { ...cancellation, estimatedRefundAmount: 15261.39 }), false);
  assert.equal(raceInput(fixture, "race_mixed", 0).created.fee, 0);
});

test("deep owner history uses the same filtered cohort and DESC ordering, not an arbitrary cursor", () => {
  const ids = Array.from({ length: 31 }, (_, i) => 34 - i);
  assert.throws(() => historyDefinitions(ids, 1, days[0], ids[18]));
  const cases = historyDefinitions(ids, 1, days[0], ids[19]);
  const [, offset, , cursor] = cases;
  assert.deepEqual(cursor.ids, offset.ids);
  for (const test of [offset, cursor]) {
    assert.match(test.path, /status=CONFIRMED&checkInFrom=2026-12-30&checkInTo=2026-12-30&size=5/);
    const page = { content: test.ids.map((reservationId) => ({ reservationId, memberId: 1, status: "CONFIRMED" })),
      size: 5, nextCursor: test.ids.at(-1), hasNext: true, page: 4, totalElements: 31, totalPages: 7 };
    assert.equal(historyMatches(test, page), true);
    page.content.reverse();
    assert.equal(historyMatches(test, page), false);
  }
});

test("normal durable model includes version increments only on added and removed dates and reconciles HTTP with Outbox", () => {
  const a = cycleInput(fixture, "low", 0, 0), id = 5;
  const inventory = days.map((date) => ({ roomId: 1, date, total: 32, reserved: 0, version: 0, status: "OPEN" }));
  const current = {
    inventory: inventory.map((row, i) => ({ ...row, version: i < 3 ? 2 : 0 })),
    reservations: [{ ...a.changed, reservationId: id, ordinal: a.ordinal, stayNights: 2, status: "CANCELLED",
      nightlyPriceSnapshot: a.changed.nights[0].priceSnapshot, freeDays: 180, deadlineDays: 1,
      cancelledAt: "2026-11-25T04:00:00Z", refund: a.changed.totalAmount - a.changed.fee }],
  };
  const events = ["CREATED", "CHANGED", "CANCELLED"].map((eventType, i) => ({ id: i + 5, aggregateId: id, eventType }));
  const ledger = ["create", "change", "cancel"].flatMap((op) => {
    const ctx = { ordinal: a.ordinal, scenario: "low", iteration: 0, ownerIndex: 0, op };
    return [{ ...ctx, event: "dispatch", id: op === "create" ? null : id },
      { ...ctx, event: "response", outcome: "success", status: op === "create" ? 201 : 200, reservationId: id }];
  });
  const summary = { operations: Object.fromEntries(["create", "change", "cancel"].map((op) => ["lifecycle." + op, { success: 1 }])) };
  const run = { mode: "write", first: { fixture, watermarks: { reservation: 4 }, inventory }, current,
    events, ledger: readLifecycleLedger("ignored log\n" + ledger.map((row) => "LIFECYCLE_LEDGER " + JSON.stringify(row)).join("\n")), summary };
  assert.deepEqual(reconcileLifecycle(run).errors, []);
  assert.match(reconcileLifecycle({ ...run, ledger: ledger.slice(0, -1) }).errors.join(), /unconfirmed operation.*HTTP success/);
  current.inventory[1].version++;
  assert.match(reconcileLifecycle(run).errors.join(), /Inventory quantities\/versions/);
});

test("Kafka verification compares actual keys, partitions and order but allows retry duplicates only when requested", () => {
  const events = ["CREATED", "CHANGED", "CANCELLED"].map((eventType, i) => ({ aggregateId: 12, eventId: "event-" + i, eventType }));
  const messages = events.map((event, i) => ({ ...event, key: "12", partition: 1, offset: 13 + i }));
  assert.deepEqual(matchEventOrder(events, messages, false), []);
  assert.throws(() => matchEventOrder(events, [{ ...messages[0], partition: 0 }, ...messages.slice(1)], false), /order/);
  assert.throws(() => matchEventOrder(events, messages.slice(1), false), /Outbox/);
  assert.throws(() => matchEventOrder(events, messages.concat({ ...messages[0], offset: 16 }), false), /Outbox/);
  assert.deepEqual(matchEventOrder(events, messages.concat({ ...messages[0], offset: 16 }), true),
    [{ eventId: "event-0", count: 2 }]);
});

test("publisher timings retain failed acknowledgements, rollback and signed timestamp differences separately", () => {
  const timing = lifecycleTimings(`LOAD_OUTBOX_SEND ack=false elapsedNs=5000000000
LOAD_OUTBOX_SEND ack=true elapsedNs=1500000
LOAD_OUTBOX_BATCH rows=1 published=1 committed=true elapsedNs=4500000
LOAD_OUTBOX_BATCH rows=1 published=0 committed=false elapsedNs=7000000`,
  [{ id: 1, attempts: 2, publishedMs: 1001, processedMs: 1000, consumerMinusPublishedMs: -1 }]);
  assert.equal(timing.brokerAckWaitMs.p95, 1.5);
  assert.equal(timing.brokerFailedWaitMs.p95, 5000);
  assert.equal(timing.committedNonemptyBatchMs.p95, 4.5);
  assert.equal(timing.rolledBackBatchCount, 1);
  assert.equal(timing.publishedRowsInCommittedBatches, 1);
  assert.equal(timing.consumerTimestampMinusPublishedTimestampMs.p95, -1);
});
