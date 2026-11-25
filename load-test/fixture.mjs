// Only the runner's private Compose network can resolve backend. No caller-supplied URL.
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { catalogRows, matrix, matches } from "./catalog-cases.mjs";
import { detailBurstCases, detailCases, detailMatches } from "./detail-cases.mjs";
import { localDay, stayMatches, stayMatrix, stayRows, zones } from "./stay-cases.mjs";

const origin = "http://backend:8080";
const privateFile = "/private/input.json";
const adminFile = "/private/admin.json";
const runId = process.env.LOAD_ID;
const guest = {
  name: "Synthetic fixture",
  email: "synthetic-guest@example.test",
  phone: "010-0000-0000",
};
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABgAAAAMCAYAAAB4MH11AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAoSURBVDhPY/j//8N/WmIGdAFq42FggVvTlv+0xKMWEMSjFhDENLcAAHQnVU4wDObtAAAAAElFTkSuQmCC",
  "base64",
);

function ensure(value, label) {
  if (!value) throw new Error(label);
  return value;
}

async function api(path, { method = "GET", body, token, status = 200, tag, headers = {}, measureJson = false } = {}) {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid fixture path");
  const multipart = body instanceof FormData;
  let response;
  try {
    response = await fetch(origin + "/api/v1" + path, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body && !multipart ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body && !multipart ? JSON.stringify(body) : body,
    });
  } catch {
    throw new Error("Transport failure in " + (tag ?? method) + "; no replay");
  }
  if (response.status !== status) {
    await response.body?.cancel();
    throw new Error((tag ?? method) + " returned HTTP " + response.status);
  }
  if (measureJson) {
    const json = await response.text();
    return { data: JSON.parse(json), bytes: Buffer.byteLength(json) };
  }
  const data = response.headers.get("content-type")?.includes("json")
    ? await response.json()
    : await response.arrayBuffer();
  return { data, headers: response.headers };
}
const get = async (path, token) => (await api(path, { token })).data;
const post = async (path, body, token, tag) =>
  (await api(path, { method: "POST", body, token, status: 201, tag })).data;
const login = async (body) => {
  const { data } = await api("/auth/login", { method: "POST", body, tag: "fixture login" });
  return ensure(data.accessToken, "Missing fixture access token");
};
function credentials(index) {
  return { email: "load-" + index + "@example.test", password: randomBytes(20).toString("hex") };
}
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
function save(path, value) {
  // Only the fixture and pinned generator see this volume; no secrets in results or stdout.
  writeFileSync(path, JSON.stringify(value), { flag: "wx", mode: 0o644 });
}

async function upload(path, token) {
  const album = await api(path, { token });
  const revision = ensure(album.headers.get("etag"), "Missing fixture album revision");
  const body = new FormData();
  body.append("file", new Blob([png], { type: "image/png" }), "synthetic.png");
  body.append("metadata", new Blob([JSON.stringify({
    altText: "Synthetic test image", source: "Generated color bars", rightsRecord: "Synthetic load fixture",
  })], { type: "application/json" }));
  await api(path, { method: "POST", body, token, headers: { "If-Match": revision }, status: 201, tag: "media seed" });
}

