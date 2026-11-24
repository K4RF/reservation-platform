// Deterministic test-only data. Names use comparable ASCII and never overlap the base fixture.
export const sizes = { small: 96, expanded: 768 };
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const host = "/accommodations";
const suggestions = host + "/locations/suggestions";
const pad = (x) => String(x).padStart(2, "0");
const tokens = (text) => text.trim().toLowerCase().split(/\s+/u);
const lower = (text) => (text ?? "").toLowerCase();
const includes = (text, term) => lower(text).includes(term);
const tuple = ({ country, city, region }) => JSON.stringify([country, city, region ?? null]);

export function catalogRows(seed, size) {
  if (!Object.hasOwn(sizes, size) || !Number.isInteger(seed) || seed < 1 || seed > 999999)
    throw new Error("Invalid catalog fixture");
  return Array.from({ length: sizes[size] }, (_, i) => {
    const group = (i + seed) % 20;
    const legacy = group === 19;
    const location = legacy ? [null, null, null] :
      group < 12 ? ["Fixtureland", "Port Meridian", group < 8 ? "Downtown" : "Harbor Pier"] :
      group === 12 ? ["Otherland", "Port Meridian", "Downtown"] :
      group === 13 ? ["Fixtureland", "North Haven", "Downtown"] :
      group === 14 ? ["Fixtureland", "Quiet Cove", "Island End"] :
      ["Fixtureland", "River City " + pad(i % 24), "Riverwalk " + pad(i % 24)];
    const [country, city, region] = location;
    const primary = {
      id: 10000 + 2 * i,
      price: 10000 + i % 5 * 2500,
      capacity: i % 7 === 0 ? 2 : 4,
      ac: i % 6 !== 0,
      active: i % 9 !== 0,
      // Only date 2 can be missing, closed or sold out; checking day 1 alone would be wrong.
      secondNight: ["open", "open", "open", "missing", "closed", "sold"][i % 6],
    };
    const alternate = { id: primary.id + 1, price: 9000, capacity: 6, ac: false,
      active: true, secondNight: "open" };
    return {
      id: 1000 + i, name: "Bench " + seed + " Band " + pad(i % 12), country, city, region,
      address: legacy ? "Legacy Dock" : "Synthetic address", active: i % 8 !== 0,
      breakfast: i % 5 !== 0, policy: i % 11 === 0 ? 3 : i % 4 === 0 ? 1 : null,
      rooms: [primary, alternate],
    };
  });
}

export function pathWith(path, values) {
  const encoded = Object.entries(values).flatMap(([key, value]) =>
    (Array.isArray(value) ? value : [value]).map((v) => encodeURIComponent(key) + "=" + encodeURIComponent(v)));
  return path + "?" + encoded.join("&");
}

function page(name, rows, params, matches, direction = "ASC", order = "ID") {
  const selected = rows.filter(matches).sort((a, b) => {
    const main = order === "NAME" ? cmp(a.name, b.name) : cmp(a.id, b.id);
    return (direction === "DESC" ? -main : main) || a.id - b.id;
  });
  const { page: index = 0, size = 10 } = params;
  return { name, path: pathWith(host, { status: "ACTIVE", ...params, page: index, size, sortBy: order, direction }),
    expected: { ids: selected.slice(index * size, (index + 1) * size).map((row) => row.id),
      total: selected.length, index, size } };
}

function candidates(rows, query) {
  const q = tokens(query).join(" ");
  if ([...q].length < 2) return [];
  const distinct = new Map();
  for (const r of rows.filter((r) => r.active && r.country && r.city)) {
    for (const region of [undefined, r.region]) {
      const isRegion = region !== undefined;
      const names = isRegion ? [region, r.city + " " + region] : [r.city];
      if (!tokens(q).every((part) => includes(r.city, part) || includes(region, part))) continue;
      const searchParams = { country: r.country, city: r.city, ...(isRegion ? { region } : {}), status: "ACTIVE" };
      const key = tuple(searchParams);
      if (distinct.has(key)) continue;
      const labels = names.map(lower);
      const rank = labels.includes(q) ? 0 : labels.some((s) => s.startsWith(q)) ? 1 :
        labels.some((s) => s.includes(q)) ? 2 : 3;
      distinct.set(key, { rank, type: isRegion ? "REGION" : "CITY",
        displayName: region ?? r.city, searchParams });
    }
  }
  return [...distinct.values()].sort((a, b) => a.rank - b.rank || cmp(a.type, b.type) ||
    cmp(a.searchParams.country, b.searchParams.country) || cmp(a.searchParams.city, b.searchParams.city) ||
    cmp(a.searchParams.region ?? "", b.searchParams.region ?? ""))
    .slice(0, 10).map(({ type, displayName, searchParams }) => ({ type, displayName, searchParams }));
}

