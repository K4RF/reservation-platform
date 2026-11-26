const phase = { low: 0, ramp: 100, steady: 200, burst: 300, hold: 600 };
export const lifecycleDayFeeRate = 30;
export const historySeedCount = 30;
export const historyPageSize = 5;
export const historyDeepPage = 4;

export function stay(f, room, memberId, start, end, rate) {
  const nights = f.days.slice(start, end).map((day, i) => ({
    stayDate: day, priceSnapshot: start + i === 0 ? room.firstPrice : start + i === 2 ? room.thirdPrice : room.price,
  }));
  const totalAmount = nights.reduce((sum, n) => sum + n.priceSnapshot, 0);
  return { roomId: room.id, memberId, checkInDate: f.days[start], checkOutDate: f.days[end] ?? f.endDate,
    guestCount: 2, nights, totalAmount, rate, fee: Math.round(totalAmount * rate) / 100 };
}

export const explores = (mode) => ["read", "mixed", "stability"].includes(mode);
export const lifecycleReadOnly = (mode) => ["read", "history"].includes(mode);
export const journeyKind = (mode, i) => mode === "read" || i % 5 < 3 ? "browse" : i % 5 === 3 ? "keep" : "cycle";
export const explorationNames = ["search", "accommodation", "availability", "room", "price"];

export function cycleInput(f, stage, iteration, vu, roomMode = "distributed") {
  if (!Object.hasOwn(phase, stage) || !Number.isInteger(iteration) || iteration < 0 ||
      iteration >= (stage === "hold" ? 100 : 80) ||
      !Number.isInteger(vu) || vu < 0 || vu >= 8)
    throw new Error("Unknown lifecycle assignment");
  const room = f.rooms[roomMode === "hot" ? 0 : vu * 3], account = f.accounts[vu];
  return { ordinal: phase[stage] + iteration + 1, ownerIndex: vu,
    created: stay(f, room, account.memberId, 0, 2, lifecycleDayFeeRate),
    changed: stay(f, room, account.memberId, 1, 3, lifecycleDayFeeRate) };
}

export function raceInput(f, stage, iteration) {
  if (!["race_mixed", "race_cancel"].includes(stage) || ![0, 1].includes(iteration))
    throw new Error("Unknown race assignment");
  const vu = stage === "race_mixed" ? 0 : 1;
  const owner = f.accounts[vu], room = f.rooms[vu * 3 + 1];
  return { ordinal: (vu + 4) * 100 + iteration + 1, stage, ownerIndex: vu,
    id: owner.reservationId, op: vu === 0 && iteration === 0 ? "change" : "cancel",
    created: stay(f, room, owner.memberId, 0, 2, 0), changed: stay(f, room, owner.memberId, 1, 3, 0) };
}

export function matchesLifecycle(stay, data, state = "CONFIRMED") {
  return data?.memberId === stay.memberId && data.roomId === stay.roomId && data.guestCount === stay.guestCount &&
    data.status === state && data.checkInDate === stay.checkInDate && data.checkOutDate === stay.checkOutDate &&
    Number.isInteger(data.reservationId) && data.reservationId > 0 &&
    data.stayNights === stay.nights.length && data.totalAmount === stay.totalAmount &&
    data.nightlyPriceSnapshot === stay.nights[0].priceSnapshot &&
    Array.isArray(data.nights) && data.nights.length === stay.nights.length && stay.nights.every((n, i) =>
      data.nights[i]?.stayDate === n.stayDate && data.nights[i]?.priceSnapshot === n.priceSnapshot);
}

export function matchesPolicy(stay, policy) {
  return policy?.freeCancellationDaysBeforeCheckIn === 180 &&
    policy.cancellationDeadlineDaysBeforeCheckIn === 1 && policy.feeRules?.length === 1 &&
    policy.feeRules[0]?.minDaysBeforeCheckIn === 1 && policy.feeRules[0]?.feeRatePercent === stay.rate;
}

export function matchesCancellation(stay, id, data) {
  const cents = (value, expected) => Number.isFinite(value) && Math.round(value * 100) === Math.round(expected * 100);
  return data?.reservationId === id && data.status === "CANCELLED" && !!Date.parse(data.cancelledAt) &&
    data.totalAmount === stay.totalAmount && data.cancellationFeeRate === stay.rate &&
    cents(data.cancellationFeeAmount, stay.fee) && cents(data.estimatedRefundAmount, stay.totalAmount - stay.fee);
}

export const changePath = (id) => "/reservations/" + id;
export const changeBody = ({ checkInDate, checkOutDate }) => ({ checkInDate, checkOutDate });
export const createBody = (s, guest, ordinal) => ({ ...changeBody(s), roomId: s.roomId, guestCount: s.guestCount,
  representativeGuest: { ...guest, name: "Lifecycle-" + ordinal } });
export const raceFailures = (op) => [{ status: 409, code: "INVENTORY_011" },
  { status: 409, code: op === "change" ? "RESERVATION_006" : "RESERVATION_005" }];

export function historyDefinitions(ids, memberId, day, deepCursor) {
  if (ids.length !== historySeedCount + 1 || deepCursor !== ids[historyDeepPage * historyPageSize - 1])
    throw new Error("Unverified deep cursor");
  const query = "status=CONFIRMED&checkInFrom=" + day + "&checkInTo=" + day + "&size=" + historyPageSize;
  const page = (k) => ids.slice(k * historyPageSize, (k + 1) * historyPageSize);
  return [
    { name: "history.offset_first", path: "/reservations?" + query + "&sortBy=ID&direction=DESC&page=0", page: 0,
      ids: page(0), count: ids.length, memberId },
    { name: "history.offset_deep", path: "/reservations?" + query + "&sortBy=ID&direction=DESC&page=" + historyDeepPage,
      ids: page(historyDeepPage), page: historyDeepPage, count: ids.length, memberId },
    { name: "history.cursor_first", path: "/reservations/cursor?" + query, ids: page(0), memberId, cursor: true },
    { name: "history.cursor_deep", path: "/reservations/cursor?" + query + "&cursor=" + deepCursor,
      ids: page(historyDeepPage), memberId, cursor: true },
    { name: "history.detail", path: "/reservations/" + ids[0], ids: [ids[0]], memberId, detail: true },
  ];
}

export function historyMatches(test, data) {
  const row = (item, id) => item?.reservationId === id && item.memberId === test.memberId && item.status === "CONFIRMED";
  if (test.detail) return row(data, test.ids[0]) && data.nights?.length === 2;
  return Array.isArray(data?.content) && data.content.length === test.ids.length && data.size === historyPageSize &&
    test.ids.every((id, i) => row(data.content[i], id)) && (test.cursor
      ? data.hasNext === true && data.nextCursor === test.ids.at(-1)
      : data.page === test.page && data.totalElements === test.count &&
        data.totalPages === Math.ceil(test.count / historyPageSize));
}
