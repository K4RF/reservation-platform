import exec from "k6/execution";
import { plan } from "./profiles.js";
import { stayMatches } from "./stay-cases.js";
import { request } from "./requests.js";

const p = plan(__ENV.LOAD_PROFILE, __ENV.LOAD_CACHE_MODE, __ENV.LOAD_ROOM_MODE, __ENV.LOAD_CATALOG_SIZE);
const { runId, size, cases } = JSON.parse(open("/private/stay.json"));
if (!/^[a-f0-9]{24}$/.test(runId) || runId !== __ENV.LOAD_ID || p.catalogSize !== size || !p.stayRead)
  throw new Error("Missing verified stay fixture");

export const options = {
  scenarios: Object.fromEntries(p.stages.map(({ name, rate, seconds, at, vus }) => [name, {
    executor: "constant-arrival-rate", rate, timeUnit: "1s", duration: seconds + "s",
    startTime: at + "s", preAllocatedVUs: vus, maxVUs: vus, gracefulStop: "5s", exec: "stay",
  }])),
  maxRedirects: 0,
  systemTags: ["name", "method", "status", "scenario", "expected_response", "error_code"],
  thresholds: { load_system_error: [{ threshold: "rate==0", abortOnFail: true, delayAbortEval: "3s" }] },
};

const read = (test) => request("GET", test.path, test.name, 200, { validate: (body) => stayMatches(test, body) });
export function stay() {
  const i = exec.scenario.iterationInTest, hot = exec.scenario.name === "popular";
  if (p.stayRead === "availability") return void read(cases.availability[hot ? 1 : i % cases.availability.length]);
  if (p.stayRead === "price") return void read(cases.price[i % (hot ? 2 : cases.price.length)]);
  const { test, byRoom } = cases.journeys[hot ? 0 : i % cases.journeys.length];
  const result = read(test);
  if (!result) return;
  const prices = byRoom[result.content[0]?.roomId];
  if (!prices || prices.length !== 2) exec.test.abort("Unknown room selected in stay journey");
  for (const price of prices) read(price);
}

export function handleSummary(data) {
  return { "/results/k6-summary.json": JSON.stringify(data, null, 2) };
}
