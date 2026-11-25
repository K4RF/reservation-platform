const dayMs = 86_400_000;
export const staySpecs = {
  small: { hotRooms: 40, spreadRooms: 16 },
  expanded: { hotRooms: 160, spreadRooms: 64 },
};
export const stayNights = [1, 3, 7];
export const stayPageSizes = [4, 16];
export const zones = { west: "Pacific/Pago_Pago", east: "Pacific/Kiritimati" };

export function shiftDay(date, n) {
  return new Date(Date.parse(date + "T00:00:00Z") + n * dayMs).toISOString().slice(0, 10);
}
export function localDay(epoch, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(epoch).map(({ type, value }) => [type, value]));
  return parts.year + "-" + parts.month + "-" + parts.day;
}
export function zoneBoundary(stay, epoch) {
  const west = localDay(epoch, zones.west), east = localDay(epoch, zones.east);
  const min = (Date.parse(stay) - Date.parse(west)) / dayMs;
  if (!(west < east) || !Number.isInteger(min) || min < 1)
    throw new Error("Invalid fixture advance-booking boundary");
  return { west, east, min, max: min + 1 };
}

export function stayRows(seed, stay, size, boundary) {
  if (!Object.hasOwn(staySpecs, size) || !Number.isInteger(seed) || seed < 1 || seed > 999999)
    throw new Error("Invalid stay fixture");
  const dates = Array.from({ length: 9 }, (_, i) => shiftDay(stay, i));
  const advance = [boundary.min, boundary.max];
  const config = [
    ["hot", staySpecs[size].hotRooms, "Asia/Seoul", [1, 7, 0, 180]],
    ["spread", staySpecs[size].spreadRooms, "America/New_York", null],
    ["west", 8, zones.west, [2, 7, ...advance]],
    ["east", 8, zones.east, [2, 7, ...advance]],
    ["inactive", 8, "Asia/Seoul", null],
  ];
  const hotels = Object.fromEntries(config.map(([label, count, zone, policy], h) => {
    const id = 3001 + h;
    const rooms = Array.from({ length: count }, (_, i) => {
      const roomId = 20000 + 1000 * h + i, pattern = i % 8, price = 13000 + (seed * 37 + h * 101 + i * 17) % 8000;
      const inventory = dates.map((_, d) => d === 1 && pattern === 2 || d === 4 && pattern === 6 ? "missing"
        : d === 1 && pattern === 3 || d === 7 && pattern === 7 ? "closed"
        : d === 1 && pattern === 4 ? "empty" : "open");
      const overrideDays = i % 4 === 0 ? [0, 2, 4, 6] : i % 4 === 1 ? [1] : [];
      const overrides = Object.fromEntries(overrideDays.map((d) => [dates[d], {
        id: roomId * 16 + d, price: price + 900 + d * 300,
      }]));
      return { id: roomId, parent: id, active: pattern !== 5,
        capacity: pattern === 1 ? 2 : 4, price, inventory, overrides };
    });
    return [label, { id, label, zone, policy, active: label !== "inactive", rooms }];
  }));
  return { dates, hotels };
}

function url(hotel, checkInDate, checkOutDate, guestCount, page, size) {
  return "/accommodations/" + hotel.id + "/rooms/available?checkInDate=" + checkInDate +
    "&checkOutDate=" + checkOutDate + "&guestCount=" + guestCount + "&page=" + page + "&size=" + size;
}
function available(hotel, first, length, guests) {
  return hotel.active ? hotel.rooms.filter((room) => room.active && room.capacity >= guests &&
    room.inventory.slice(first, first + length).length === length &&
    room.inventory.slice(first, first + length).every((status) => status === "open")) : [];
}
function pageCase(name, hotel, dates, offset, nights, guests, size, page = 0) {
  const results = available(hotel, offset, nights, guests);
  return { kind: "availability", name: "availability." + name, status: 200,
    path: url(hotel, dates[offset], dates[offset + nights], guests, page, size),
    expected: { total: results.length, page, size, parent: hotel.id, rooms: results
      .slice(page * size, (page + 1) * size).map(({ id, capacity, price }) => ({ id, capacity, price })) } };
}
function priceCase(name, room, date) {
  const override = room.overrides[date];
  return { kind: "price", name: "price." + name, status: 200, path: "/rooms/" + room.id + "/prices/" + date,
    expected: { id: room.id, date, price: override?.price ?? room.price,
      overrideId: override?.id ?? null, source: override ? "DAILY" : "DEFAULT" } };
}
const rejection = (name, path, status, code) => ({ kind: "control", name, path, status, code });

