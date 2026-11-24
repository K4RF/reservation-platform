import { createHash } from "node:crypto";
import { catalogRows } from "./k6/catalog-cases.js";

export function seedCatalog(sql, seed, stay, size) {
  const rows = catalogRows(seed, size);
  const days = Array.from({ length: 3 }, (_, i) =>
    new Date(Date.parse(stay + "T00:00:00Z") + i * 86400000).toISOString().slice(0, 10));
  const encode = (value) => value === null ? "NULL" : Number.isInteger(value) ? String(value) :
    "CONVERT(0x" + Buffer.from(value).toString("hex") + " USING utf8mb4)";
  const statements = [];
  function insert(table, fields, values) {
    for (let i = 0; i < values.length; i += 250)
      statements.push("INSERT INTO " + table + " (" + fields + ") VALUES " +
        values.slice(i, i + 250).map((row) => "(" + row.map(encode).join(",") + ")").join(",") + ";");
  }
  const status = (active) => active ? "ACTIVE" : "INACTIVE";
  insert("accommodations", "id,name,description,country,city,region,address,status,check_in_time,check_out_time,time_zone",
    rows.map((r) => [r.id, r.name, "Search fixture", r.country, r.city, r.region, r.address,
      status(r.active), "15:00:00", "11:00:00", r.country === "Otherland" ? "America/New_York" : "Asia/Seoul"]));
  insert("accommodation_amenities", "accommodation_id,amenity",
    rows.flatMap((r) => [[r.id, "PARKING"], ...(r.breakfast ? [[r.id, "BREAKFAST"]] : [])]));
  insert("accommodation_booking_policies",
    "accommodation_id,min_stay_nights,max_stay_nights,min_advance_booking_days,max_advance_booking_days",
    rows.filter((r) => r.policy).map((r) => [r.id, r.policy, 4, 0, 180]));
  insert("rooms", "id,accommodation_id,name,capacity,nightly_price,status",
    rows.flatMap((a) => a.rooms.map((r) => [r.id, a.id, "Search fixture room", r.capacity, r.price, status(r.active)])));
  const rooms = rows.flatMap((r) => r.rooms);
  insert("room_amenities", "room_id,amenity",
    rooms.flatMap((r) => [[r.id, "WIFI"], ...(r.ac ? [[r.id, "AIR_CONDITIONER"]] : [])]));
  const inventories = rooms.flatMap((r) => days.flatMap((day, index) => {
    const availability = index === 1 ? r.secondNight : "open";
    return availability === "missing" ? [] : [[r.id, day, availability === "sold" ? 0 : 10, 0, 0,
      availability === "closed" ? "CLOSED" : "OPEN"]];
  }));
  insert("room_inventories", "room_id,inventory_date,total_quantity,reserved_quantity,version,sale_status", inventories);
  insert("room_daily_prices", "room_id,stay_date,nightly_price",
    rows.map((r) => [r.rooms[0].id, days[0], 999999]));
  sql(["START TRANSACTION;", ...statements, "COMMIT;"].join("\n"));
  return { size, fingerprint: createHash("sha256").update(JSON.stringify({ rows, days })).digest("hex"),
    added: { accommodations: rows.length, rooms: rooms.length, inventories: inventories.length,
      bookingPolicies: rows.filter((r) => r.policy).length, dailyPrices: rows.length },
    distribution: { active: rows.filter((r) => r.active).length,
      legacy: rows.filter((r) => r.country === null).length,
      popularCity: rows.filter((r) => r.country === "Fixtureland" && r.city === "Port Meridian").length,
      locations: new Set(rows.filter((r) => r.city).map((r) => JSON.stringify([r.country, r.city, r.region]))).size,
      inactiveRooms: rooms.filter((r) => !r.active).length,
      secondNight: Object.fromEntries(["open", "sold", "missing", "closed"]
        .map((mode) => [mode, rooms.filter((r) => r.secondNight === mode).length])) },
  };
}
