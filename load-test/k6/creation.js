import exec from "k6/execution";
import { plan } from "./profiles.js";
import { request } from "./requests.js";
import { creationInput, creationMatches } from "./creation-cases.js";

const p = plan(__ENV.LOAD_PROFILE, __ENV.LOAD_CACHE_MODE, __ENV.LOAD_ROOM_MODE);
const fixture = JSON.parse(open("/private/input.json"));
if (!p.creation || !/^[a-f0-9]{24}$/.test(fixture.runId) || fixture.runId !== __ENV.LOAD_ID)
  throw new Error("Missing verified creation fixture");

export const options = {
  scenarios: Object.fromEntries(p.stages.map(({ name, at, seconds, vus, rate, iterations }) => [name, {
    startTime: at + "s", exec: "create", gracefulStop: "5s",
    ...(iterations ? { executor: "per-vu-iterations", vus, iterations: 1, maxDuration: seconds + "s" } :
      { executor: "constant-arrival-rate", rate, timeUnit: "1s", duration: seconds + "s",
        preAllocatedVUs: vus, maxVUs: vus }),
  }])),
  maxRedirects: 0,
  systemTags: ["name", "method", "status", "scenario", "expected_response", "error_code"],
  summaryTrendStats: ["count", "med", "p(95)", "p(99)", "max"],
  thresholds: { load_system_error: [{ threshold: "rate==0", abortOnFail: true, delayAbortEval: "3s" }] },
};

const ledger = (data) => console.log("CREATION_LEDGER " + JSON.stringify(data));
export function create() {
  const scenario = exec.scenario.name, iteration = exec.scenario.iterationInTest, vu = exec.vu.idInTest - 1;
  const a = creationInput(fixture, p.creation, scenario, iteration, vu);
  ledger({ event: "dispatch", ordinal: a.ordinal, scenario, iteration, ownerIndex: vu, at: Date.now() });
  request("POST", "/reservations", "reservation.create", 201, {
    owner: fixture.accounts[vu], peer: a.host === "backend-peer",
    exhausted: p.creation === "exhaustion",
    ...(p.creation === "redis-down" ? { expectedFailure: { status: 503, code: "INVENTORY_013" }, timeout: "12s" } : {}),
    body: { roomId: a.roomId, guestCount: a.guestCount, checkInDate: a.checkInDate, checkOutDate: a.checkOutDate,
      representativeGuest: { ...fixture.guest, name: "Load-creation-" + a.ordinal } },
    validate: (body) => creationMatches(a, body),
    onResult: (value) => ledger({ event: "response", ordinal: a.ordinal, at: Date.now(), ...value }),
  });
}

export function handleSummary(data) {
  return { "/results/k6-summary.json": JSON.stringify(data, null, 2) };
}