export function stayMatrix({ hotels, dates }) {
  const { hot, spread, west, east, inactive } = hotels;
  const [small, wide] = stayPageSizes;
  const page = (name, hotel, offset, nights, guest = 4, size = small, index = 0) =>
    pageCase(name, hotel, dates, offset, nights, guest, size, index);
  const deepIndex = Math.floor(available(hot, 0, 1, 4).length / small) - 1;
  const availability = [
    page("short_hot", hot, 0, 1), page("medium_hot", hot, 0, 3), page("long_hot", hot, 0, 7),
    page("wide_hot", hot, 0, 1, 4, wide), page("deep_hot", hot, 0, 1, 4, small, deepIndex),
    page("spread", spread, 0, 3, 2), page("guest_one", spread, 0, 3, 1),
    page("empty_guests", hot, 0, 3, 5), page("inactive", inactive, 0, 3),
    page("zone_min", west, 0, 3), page("zone_max", west, 1, 3),
  ];
  const price = [
    priceCase("hot_daily", hot.rooms[0], dates[0]), priceCase("hot_default", hot.rooms[0], dates[1]),
    priceCase("spread_daily", spread.rooms[1], dates[1]), priceCase("spread_default", spread.rooms[2], dates[2]),
    priceCase("spread_late", spread.rooms[4], dates[6]), priceCase("other_default", west.rooms[3], dates[4]),
    priceCase("spread_no_override", spread.rooms[7], dates[7]),
    priceCase("inactive_daily", inactive.rooms[0], dates[2]),
  ];
  const route = (hotel, offset, nights, guests = 4) =>
    url(hotel, dates[offset], dates[offset + nights], guests, 0, small);
  const controls = [
    rejection("control.advance_timezone", route(east, 0, 3), 409, "BOOKING_POLICY_007"),
    rejection("control.advance_max", route(west, 2, 3), 409, "BOOKING_POLICY_008"),
    rejection("control.stay_min", route(west, 0, 1), 409, "BOOKING_POLICY_005"),
    rejection("control.stay_max", route(hot, 0, 8), 409, "BOOKING_POLICY_006"),
    rejection("control.period", route(hot, 0, 0), 400, "ROOM_002"),
    rejection("control.guests", route(hot, 0, 3, 0), 400, "COMMON_001"),
    rejection("control.missing_accommodation", route({ id: 999999 }, 0, 3), 404, "ACCOMMODATION_001"),
    rejection("control.missing_room", "/rooms/999999/prices/" + dates[0], 404, "ROOM_001"),
    rejection("control.bad_price_date", "/rooms/" + hot.rooms[0].id + "/prices/not-a-date", 400, "COMMON_002"),
  ];
  const journeys = [
    page("medium_hot", hot, 0, 3), page("spread", spread, 0, 3, 2),
  ].map((test) => {
    const id = test.expected.rooms[0].id;
    const room = [...hot.rooms, ...spread.rooms].find((entry) => entry.id === id);
    return { test, byRoom: { [id]: dates.slice(0, 2).map((d) =>
      priceCase(room.overrides[d] ? "journey_daily" : "journey_default", room, d)) } };
  });
  return { availability, price, controls, journeys };
}

export function stayMatches(test, body) {
  const e = test.expected;
  if (test.kind === "control") return body?.code === test.code;
  if (test.kind === "price") return body?.roomId === e.id && body.stayDate === e.date &&
    body.nightlyPrice === e.price && body.source === e.source && body.roomDailyPriceId === e.overrideId;
  return body?.totalElements === e.total && body.totalPages === Math.ceil(e.total / e.size) &&
    body.page === e.page && body.size === e.size && body.first === (e.page === 0) &&
    body.last === (e.page + 1 >= Math.ceil(e.total / e.size)) &&
    Array.isArray(body.content) && body.content.length === e.rooms.length &&
    body.content.every((room, i) => room.roomId === e.rooms[i].id && room.accommodationId === e.parent &&
      room.status === "ACTIVE" && room.capacity === e.rooms[i].capacity && room.nightlyPrice === e.rooms[i].price &&
      !Object.hasOwn(room, "metadata"));
}
