import { inventoryRows } from "./creation-verification.mjs";
import { matchesLifecycle, matchesCancellation, raceInput, cycleInput } from "./k6/lifecycle-cases.js";

export const rows = (sqlResult) => sqlResult ? sqlResult.split(/\r?\n/).map(JSON.parse) : [];
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const key = (room, date) => room + "/" + date;
const eventType = { create: "CREATED", change: "CHANGED", cancel: "CANCELLED" };
const int = (x) => Number.isSafeInteger(x) && x > 0;

export function readLifecycleLedger(log) {
  return log.split(/\r?\n/).filter((line) => line.startsWith("LIFECYCLE_LEDGER "))
    .map((line) => JSON.parse(line.slice("LIFECYCLE_LEDGER ".length)));
}

export function prepareLifecycle(run) {
  const f = JSON.parse(run.fixture("lifecycle-fixture"));
  if (f.accounts.length !== 8 || f.rooms.length !== 24 || f.days.length !== 5 ||
      !f.accounts.every((a) => int(a.memberId) && (a.reservationId === null || int(a.reservationId))) ||
      !f.rooms.every((r) => int(r.id)) || !f.accounts.slice(0, 4).every((a) => int(a.reservationId)))
    throw new Error("Unexpected lifecycle fixture");
  const watermarks = JSON.parse(run.sql("SELECT JSON_OBJECT('reservation',(SELECT MAX(id) FROM reservations)," +
    "'outbox',(SELECT MAX(id) FROM reservation_outbox_events));"));
  if (!int(watermarks.reservation) || !int(watermarks.outbox)) throw new Error("Missing lifecycle watermark");
  return { fixture: f, watermarks, inventory: inventoryRows(run.sql) };
}

export function lifecycleSnapshot(run, first, mode) {
  const ids = first.fixture.accounts.slice(0, 4).map((a) => a.reservationId).join(",");
  const where = mode === "history" ? "1=1" : "r.id>" + first.watermarks.reservation + " OR r.id IN (" + ids + ")";
  const reservations = rows(run.sql("SELECT JSON_OBJECT('reservationId',id,'roomId',room_id,'memberId',member_id," +
    "'ordinal',CASE WHEN guest_name REGEXP '^Lifecycle-[0-9]+$' THEN CAST(SUBSTRING(guest_name,11) AS UNSIGNED) END," +
    "'checkInDate',DATE_FORMAT(check_in_date,'%Y-%m-%d'),'checkOutDate',DATE_FORMAT(check_out_date,'%Y-%m-%d')," +
    "'stayNights',DATEDIFF(check_out_date,check_in_date),'guestCount',guest_count,'status',status," +
    "'nightlyPriceSnapshot',nightly_price_snapshot,'totalAmount',total_amount,'fee',cancellation_fee_amount," +
    "'refund',refund_amount,'cancelledAt',DATE_FORMAT(cancelled_at,'%Y-%m-%dT%H:%i:%sZ')," +
    "'freeDays',free_cancellation_days_before_check_in,'deadlineDays',cancellation_deadline_days_before_check_in) " +
    "FROM reservations r WHERE " + where + " ORDER BY id;"));
  const nights = rows(run.sql("SELECT JSON_OBJECT('id',n.reservation_id,'stayDate',DATE_FORMAT(n.stay_date,'%Y-%m-%d')," +
    "'priceSnapshot',n.price_snapshot) FROM reservation_nights n JOIN reservations r ON r.id=n.reservation_id WHERE " +
    where + " ORDER BY n.reservation_id,n.stay_date;"));
  const nightsById = Map.groupBy(nights, (n) => n.id);
  for (const r of reservations) r.nights = (nightsById.get(r.reservationId) ?? []).map(({ stayDate, priceSnapshot }) =>
    ({ stayDate, priceSnapshot }));
  return { reservations, inventory: inventoryRows(run.sql) };
}

