import { creationAccounts, creationInput, creationMatches, creationQuantity, creationRooms } from "./k6/creation-cases.js";

const rows = (out) => out ? out.split(/\r?\n/).map(JSON.parse) : [];
const int = (x) => Number.isSafeInteger(x) && x > 0;
const mapKey = (roomId, date) => roomId + "/" + date;
const equalJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function inventoryRows(sql) {
  return rows(sql("SELECT JSON_OBJECT('roomId',room_id,'date',DATE_FORMAT(inventory_date,'%Y-%m-%d')," +
    "'total',total_quantity,'reserved',reserved_quantity,'version',version,'status',sale_status) " +
    "FROM room_inventories ORDER BY room_id,inventory_date;"));
}

export function prepareCreation(run, mode) {
  run.resources(true);
  const fixture = JSON.parse(run.fixture("creation-fixture"));
  const rooms = creationRooms(fixture.rooms, mode);
  if (rooms.length !== (mode === "distributed" ? creationAccounts : 1) ||
      !rooms.every(({ id }) => int(id)) || new Set(rooms.map(({ id }) => id)).size !== rooms.length ||
      fixture.accounts.length !== creationAccounts || !fixture.accounts.every(({ memberId }) => int(memberId)) ||
      new Set(fixture.accounts.map(({ memberId }) => memberId)).size !== creationAccounts ||
      fixture.days.length !== 5 || ![...fixture.days, fixture.endDate].every((d) => /^\d{4}-\d\d-\d\d$/.test(d)))
    throw new Error("Unrecognized creation fixture");
  const ids = rooms.map(({ id }) => id).join(",");
  const first = fixture.days[0], second = fixture.days[1];
  const qty = mode === "exhaustion" ? "CASE WHEN inventory_date='" + first + "' THEN 4 ELSE 1 END" : String(creationQuantity);
  // Only the known room IDs in the freshly seeded isolated database may be changed, once.
  run.sql("UPDATE room_inventories SET total_quantity=" + qty +
    " WHERE reserved_quantity=0 AND room_id IN (" + ids + ");");
  const inventory = inventoryRows(run.sql);
  const included = inventory.filter((r) => rooms.some(({ id }) => r.roomId === id));
  if (included.length !== rooms.length * 5 || included.some((r) => !fixture.days.includes(r.date) ||
      r.total !== (mode === "exhaustion" ? r.date === first ? 4 : 1 : creationQuantity) ||
      r.reserved !== 0 || r.status !== "OPEN") || (mode === "exhaustion" && !included.some((r) => r.date === second && r.total === 1)))
    throw new Error("Creation fixture quantities or initial ownership do not match");
  const initialMax = Number(run.sql("SELECT COALESCE(MAX(id),0) FROM reservations;"));
  if (!int(initialMax)) throw new Error("Invalid reservation seed watermark");
  return { fixture, initialMax, inventory, included };
}

export function readCreationLedger(raw) {
  return raw.split(/\r?\n/).filter(Boolean).map((line) => {
    const prefix = "CREATION_LEDGER ";
    if (!line.startsWith(prefix)) throw new Error("Unexpected creation ledger line");
    const row = JSON.parse(line.slice(prefix.length));
    if (!["response", "dispatch"].includes(row.event) || !int(row.ordinal) || !int(row.at))
      throw new Error("Invalid creation ledger record");
    return row;
  });
}