const detailAdminFile = "/private/detail-admin.json";
async function seed(seedNumber, firstDay, keepDetailAdmin) {
  const admin = await login(read(adminFile));
  unlinkSync(adminFile);
  if (keepDetailAdmin) save(detailAdminFile, { runId, admin });
  const days = Array.from({ length: 5 }, (_, n) =>
    new Date(Date.parse(firstDay + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10),
  );
  const accommodations = [], rooms = [], accounts = [];
  const locations = [
    ["대한민국", "서울특별시", "종로구", "Asia/Seoul"],
    ["대한민국", "서울특별시", "강남구", "Asia/Seoul"],
    ["대한민국", "제주특별자치도", "서귀포시", "Asia/Seoul"],
    ["미국", "New York", "Manhattan", "America/New_York"],
  ];
  for (let h = 0; h < 8; h++) {
    const [country, city, region, timeZone] = locations[h % locations.length];
    const hotel = await post("/accommodations", {
      name: "Load fixture " + seedNumber + "-" + h,
      description: "Synthetic catalog",
      country, city, region, address: "Fixture address",
      checkInTime: "15:00:00", checkOutTime: "11:00:00", timeZone,
      amenities: h % 2 === 0 ? ["PARKING", "BREAKFAST"] : ["PARKING"],
    }, admin, "accommodation seed");
    const accommodationId = ensure(hotel.accommodationId, "Missing accommodation ID");
    accommodations.push({ id: accommodationId, city, timeZone });
    const path = "/accommodations/" + accommodationId;
    if (h % 2 === 0) {
      await post(path + "/booking-policy", {
        minStayNights: 1, maxStayNights: 4, minAdvanceBookingDays: 0, maxAdvanceBookingDays: 180,
      }, admin, "booking policy seed");
      await post(path + "/cancellation-policy", {
        freeCancellationDaysBeforeCheckIn: 7, cancellationDeadlineDaysBeforeCheckIn: 1,
        feeRules: [{ minDaysBeforeCheckIn: 1, feeRatePercent: 30 }],
      }, admin, "cancellation policy seed");
      await upload(path + "/media", admin);
    }
    for (let r = 0; r < 3; r++) {
      const price = 10000 + (seedNumber * 37 + h * 131 + r * 17) % 7000;
      const room = await post(path + "/rooms", {
        name: "Room " + r,
        capacity: 2 + r,
        nightlyPrice: price,
        amenities: r === 0 ? ["WIFI", "AIR_CONDITIONER"] : ["WIFI"],
        ...(r === 0 ? { metadata: { bedConfiguration: "Queen", areaSquareMeters: 28.5, view: "Courtyard" } } : {}),
      }, admin, "room seed");
      const roomId = ensure(room.roomId, "Missing room ID");
      const roomPath = "/rooms/" + roomId;
      const lastUnit = h === 7 && r === 2;
      rooms.push({ id: roomId, parent: accommodationId, price, firstPrice: price + 1000 });
      for (const inventoryDate of days)
        await post(roomPath + "/inventories", { inventoryDate, totalQuantity: lastUnit ? 1 : 32 }, admin, "inventory seed");
      await post(roomPath + "/prices", { stayDate: days[0], nightlyPrice: price + 1000 }, admin, "price seed");
      if (h % 2 === 0 && r === 0) await upload(roomPath + "/media", admin);
    }
  }
  for (let i = 0; i < 8; i++) {
    const user = credentials(i);
    const member = await post("/members", user, undefined, "member seed");
    accounts.push({ memberId: member.memberId, token: await login(user) });
  }
  for (let i = 0; i < 4; i++) {
    const room = rooms[i * 3 + 1];
    const reservation = await post("/reservations", {
      roomId: room.id, checkInDate: days[0], checkOutDate: days[2], guestCount: 2, representativeGuest: guest,
    }, accounts[i].token, "reservation seed");
    ensure(reservation.totalAmount === room.firstPrice + room.price, "Seed price snapshot mismatch");
    accounts[i].reservationId = reservation.reservationId;
  }
  const fixture = { runId, accommodations, rooms, accounts, days, guest };
  save(privateFile, fixture);
  // Fingerprint the deterministic input, excluding auth, IDs, timestamps and reservation numbers.
  console.log(JSON.stringify({
    seed: seedNumber, days, counts: { accommodations: 8, rooms: 24, media: 8,
      metadata: 8, bookingPolicies: 4, cancellationPolicies: 4, inventories: 120,
      dailyPrices: 24, members: 9, reservations: 4 },
    fingerprint: createHash("sha256").update(JSON.stringify({
      seedNumber, locations, days, prices: rooms.map(({ price }) => price),
    })).digest("hex"),
  }));
}

async function smoke(cache) {
  const fixture = read(privateFile);
  ensure(fixture.runId === runId, "Fixture ownership mismatch");
  const { accommodations, rooms, accounts, days } = fixture;
  const owner = accounts[0];
  const original = await get("/reservations/" + owner.reservationId, owner.token);
  await api("/reservations/" + owner.reservationId, { token: accounts[1].token, status: 403 });
  ensure(original.memberId === owner.memberId && original.status === "CONFIRMED", "Owner smoke mismatch");
  ensure((await get("/accommodations?size=5")).totalElements === 8, "Catalog smoke mismatch");
  const target = accommodations[0];
  const available = await get("/accommodations/" + target.id + "/rooms/available?" +
    new URLSearchParams({ checkInDate: days[0], checkOutDate: days[2], guestCount: 2 }));
  ensure(available.content.length === 3, "Availability smoke mismatch");
  if (cache === "warm") {
    for (const { id } of accommodations) await get("/accommodations/" + id);
    for (const { id } of rooms) await get("/rooms/" + id);
  }
  console.log(JSON.stringify({ passed: true, cache }));
}

const catalogFile = "/private/catalog.json";
async function checkCatalogCase(test) {
  const data = (await api(test.path, { tag: test.name })).data;
  if (!matches(test, data))
    throw new Error("Catalog contract failed: " + test.name);
  return Array.isArray(data) ? data.length : data.totalElements;
}

async function catalogPreflight(seedNumber, size) {
  const { days, runId: owner } = read(privateFile);
  ensure(owner === runId, "Catalog fixture ownership mismatch");
  const cases = matrix(catalogRows(seedNumber, size), days);
  const totals = {};
  for (const test of [...cases.search, ...cases.suggest, cases.control])
    totals[test.name] = await checkCatalogCase(test);
  for (const test of Object.values(cases.selections)) await checkCatalogCase(test);
  save(catalogFile, { runId, size, cases });
  console.log(JSON.stringify({ totals, selectionCount: Object.keys(cases.selections).length,
    deepPage: cases.search.find((test) => test.name === "search.deep").expected.index }));
}

async function catalogCheck(name) {
  const fixture = read(catalogFile);
  ensure(fixture.runId === runId, "Catalog fixture ownership mismatch");
  const choices = [...fixture.cases.search, ...fixture.cases.suggest, fixture.cases.control];
  if (name) {
    const test = ensure(choices.find((test) => test.name === name), "Unknown test case");
    await checkCatalogCase(test);
  } else {
    for (const test of [...choices, ...Object.values(fixture.cases.selections)])
      await checkCatalogCase(test);
  }
}

const detailFile = "/private/detail.json";
const detailState = () => {
  const state = read(detailFile);
  ensure(state.runId === runId, "Detail fixture ownership mismatch");
  return state.cases;
};
async function detailProbe(test, expected = (data) => detailMatches(test, data)) {
  const begin = performance.now();
  const { data, bytes } = await api(test.path, { tag: test.name, measureJson: true });
  ensure(expected(data), "Detail contract failed: " + test.name);
  return { name: test.name, ms: performance.now() - begin, bytes };
}
async function detailPreflight(seedNumber) {
  const fixture = read(privateFile);
  ensure(fixture.runId === runId, "Base fixture ownership mismatch");
  const cases = detailCases(fixture, seedNumber);
  const probes = [];
  for (const test of [...cases.hotels, ...cases.units, cases.list]) probes.push(await detailProbe(test));
  save(detailFile, { runId, cases });
  console.log(JSON.stringify({ cases, probes }));
}
async function detailPair(checkUpdated) {
  const { hotels, units } = detailState();
  const [hotel, room] = [hotels[0], units[0]];
  const probes = checkUpdated ? await Promise.all([
    detailProbe({ ...hotel, description: "Updated by isolated cache check" }),
    detailProbe(room, (data) => data?.metadata?.view === "Updated view" && detailMatches(room,
      { ...data, metadata: { ...data.metadata, view: "Courtyard" } })),
  ]) : await Promise.all([detailProbe(hotel), detailProbe(room)]);
  console.log(JSON.stringify(probes));
}
async function detailUpdate() {
  const { hotels: [hotel], units: [room] } = detailState();
  const saved = read(detailAdminFile);
  ensure(saved.runId === runId, "Detail admin ownership mismatch");
  unlinkSync(detailAdminFile); // A lost response is not permission to replay a write.
  const oldHotel = await get(hotel.path), oldRoom = await get(room.path);
  ensure(detailMatches(hotel, oldHotel) && detailMatches(room, oldRoom), "Before-update detail mismatch");
  const { name, country, city, region, address, checkInTime, checkOutTime, timeZone, amenities } = oldHotel;
  const response = await api(hotel.path, { method: "PUT", token: saved.admin, tag: "detail accommodation update",
    body: { name, country, city, region, address, checkInTime, checkOutTime, timeZone, amenities,
      description: "Updated by isolated cache check" } });
  ensure(response.data.description === "Updated by isolated cache check", "Updated accommodation response mismatch");
  const updated = await api(room.path, { method: "PUT", token: saved.admin, tag: "detail room update",
    body: { name: oldRoom.name, capacity: oldRoom.capacity, nightlyPrice: oldRoom.nightlyPrice,
      amenities: oldRoom.amenities, metadata: { bedConfiguration: "Queen", areaSquareMeters: 28.5, view: "Updated view" } } });
  ensure(updated.data.metadata?.view === "Updated view", "Updated room response mismatch");
}

const stayFile = "/private/stay.json";
function checkStayBoundary(boundary) {
  const now = Date.now();
  ensure(boundary.west === localDay(now, zones.west) && boundary.east === localDay(now, zones.east),
    "Fixture time-zone date changed; use a fresh run");
}
async function stayProbe(test) {
  const start = performance.now();
  const { data } = await api(test.path, { status: test.status, tag: test.name });
  ensure(stayMatches(test, data), "Stay fixture response mismatch: " + test.name);
  return { name: test.name, status: test.status, ...(test.code ? { code: test.code } : {}),
    ms: performance.now() - start };
}
async function stayPreflight(seed, stay, size, boundary) {
  checkStayBoundary(boundary);
  const cases = stayMatrix(stayRows(seed, stay, size, boundary));
  for (const test of [...cases.availability, ...cases.price]) await stayProbe(test);
  for (const { test, byRoom } of cases.journeys) {
    await stayProbe(test);
    for (const price of Object.values(byRoom).flat()) await stayProbe(price);
  }
  const controls = [];
  for (const test of cases.controls) controls.push(await stayProbe(test));
  checkStayBoundary(boundary);
  save(stayFile, { runId, size, boundary, cases });
  console.log(JSON.stringify({
    controls,
    pages: Object.fromEntries(cases.availability.map(({ name, expected: e }) =>
      [name, { total: e.total, page: e.page, size: e.size, returned: e.rooms.length }])),
    responseTypes: Object.fromEntries([
      ...cases.availability.map(({ name }) => [name, "page"]),
      ...[...cases.price, ...cases.journeys.flatMap(({ byRoom }) => Object.values(byRoom).flat())]
        .map(({ name, expected }) => [name, expected.source]),
    ]),
  }));
}
async function stayCheck(name) {
  const fixture = read(stayFile);
  ensure(fixture.runId === runId, "Stay fixture ownership mismatch");
  checkStayBoundary(fixture.boundary);
  const { availability, price, controls } = fixture.cases;
  const choices = [...availability, ...price, ...controls];
  if (name) await stayProbe(ensure(choices.find((test) => test.name === name), "Unknown stay test"));
  else for (const test of choices) await stayProbe(test);
}

try {
  ensure(/^[0-9a-f]{24}$/.test(runId), "Missing isolated runner identity");
  const [action, ...args] = process.argv.slice(2);
  if (action === "ready") {
    let ready = false;
    for (let i = 0; i < 90 && !ready; i++) {
      ready = await get("/accommodations?size=1").then(() => true, () => false);
      if (!ready) await delay(1000);
    }
    ensure(ready, "Backend readiness timed out");
  } else if (action === "admin") {
    const admin = credentials("admin");
    const member = await post("/members", admin, undefined, "admin signup");
    save(adminFile, admin);
    console.log(ensure(member.memberId, "Missing fixture admin ID"));
  } else if (action === "seed") {
    await seed(Number(args[0]), args[1], args[2] === "detail-lifecycle");
  } else if (action === "smoke") {
    await smoke(args[0]);
  } else if (action === "catalog-preflight") {
    await catalogPreflight(Number(args[0]), args[1]);
  } else if (action === "catalog-check") {
    await catalogCheck(args[0]);
  } else if (action === "detail-preflight") {
    await detailPreflight(Number(args[0]));
  } else if (action === "detail-burst") {
    const group = detailBurstCases(detailState(), args[0], args[1]);
    console.log(JSON.stringify(await Promise.all(group.map((test) => detailProbe(test)))));
  } else if (action === "detail-pair" || action === "detail-pair-updated") {
    await detailPair(action === "detail-pair-updated");
  } else if (action === "detail-update") {
    await detailUpdate();
  } else if (action === "stay-preflight") {
    await stayPreflight(Number(args[0]), args[1], args[2], JSON.parse(args[3]));
  } else if (action === "stay-check") {
    await stayCheck(args[0]);
  } else {
    throw new Error("Unknown fixture action");
  }
} catch (error) {
  // Do not print response bodies, tokens, credentials, SQL, or child traces.
  console.error(error instanceof SyntaxError ? "Malformed fixture response" : error.message);
  process.exitCode = 1;
}
