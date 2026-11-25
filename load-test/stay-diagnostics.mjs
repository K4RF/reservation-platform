import { captureSelects, catalogSqlDelta, catalogSqlSnapshot } from "./catalog-diagnostics.mjs";

export function classifyStaySelect(statement) {
  const q = statement.replaceAll("\x60", "").trim();
  if (!/^select\s/i.test(q)) return null;
  if (/\bfrom\s+rooms\b/i.test(q) && /\bfrom\s+room_inventories\b/i.test(q))
    return /^select\s+count\s*\(/i.test(q) ? "availabilityCount" : "availabilityContent";
  if (/\bfrom\s+accommodation_booking_policies\b/i.test(q)) return "bookingPolicy";
  if (/\bfrom\s+room_daily_prices\b/i.test(q)) return "dailyPrice";
  if (/\bfrom\s+accommodations\b/i.test(q) && /\bwhere\s+\w+\s*\.\s*id\s*=/i.test(q))
    return "accommodation";
  if (/\bfrom\s+rooms\b/i.test(q) && /\bwhere\s+\w+\s*\.\s*id\s*=/i.test(q)) return "room";
  if (/\bfrom\s+(catalog_media|room_amenities|accommodation_amenities)\b/i.test(q)) return "enrichment";
  return null;
}

export const staySnapshot = (sql) => catalogSqlSnapshot(sql, classifyStaySelect);
export const stayDelta = catalogSqlDelta;
const count = (delta, name) => delta.totals[name]?.calls ?? 0;

export function verifyStayRead(scope, result, delta, responseTypes) {
  const sizes = { availability: 0, price: 0, DAILY: 0, DEFAULT: 0 };
  for (const [name, outcomes] of Object.entries(result.operations)) {
    const family = name.split(".")[0];
    const response = responseTypes[name];
    if (!["price", "availability"].includes(family) || !response) throw new Error("Unexpected stay benchmark response");
    sizes[family] += outcomes.success ?? 0;
    if (family === "price") {
      if (!["DAILY", "DEFAULT"].includes(response)) throw new Error("Unclassified price outcome");
      sizes[response] += outcomes.success ?? 0;
    }
  }
  const { availability, price } = sizes;
  if ((scope === "availability" ? !availability || price : scope === "price" ? !price || availability :
      !availability || price !== 2 * availability) || result.count !== availability + price ||
      [count(delta, "accommodation"), count(delta, "bookingPolicy"), count(delta, "availabilityContent")]
        .some((calls) => calls !== availability) ||
      count(delta, "availabilityCount") > availability ||
      count(delta, "room") !== price || count(delta, "dailyPrice") !== price)
    throw new Error("Stay HTTP/SQL did not reconcile: " + JSON.stringify({ sizes, calls: delta.totals }));
  return sizes;
}

const tables = ["accommodations", "accommodation_booking_policies", "rooms", "room_inventories", "room_daily_prices"];
export function stayChecksums(sql) {
  const rows = sql("CHECKSUM TABLE " + tables.join(", ") + " EXTENDED;").split(/\r?\n/);
  const result = Object.fromEntries(rows.map((row) => row.split("\t")));
  if (rows.length !== tables.length || tables.some((table) => !/^\d+$/.test(result["reservation_load." + table] ?? "")))
    throw new Error("Unable to read all stay fixture checksums");
  return result;
}

const representative = {
  availability: ["short_hot", "medium_hot", "long_hot", "wide_hot", "deep_hot", "spread", "inactive"],
  price: ["hot_daily", "hot_default", "spread_daily", "spread_default"],
};
export function explainStay({ sql, fixture }, scope) {
  const out = {};
  for (const test of representative[scope]) {
    const name = scope + "." + test;
    const before = staySnapshot(sql);
    const trace = captureSelects(sql, () => fixture("stay-check", name), classifyStaySelect);
    const delta = stayDelta(before, staySnapshot(sql));
    const primary = scope === "availability" ? "availabilityContent" : "dailyPrice";
    if (count(delta, primary) !== 1 || trace.filter(({ kind }) => kind === primary).length !== 1)
      throw new Error("Unexpected SQL for " + name + ": " + trace.map(({ kind }) => kind).join(","));
    out[name] = { totals: delta.totals, statements: trace.map((entry) =>
      [primary, "availabilityCount", "room"].includes(entry.kind) ?
        { ...entry, plan: sql("EXPLAIN ANALYZE " + entry.statement + ";") } : entry) };
  }
  return out;
}