export function creationDatabase(run, initialMax) {
  if (!int(initialMax)) throw new Error("Invalid reservation watermark");
  const bookings = rows(run.sql(
    "SELECT JSON_OBJECT('ordinal',CASE WHEN r.guest_name REGEXP '^Load-creation-[0-9]+$' " +
    "THEN CAST(SUBSTRING(r.guest_name,15) AS UNSIGNED) ELSE NULL END," +
    "'reservationId',r.id,'memberId',r.member_id,'roomId',r.room_id,'guestCount',r.guest_count,'capacity',t.capacity," +
    "'checkInDate',DATE_FORMAT(r.check_in_date,'%Y-%m-%d'),'checkOutDate',DATE_FORMAT(r.check_out_date,'%Y-%m-%d')," +
    "'totalAmount',r.total_amount,'nightlyPriceSnapshot',r.nightly_price_snapshot,'status',r.status) " +
    "FROM reservations r JOIN rooms t ON t.id=r.room_id WHERE r.id>" + initialMax + " ORDER BY r.id;"));
  const nights = rows(run.sql(
    "SELECT JSON_OBJECT('reservationId',reservation_id,'stayDate',DATE_FORMAT(stay_date,'%Y-%m-%d')," +
    "'priceSnapshot',price_snapshot) FROM reservation_nights WHERE reservation_id>" + initialMax +
    " ORDER BY reservation_id,stay_date;"));
  const events = rows(run.sql(
    "SELECT JSON_OBJECT('reservationId',aggregate_id,'type',event_type,'status',status) " +
    "FROM reservation_outbox_events WHERE aggregate_id>" + initialMax + ";"));
  return { bookings, nights, events, inventory: inventoryRows(run.sql) };
}

export function reconcileCreation({ mode, fixture, ledger, db, beforeInventory, finished }) {
  const errors = [];
  const dispatch = new Map(), response = new Map(), actual = new Map(), increments = new Map();
  for (const row of ledger) {
    const map = row.event === "dispatch" ? dispatch : response;
    if (map.has(row.ordinal)) errors.push("duplicate " + row.event + " ordinal " + row.ordinal);
    map.set(row.ordinal, row);
  }
  for (const r of db.bookings) {
    if (!dispatch.has(r.ordinal)) errors.push("new reservation without ledger dispatch");
    if (actual.has(r.ordinal)) errors.push("multiple reservations for one dispatch");
    actual.set(r.ordinal, r);
  }
  for (const id of response.keys()) if (!dispatch.has(id)) errors.push("response without dispatch");
  const outcomes = [];
  for (const [id, d] of dispatch) {
    const a = creationInput(fixture, mode, d.scenario, d.iteration, d.ownerIndex);
    const h = response.get(id);
    const r = actual.get(id);
    if (a.ordinal !== id) errors.push("invalid dispatch mapping");
    if (h && h.at < d.at) errors.push("invalid response order");
    if (r) {
      const nights = db.nights.filter((n) => n.reservationId === r.reservationId);
      const events = db.events.filter((e) => e.reservationId === r.reservationId);
      if (r.guestCount < 1 || r.guestCount > r.capacity ||
          !creationMatches(a, { ...r, nights, stayNights: nights.length }) ||
          events.length !== 1 || events[0].type !== "RESERVATION_CREATED" || events[0].status !== "PUBLISHED")
        errors.push("reservation, guest capacity, night or event mismatch for ordinal " + id);
      for (const { stayDate } of a.nights) {
        const key = mapKey(a.roomId, stayDate);
        increments.set(key, (increments.get(key) ?? 0) + 1);
      }
    }
    const confirmed = h?.outcome === "success" && h.status === 201;
    const exhausted = h?.status === 409 && h.code === "INVENTORY_005" && h.outcome === "expected_rejection";
    const redisRefused = h?.status === 503 && h.code === "INVENTORY_013" && h.outcome === "expected_rejection";
    if ((confirmed && (!r || r.reservationId !== h.reservationId)) || ((exhausted || redisRefused) && r))
      errors.push("unexpected HTTP vs committed state for ordinal " + id);
    const dbState = r ? "committed" : finished === dispatch.size ? "no_row_after_server_finish" : "unresolved";
    outcomes.push({ ordinal: id, scenario: d.scenario, target: a.host, sentAt: d.at, respondedAt: h?.at ?? null,
      status: h?.status ?? null, code: h?.code ?? null, outcome: h?.outcome ?? "unconfirmed_write",
      dbState, reservationId: r?.reservationId ?? null, ...(h?.validatorError ? { validatorError: true } : {}) });
  }
  if (db.events.length !== db.bookings.length ||
      db.nights.some((n) => !db.bookings.some((r) => r.reservationId === n.reservationId)))
    errors.push("unexpected event or orphan night");
  const inventory = [];
  const before = new Map(beforeInventory.map((r) => [mapKey(r.roomId, r.date), r]));
  if (beforeInventory.length !== db.inventory.length) errors.push("inventory row count changed");
  for (const current of db.inventory) {
    const key = mapKey(current.roomId, current.date), original = before.get(key), change = increments.get(key) ?? 0;
    if (!original || current.total !== original.total || current.status !== original.status ||
        current.reserved !== original.reserved + change || current.version !== original.version + change ||
        current.reserved < 0 || current.reserved > current.total) errors.push("inventory mismatch at " + key);
    if (change || creationRooms(fixture.rooms, mode).some(({ id }) => id === current.roomId)) {
      inventory.push({ roomId: current.roomId, date: current.date, before: original?.reserved ?? null,
        total: current.total, reserved: current.reserved, available: current.total - current.reserved,
        version: current.version });
    }
    increments.delete(key);
  }
  if (increments.size) errors.push("committed dates without inventory rows");
  const count = (predicate) => outcomes.filter(predicate).length;
  const counts = { dispatch: dispatch.size, success: count((x) => x.outcome === "success"),
    committed: db.bookings.length, unavailable: count((x) => x.status === 409 && x.code === "INVENTORY_005"),
    lockWait: count((x) => x.code === "INVENTORY_012"), exhaustedRetry: count((x) => x.code === "INVENTORY_011"),
    redisError: count((x) => x.code === "INVENTORY_013"),
    unconfirmed: count((x) => x.outcome === "unconfirmed_write" || x.dbState === "unresolved"),
    unresolved: count((x) => x.dbState === "unresolved") };
  if (!dispatch.size || finished !== dispatch.size) errors.push("server completion could not be matched to all dispatches");
  if (counts.unconfirmed) errors.push("HTTP confirmation is incomplete; DB evidence was retained");
  if (mode === "redis-down" ? counts.redisError !== 1 || counts.committed !== 0 || counts.dispatch !== 1 :
      mode === "exhaustion" ? counts.dispatch !== 4 || counts.committed !== 1 || counts.success !== 1 ||
        counts.unavailable !== 3 :
      counts.committed !== counts.dispatch || counts.success !== counts.dispatch)
    errors.push("unexpected bounded profile outcomes");
  return { counts, outcomes, inventory, errors };
}

