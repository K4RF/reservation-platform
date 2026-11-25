const stageBase = { low: 0, shared: 100, overlap: 200, disjoint: 300, steady: 400, burst: 500 };
export const creationAccounts = 12;
export const creationQuantity = 96;

export function creationRooms(rooms, mode) {
  if (mode === "exhaustion") return [rooms[rooms.length - 1]];
  const distributed = rooms.filter((_, i) => i % 3 !== 1 && i < rooms.length - 1).slice(0, creationAccounts);
  return mode === "distributed" ? distributed : [distributed[0]];
}

export function creationInput(fixture, mode, stage, ordinal, ownerIndex) {
  if (!Object.hasOwn(stageBase, stage) || !Number.isInteger(ordinal) || ordinal < 0 || ordinal >= 80 ||
      !Number.isInteger(ownerIndex) || ownerIndex < 0 || ownerIndex >= creationAccounts)
    throw new Error("Unexpected creation VU assignment");
  const group = creationRooms(fixture.rooms, mode);
  const room = group[mode === "distributed" ? ownerIndex : 0];
  const memberId = fixture.accounts[ownerIndex]?.memberId;
  if (!room || !memberId) throw new Error("Missing creation fixture ownership");
  const odd = ordinal % 2;
  const offsets = stage === "low" ? [0, 1] : stage === "overlap" ? [odd, odd + 2] :
    stage === "disjoint" ? odd ? [3, 5] : [0, 1] : stage === "steady" ? [0, 2 + odd] : [0, 2];
  const [start, end] = offsets;
  const dates = fixture.days.slice(start, end);
  const nights = dates.map((stayDate, i) => ({
    stayDate, price: start === 0 && i === 0 ? room.firstPrice : room.price,
  }));
  return { ordinal: stageBase[stage] + ordinal + 1, memberId, ownerIndex, roomId: room.id, guestCount: 2,
    checkInDate: dates[0], checkOutDate: fixture.days[end] ?? fixture.endDate,
    nights, total: nights.reduce((sum, night) => sum + night.price, 0),
    host: mode === "peer" && ownerIndex % 2 ? "backend-peer" : "backend" };
}

export function creationMatches(attempt, response) {
  const matchesSummary = response?.memberId === attempt.memberId && response.roomId === attempt.roomId &&
    response.guestCount === attempt.guestCount && response.status === "CONFIRMED" &&
    Number.isInteger(response.reservationId) && response.reservationId > 0 &&
    response.checkInDate === attempt.checkInDate && response.checkOutDate === attempt.checkOutDate &&
    response.nightlyPriceSnapshot === attempt.nights[0].price &&
    response.stayNights === attempt.nights.length && response.totalAmount === attempt.total &&
    Array.isArray(response.nights) && response.nights.length === attempt.nights.length;
  if (!matchesSummary) return false;
  // Compare each returned night against the independently constructed fixture dates.
  return attempt.nights.every((night, i) => response.nights[i]?.stayDate === night.stayDate &&
    response.nights[i]?.priceSnapshot === night.price);
}
