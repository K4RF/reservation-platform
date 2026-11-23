import exec from "k6/execution";
import { plan } from "./profiles.js";
import { request } from "./requests.js";

const profile = __ENV.LOAD_PROFILE;
const cache = __ENV.LOAD_CACHE_MODE;
const roomMode = __ENV.LOAD_ROOM_MODE;
const p = plan(profile, cache, roomMode);
const fixture = JSON.parse(open("/private/input.json"));
if (!/^[a-f0-9]{24}$/.test(__ENV.LOAD_ID) || fixture.runId !== __ENV.LOAD_ID) {
  throw new Error("Missing verified isolated fixture");
}
const { accommodations, rooms, accounts, days, guest } = fixture;
const scenarios = {};
if (p.smoke) scenarios.smoke = {
  executor: "shared-iterations", vus: 1, iterations: p.smoke, maxDuration: "40s",
  gracefulStop: "5s", exec: "smoke",
};
if (p.rate) scenarios.read = {
  executor: "constant-arrival-rate", ...{ rate: p.rate, timeUnit: "1s", duration: p.seconds + "s" },
  preAllocatedVUs: p.readVus, maxVUs: p.readVus, gracefulStop: "5s", exec: "read",
};
if (p.reads) scenarios.read = {
  executor: "shared-iterations", vus: 1, iterations: p.reads, maxDuration: "30s",
  gracefulStop: "5s", exec: "read",
};
if (p.writers) scenarios.write = {
  executor: "per-vu-iterations", vus: p.writers, iterations: p.writes, maxDuration: "35s",
  gracefulStop: "5s", exec: "write",
};
export const options = {
  scenarios,
  maxRedirects: 0,
  // Never retain raw URL, per-user/VU IDs, or error strings.
  systemTags: ["name", "method", "status", "scenario", "expected_response", "error_code"],
  summaryTrendStats: ["count", "med", "p(95)", "p(99)", "max"],
  thresholds: { load_system_error: [{ threshold: "rate==0", abortOnFail: true, delayAbortEval: "3s" }] },
};

export function read() {
  const i = exec.scenario.iterationInTest % accommodations.length;
  const hotel = accommodations[i];
  const room = rooms[3 * i];
  const prefix = "/accommodations/" + hotel.id;
  request("GET", "/accommodations?size=5&city=" + encodeURIComponent(hotel.city), "catalog.search", 200, {
    validate: (row) => row.content?.length > 0,
  });
  request("GET", prefix, "catalog.accommodation", 200, { validate: (row) => row.accommodationId === hotel.id });
  request("GET", "/rooms/" + room.id, "catalog.room", 200, { validate: (row) => row.roomId === room.id });
  request("GET", prefix + "/rooms/available?checkInDate=" + days[0] + "&checkOutDate=" + days[2] + "&guestCount=2",
    "catalog.availability", 200, { validate: (row) => row.content?.length > 0 });
}

export function write() {
  // Read-only VUs never use auth; write VUs have unique owners. No renewal or login is measured.
  const ix = exec.vu.idInTest - 1;
  const owner = accounts[ix];
  if (!owner) exec.test.abort("Unexpected write VU assignment");
  const exhausted = profile === "exhaustion";
  const room = exhausted ? rooms[rooms.length - 1] : roomMode === "hot" ? rooms[0] : rooms[ix * 3];
  if (!room) exec.test.abort("Unexpected room assignment");
  const created = request("POST", "/reservations", "reservation.create", 201, {
    owner, exhausted, body: { roomId: room.id, guestCount: 2, checkInDate: days[0],
      checkOutDate: days[2], representativeGuest: guest },
    validate: (row) => row.memberId === owner.memberId && row.roomId === room.id &&
      row.status === "CONFIRMED" && row.reservationId > 0 && row.totalAmount === room.firstPrice + room.price,
  });
  if (!created || exhausted) return;
  const path = "/reservations/" + created.reservationId;
  const changed = request("PATCH", path, "reservation.change", 200, {
    owner, body: { checkInDate: days[1], checkOutDate: days[3] },
    validate: (row) => row.reservationId === created.reservationId && row.totalAmount === 2 * room.price &&
      row.checkInDate === days[1] && row.checkOutDate === days[3],
  });
  if (changed) request("PATCH", path + "/cancel", "reservation.cancel", 200, {
    owner, validate: (row) => row.reservationId === created.reservationId && row.status === "CANCELLED" &&
      row.estimatedRefundAmount === 2 * room.price,
  });
}

export function smoke() {
  read();
  write();
}

export function handleSummary(data) {
  return { "/results/k6-summary.json": JSON.stringify(data, null, 2) };
}
