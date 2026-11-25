import { deepEqual, equal, throws } from "node:assert/strict";
import { test } from "node:test";
import { checkResource, projectOf, servicesFor } from "./config.mjs";
import { creationInput, creationMatches, creationRooms } from "./k6/creation-cases.js";
import { plan } from "./k6/profiles.js";
import { creationServerMetrics, readCreationLedger, reconcileCreation } from "./creation-verification.mjs";

const days = ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"];
const fixture = {
  days, endDate: "2027-01-04",
  rooms: Array.from({ length: 24 }, (_, i) => ({ id: i + 1, price: 2000, firstPrice: 3000 })),
  accounts: Array.from({ length: 12 }, (_, i) => ({ memberId: 3 + i })),
};

test("hot splits dates without changing the room; distributed owners remain distinct", () => {
  const input = (mode, stage, n) => creationInput(fixture, mode, stage, n, n);
  const [a, b] = [input("hot", "disjoint", 0), input("hot", "disjoint", 1)];
  equal(a.roomId, b.roomId);
  equal(a.checkOutDate < b.checkInDate, true);
  deepEqual(b.nights, [{ stayDate: days[3], price: 2000 }, { stayDate: days[4], price: 2000 }]);
  equal(input("hot", "overlap", 1).checkInDate, days[1]);
  const overlapping = input("hot", "overlap", 1).nights.map(({ stayDate }) => stayDate);
  deepEqual(input("hot", "overlap", 0).nights.map(({ stayDate }) => stayDate)
    .filter((day) => overlapping.includes(day)), [days[1]]);
  equal(creationRooms(fixture.rooms, "distributed").length, 12);
  equal(input("distributed", "overlap", 0).roomId === input("distributed", "overlap", 1).roomId, false);
  equal(input("peer", "burst", 1).host, "backend-peer");
  throws(() => input("hot", "shared", 13));
});

test("peer is an explicit bounded profile, never allowed as a foreign service", () => {
  deepEqual(plan("create-hot", "off", "hot").stages, plan("create-distributed", "off", "distributed").stages);
  const normal = plan("create-hot", "off", "hot");
  deepEqual(normal.stages.filter((stage) => stage.iterations).map(({ name, iterations }) => [name, iterations]),
    [["overlap", 3], ["disjoint", 3]]);
  equal(normal.stages.reduce((n, s) => n + s.vus, 0), fixture.accounts.length);
  const peer = plan("create-peer", "off", "hot");
  equal(peer.stages[0].iterations, 4);
  throws(() => plan("create-peer", "off", "distributed"));
  const id = "a".repeat(24), project = projectOf(id);
  const record = { Name: "/" + project + "-backend-peer-1",
    Config: { Labels: { "com.docker.compose.service": "backend-peer", "reservation.load.run": id,
      "com.docker.compose.project": project } },
    HostConfig: { NetworkMode: project + "_default" }, Mounts: [] };
  throws(() => checkResource(record, id, "container"));
  checkResource(record, id, "container", servicesFor(peer));
  throws(() => checkResource({ ...record, HostConfig: { ...record.HostConfig, PublishAllPorts: true } },
    id, "container", servicesFor(peer)));
});

function example(mode = "exhaustion") {
  const attempts = Array.from({ length: mode === "exhaustion" ? 4 : 1 },
    (_, n) => creationInput(fixture, mode, "burst", n, n));
  const ledger = attempts.flatMap((a, n) => [
    { event: "dispatch", ordinal: a.ordinal, scenario: "burst", ownerIndex: n, iteration: n, at: 1000 },
    { event: "response", ordinal: a.ordinal, at: 1200, ...(n === 0 ?
      { status: 201, outcome: "success", reservationId: 5 } :
      { status: 409, code: "INVENTORY_005", outcome: "expected_rejection" }) },
  ]);
  const a = attempts[0];
  const row = { ...a, reservationId: 5, status: "CONFIRMED", capacity: 2,
    nightlyPriceSnapshot: a.nights[0].price, totalAmount: a.total };
  const beforeInventory = a.nights.map(({ stayDate }, i) => ({
    roomId: a.roomId, date: stayDate, total: i === 0 ? 4 : 1, reserved: 0, status: "OPEN", version: 0,
  }));
  const db = { bookings: [row], nights: a.nights.map((n) => ({ reservationId: 5, stayDate: n.stayDate, priceSnapshot: n.price })),
    events: [{ reservationId: 5, type: "RESERVATION_CREATED", status: "PUBLISHED" }],
    inventory: beforeInventory.map((r) => ({ ...r, reserved: 1, version: 1 })) };
  return { mode, fixture, ledger, db, beforeInventory, finished: attempts.length };
}

test("reservation response and durable exhaust ledger check money, dates, inventory and exactly one event", () => {
  const x = example();
  equal(creationMatches(x.db.bookings[0], { ...x.db.bookings[0], stayNights: 2, nights: x.db.nights }), true);
  const good = reconcileCreation(x);
  equal(good.counts.committed, 1);
  equal(good.counts.unavailable, 3);
  deepEqual(good.errors, []);
  const unlogged = reconcileCreation({ ...x, ledger: x.ledger.filter((_, i) => i !== 1) });
  equal(unlogged.counts.unconfirmed, 1);
  equal(unlogged.errors.includes("HTTP confirmation is incomplete; DB evidence was retained"), true);
  x.db.inventory[0].reserved += 1;
  x.db.events.push(x.db.events[0]);
  equal(reconcileCreation(x).errors.length > 1, true);
});

test("ambiguous response never implies failure if the reservation actually committed", () => {
  const x = example("hot");
  x.ledger.pop();
  const linked = reconcileCreation(x);
  equal(linked.outcomes[0].dbState, "committed");
  equal(linked.counts.unconfirmed, 1);
  equal(linked.errors.length > 0, true);
  x.db = { bookings: [], nights: [], events: [], inventory: x.beforeInventory };
  const pending = reconcileCreation({ ...x, finished: 0 });
  equal(pending.outcomes[0].dbState, "unresolved");
  equal(pending.counts.unresolved, 1);
});

test("ledger rejects foreign output and source-level timings distinguish attempts, conflict and release", () => {
  const [one] = example().ledger;
  deepEqual(readCreationLedger("CREATION_LEDGER " + JSON.stringify(one) + "\n"), [one]);
  throws(() => readCreationLedger("unexpected payload"));
  const m = creationServerMetrics([
    "TRACE LOAD_CREATION_TX attempt=1 elapsedNs=1000000 result=conflict",
    "TRACE LOAD_CREATION_TX attempt=2 elapsedNs=4000000 result=returned",
    "TRACE LOAD_CREATION_LOCK waitNs=7000000 acquired=true holdNs=35000000000 owned=false released=false",
  ].join("\n"));
  deepEqual([m.finished, m.attempts, m.retryAttempts, m.conflicts, m.beyondLease, m.notOwned, m.releaseFailed],
    [1, 2, 1, 1, 1, 1, 1]);
  equal(m.wait.p95Ms, 7);
});