export function reconcileLifecycle({ mode, first, previous, current, events, ledger, summary }) {
  const errors = [], records = [], counts = { create: 0, change: 0, cancel: 0 };
  const require = (yes, message) => { if (!yes) errors.push(message); };
  if (mode === "history") {
    require(!events.length && equal(previous, current), "Owner read profile changed persistent state");
    for (const name of ["offset_first", "offset_deep", "cursor_first", "cursor_deep", "detail"]) {
      require(summary?.operations?.["history." + name]?.success > 0, "Missing history operation: " + name);
    }
    return { errors, counts };
  }
  const byOrdinal = Map.groupBy(ledger, (row) => row.ordinal);
  const byAggregate = Map.groupBy(events, (row) => row.aggregateId);
  const updatedInventory = new Map(first.inventory.map((row) => [key(row.roomId, row.date), { ...row }]));
  const apply = (s, dates, quantity) => {
    for (const date of dates) {
      const row = updatedInventory.get(key(s.roomId, date));
      if (row) { row.reserved += quantity; row.version++; }
      else errors.push("Expected inventory date missing");
    }
  };
  const datesOf = (s) => s.nights.map((n) => n.stayDate);
  const checkReservation = (r, s, state, label) => {
    require(matchesLifecycle(s, r, state), label + ": persisted reservation/night/amount mismatch");
    if (s.rate) require(r?.freeDays === 180 && r.deadlineDays === 1, label + ": persisted policy mismatch");
    if (state === "CANCELLED") require(matchesCancellation(s, r?.reservationId, { ...r,
      cancellationFeeRate: s.rate, cancellationFeeAmount: r?.fee, estimatedRefundAmount: r?.refund,
    }), label + ": cancellation result mismatch");
    else require(r?.cancelledAt === null && r?.fee === null && r?.refund === null, label + ": unexpected cancellation result");
  };
  const acknowledgements = Object.fromEntries(Object.keys(counts).map((op) => [op, []]));
  const readAttempt = (op, batch, label) => {
    const attempt = batch.filter((x) => x.op === op);
    const dispatched = attempt.filter((x) => x.event === "dispatch");
    const response = attempt.filter((x) => x.event === "response");
    require(dispatched.length === 1 && response.length === 1 && attempt.length === 2,
      label + "/" + op + ": missing/duplicate dispatch or response; do not replay");
    if (response[0]?.outcome === "success") {
      require(response[0].status === (op === "create" ? 201 : 200), label + ": unexpected status");
      acknowledgements[op].push(response[0].reservationId);
    } else require(mode === "race" && response[0]?.outcome === "expected_rejection", label + "/" + op + ": unconfirmed operation");
    return { dispatched: dispatched[0]?.id, dispatchAt: dispatched[0]?.at, response: response[0] };
  };
  const checkEvents = (id, types, label) => {
    const stored = byAggregate.get(id) ?? [];
    require(equal(stored.map((x) => x.eventType), types), label + ": durable event sequence mismatch");
  };
  const newRows = current.reservations.filter((r) => r.reservationId > first.watermarks.reservation);
  if (mode === "race") {
    require(!newRows.length && byOrdinal.size === 4, "Race fixture/attempt count mismatch");
    for (const scenario of ["race_mixed", "race_cancel"]) {
      const a = raceInput(first.fixture, scenario, 0);
      const b = raceInput(first.fixture, scenario, 1);
      const attempt = (x) => {
        const batch = byOrdinal.get(x.ordinal) ?? [];
        require(batch.every((item) => item.scenario === scenario && item.ownerIndex === x.ownerIndex &&
          item.iteration === x.ordinal - (scenario === "race_mixed" ? 401 : 501)), scenario + ": attempt context mismatch");
        const entry = readAttempt(x.op, batch, scenario);
        require(entry.dispatched === x.id, scenario + ": target mismatch");
        return entry;
      };
      const [firstAttempt, secondAttempt] = [attempt(a), attempt(b)];
      const firstOutcome = firstAttempt.response, secondOutcome = secondAttempt.response;
      const overlapMs = Math.min(firstOutcome?.at ?? 0, secondOutcome?.at ?? 0) -
        Math.max(firstAttempt.dispatchAt ?? Infinity, secondAttempt.dispatchAt ?? Infinity);
      require(overlapMs > 0, scenario + ": concurrent HTTP windows did not overlap");
      const stored = byAggregate.get(a.id) ?? [];
      const types = stored.map((e) => e.eventType);
      const changed = types.includes("CHANGED"), cancelled = types.includes("CANCELLED");
      require(scenario === "race_mixed" ? ["CHANGED", "CANCELLED", "CHANGED,CANCELLED"].includes(types.join(","))
        : equal(types, ["CANCELLED"]), scenario + ": invalid winning transitions");
      const finalStay = changed ? a.changed : a.created;
      if (changed) {
        apply(a.created, datesOf(a.created).filter((x) => !datesOf(a.changed).includes(x)), -1);
        apply(a.changed, datesOf(a.changed).filter((x) => !datesOf(a.created).includes(x)), 1);
      }
      if (cancelled) apply(finalStay, datesOf(finalStay), -1);
      const r = current.reservations.find((item) => item.reservationId === a.id);
      const original = previous.reservations.find((item) => item.reservationId === a.id);
      require(r?.freeDays === original?.freeDays && r?.deadlineDays === original?.deadlineDays && original?.freeDays < 180,
        scenario + ": old cancellation policy was not retained");
      checkReservation(r, finalStay, cancelled ? "CANCELLED" : "CONFIRMED", scenario);
      for (const v of [firstOutcome, secondOutcome]) if (v?.outcome === "success" && v.closedAmount !== undefined)
        require(v.closedAmount === finalStay.totalAmount && v.fee === finalStay.fee, scenario + ": response cancellation snapshot differs");
      records.push({ scenario, id: a.id, types, overlapMs,
        outcomes: [firstOutcome, secondOutcome].map((x) => x && ({ status: x.status, code: x.code })) });
    }
  } else {
    require(newRows.length > 0 && newRows.length === byOrdinal.size, "Creation count differs from lifecycle ledger");
    for (const [ordinal, batch] of byOrdinal) {
      const dispatch = batch.find((x) => x.event === "dispatch");
      if (!dispatch) { errors.push("Missing first dispatch"); continue; }
      const { scenario, iteration, ownerIndex } = dispatch;
      const a = cycleInput(first.fixture, scenario, iteration, ownerIndex);
      const label = "Cycle " + ordinal;
      require(ordinal === a.ordinal && batch.every((x) => x.ownerIndex === ownerIndex &&
        x.scenario === scenario && x.iteration === iteration), label + ": assignment mismatch");
      const creation = readAttempt("create", batch, label);
      const change = readAttempt("change", batch, label);
      const cancellation = readAttempt("cancel", batch, label);
      const r = newRows.find((item) => item.ordinal === ordinal);
      const id = r?.reservationId;
      require(int(id) && creation.dispatched === null && change.dispatched === id && cancellation.dispatched === id,
        label + ": target mismatch");
      checkEvents(id, ["CREATED", "CHANGED", "CANCELLED"], label);
      checkReservation(r, a.changed, "CANCELLED", label);
      apply(a.created, datesOf(a.created), 1);
      apply(a.created, datesOf(a.created).filter((x) => !datesOf(a.changed).includes(x)), -1);
      apply(a.changed, datesOf(a.changed).filter((x) => !datesOf(a.created).includes(x)), 1);
      apply(a.changed, datesOf(a.changed), -1);
      records.push({ ordinal, id, ownerIndex, events: (byAggregate.get(id) ?? []).length });
    }
  }
  for (const op of Object.keys(counts)) {
    const ids = events.filter((e) => e.eventType === eventType[op]).map((e) => e.aggregateId).sort((a, b) => a - b);
    counts[op] = ids.length;
    require(equal(acknowledgements[op].sort((a, b) => a - b), ids), op + ": HTTP success does not match durable Outbox");
    require((summary?.operations?.["lifecycle." + op]?.success ?? 0) === ids.length, op + ": summary differs from verified ledger");
  }
  require(equal([...updatedInventory.values()], current.inventory), "Inventory quantities/versions differ from winning transitions");
  return { errors, counts, records, events: events.map(({ id, aggregateId, eventType }) => ({ id, aggregateId, eventType })) };
}