function timings(points) {
  if (!points.length) return null;
  const values = [...points].sort((a, b) => a - b);
  const p = (n) => values[Math.ceil(n * values.length) - 1] / 1e6;
  return { n: values.length, p50Ms: p(0.50), p95Ms: p(0.95), p99Ms: p(0.99), maxMs: p(1) };
}
export function creationServerMetrics(log) {
  const waits = [], holds = [], tx = [];
  let notOwned = 0, releaseFailed = 0, beyondLease = 0, conflicts = 0, returned = 0, errors = 0;
  let retryAttempts = 0;
  for (const line of log.split(/\r?\n/)) {
    const l = /LOAD_CREATION_LOCK waitNs=(\d+) acquired=(true|false) holdNs=(\d+) owned=(true|false) released=(true|false)\s*$/.exec(line);
    if (l) {
      waits.push(Number(l[1]));
      if (l[2] === "true") {
        holds.push(Number(l[3]));
        if (l[4] === "false") notOwned++;
        if (l[5] === "false") releaseFailed++;
        if (Number(l[3]) >= 30_000_000_000) beyondLease++;
      }
    }
    const t = /LOAD_CREATION_TX attempt=([123]) elapsedNs=(\d+) result=(returned|conflict|error)\s*$/.exec(line);
    if (t) {
      tx.push(Number(t[2]));
      if (t[1] !== "1") retryAttempts++;
      if (t[3] === "conflict") conflicts++;
      if (t[3] === "error") errors++;
      if (t[3] === "returned") returned++;
    }
  }
  return { finished: waits.length, acquired: holds.length, notOwned, releaseFailed, beyondLease,
    attempts: tx.length, retryAttempts, conflicts, returned, errors,
    wait: timings(waits), hold: timings(holds), transaction: timings(tx) };
}