export function matrix(rows, days) {
  const hot = { country: "Fixtureland", city: "Port Meridian", region: "Downtown" };
  const rare = { country: "Fixtureland", city: "Quiet Cove", region: "Island End" };
  const exact = (location) => (r) => r.active && r.country === location.country && r.city === location.city &&
    (!Object.hasOwn(location, "region") || r.region === location.region);
  const bench = rows[0].name.split(" Band")[0];
  const prefix = { name: bench };
  const active = (r) => r.active;
  const roomMatch = (r) => r.capacity >= 4 && r.price >= 10000 && r.price <= 17500 && r.ac && r.active;
  const amenityMatch = (r) => r.active && r.breakfast && r.rooms.some(roomMatch);
  const filters = { ...prefix, accommodationAmenities: ["PARKING", "BREAKFAST"],
    roomAmenities: ["WIFI", "AIR_CONDITIONER"], guestCount: 4, minPrice: 10000, maxPrice: 17500 };
  const dates = { checkInDate: days[0], checkOutDate: days[2] };
  const available = (r) => r.policy !== 3 && r.rooms.some((room) => roomMatch(room) && room.secondNight === "open");
  const search = [
    page("search.exact_hot", rows, hot, exact(hot)),
    page("search.exact_rare", rows, rare, exact(rare), "DESC"),
    page("search.free_tokens", rows, { destination: "Downtown\u2003 Meridian" },
      (r) => r.active && includes(r.city, "meridian") && includes(r.region, "downtown")),
    page("search.amenities_price", rows, filters, amenityMatch),
    page("search.stay", rows, { ...filters, ...dates }, (r) => amenityMatch(r) && available(r)),
    page("search.not_available", rows, { ...filters, ...dates, available: false },
      (r) => r.active && r.breakfast && !available(r)),
    page("search.shallow", rows, prefix, active),
    page("search.deep", rows, { ...prefix, page: Math.floor(rows.filter(active).length / 10) - 1 }, active),
    page("search.name_desc", rows, prefix, active, "DESC", "NAME"),
    page("search.empty", rows, { ...hot, destination: "Quiet Cove" }, () => false),
    page("search.legacy", rows, { ...prefix, region: "Legacy Dock" }, (r) => r.active && r.city === null),
  ];
  const suggest = [
    ["suggest.prefix", "Port"], ["suggest.partial", "ridian"],
    ["suggest.tokens", "Downtown Meridian"], ["suggest.homonyms", "Downtown"],
    ["suggest.normalized", "\u2003 PORT   meridian  Downtown\u2003"],
    ["suggest.limit", "Riverwalk"], ["suggest.empty", "No matching district"],
    ["suggest.literal", "River%"], ["suggest.legacy", "Legacy Dock"],
  ].map(([name, q]) => ({ name, path: pathWith(suggestions, { q }), expected: candidates(rows, q) }));
  const control = { name: "control.short", path: pathWith(suggestions, { q: "P" }), expected: [] };
  const selections = {};
  for (const c of suggest)
    for (const { searchParams } of c.expected)
      selections[tuple(searchParams)] = page("search.selected", rows, searchParams, exact(searchParams));
  return { search, suggest, selections, control };
}

export function matches(pageCase, response) {
  const e = pageCase.expected;
  if (Array.isArray(e)) return Array.isArray(response) && response.length === e.length &&
    response.every((r, i) => r.type === e[i].type && r.displayName === e[i].displayName &&
      r.searchParams?.status === "ACTIVE" && tuple(r.searchParams) === tuple(e[i].searchParams) &&
      Object.keys(r.searchParams).length === Object.keys(e[i].searchParams).length &&
      Object.hasOwn(r.searchParams, "region") === Object.hasOwn(e[i].searchParams, "region"));
  return response?.totalElements === e.total && response.page === e.index && response.size === e.size &&
    response.totalPages === Math.ceil(e.total / e.size) && response.first === (e.index === 0) &&
    response.last === (e.index + 1 >= Math.ceil(e.total / e.size)) &&
    response.content?.length === e.ids.length &&
    response.content.every((r, i) => r.accommodationId === e.ids[i] && r.status === "ACTIVE");
}

export const selectedCase = (cases, candidate) => cases.selections[tuple(candidate.searchParams)];
