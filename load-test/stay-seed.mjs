import { createHash } from "node:crypto";
import { stayRows, zoneBoundary } from "./k6/stay-cases.js";

export function seedStay(sql, seed, stay, size, now = Date.now()) {
  const boundary = zoneBoundary(stay, now);
  const model = stayRows(seed, stay, size, boundary);
  const hotels = Object.values(model.hotels), rooms = hotels.flatMap((hotel) => hotel.rooms);
  const policies = hotels.filter((hotel) => hotel.policy);
  const inventory = rooms.flatMap((room) => model.dates.flatMap((date, d) => {
    const state = room.inventory[d];
    return state === "missing" ? [] : [[room.id, date, state === "empty" ? 0 : 6, 0, 0,
      state === "closed" ? "CLOSED" : "OPEN"]];
  }));
  const prices = rooms.flatMap((room) => Object.entries(room.overrides)
    .map(([date, { id, price }]) => [id, room.id, date, price]));
  const encode = (x) => Number.isInteger(x) ? String(x) :
    "CONVERT(0x" + Buffer.from(x).toString("hex") + " USING utf8mb4)";
  const statements = [];
  function add(table, columns, rows) {
    for (let i = 0; i < rows.length; i += 200)
      statements.push("INSERT INTO " + table + " (" + columns + ") VALUES " +
        rows.slice(i, i + 200).map((row) => "(" + row.map(encode).join(",") + ")").join(",") + ";");
  }
  const status = (active) => active ? "ACTIVE" : "INACTIVE";
  add("accommodations", "id,name,description,country,city,region,address,status,check_in_time,check_out_time,time_zone",
    hotels.map((h) => [h.id, "Stay fixture " + h.label, "Synthetic stay fixture", "Fixtureland",
      "Stay City", "District", "Fixture address", status(h.active), "15:00:00", "11:00:00", h.zone]));
  add("accommodation_booking_policies",
    "accommodation_id,min_stay_nights,max_stay_nights,min_advance_booking_days,max_advance_booking_days",
    policies.map((h) => [h.id, ...h.policy]));
  add("rooms", "id,accommodation_id,name,capacity,nightly_price,status",
    rooms.map((r) => [r.id, r.parent, "Stay fixture room", r.capacity, r.price, status(r.active)]));
  add("room_inventories", "room_id,inventory_date,total_quantity,reserved_quantity,version,sale_status", inventory);
  add("room_daily_prices", "id,room_id,stay_date,nightly_price", prices);
  sql(["START TRANSACTION;", ...statements, "COMMIT;"].join("\n"));
  return { boundary, dates: model.dates, size,
    added: { accommodations: hotels.length, bookingPolicies: policies.length, rooms: rooms.length,
      inventories: inventory.length, dailyPrices: prices.length },
    distribution: Object.fromEntries(hotels.map((h) => {
      const nights = h.rooms.flatMap((r) => r.inventory);
      return [h.label, {
        rooms: h.rooms.length, inactiveRooms: h.rooms.filter((r) => !r.active).length,
        policy: h.policy, zone: h.zone, overrides: h.rooms.reduce((n, r) => n + Object.keys(r.overrides).length, 0),
        nights: Object.fromEntries(["missing", "closed", "empty", "open"].map((state) =>
          [state, nights.filter((value) => value === state).length])),
      }];
    })),
    fingerprint: createHash("sha256").update(JSON.stringify(model)).digest("hex") };
}
