import exec from "k6/execution";
import { plan } from "./profiles.js";
import { matches, pathWith, selectedCase } from "./catalog-cases.js";
import { request } from "./requests.js";

const p = plan(__ENV.LOAD_PROFILE, __ENV.LOAD_CACHE_MODE, __ENV.LOAD_ROOM_MODE, __ENV.LOAD_CATALOG_SIZE);
const { runId, size, cases } = JSON.parse(open("/private/catalog.json"));
if (!/^[a-f0-9]{24}$/.test(runId) || runId !== __ENV.LOAD_ID || p.catalogSize !== size)
  throw new Error("Missing verified catalog fixture");
export const options = {
  scenarios: Object.fromEntries(p.stages.map(({ name, rate, seconds, at, vus }) => [name, {
    executor: "constant-arrival-rate", rate, timeUnit: "1s", duration: seconds + "s",
    startTime: at + "s", preAllocatedVUs: vus, maxVUs: vus, gracefulStop: "5s", exec: "catalog",
  }])),
  maxRedirects: 0,
  systemTags: ["name", "method", "status", "scenario", "expected_response", "error_code"],
  summaryTrendStats: ["count", "med", "p(95)", "p(99)", "max"],
  thresholds: { load_system_error: [{ threshold: "rate==0", abortOnFail: true, delayAbortEval: "3s" }] },
};

function measure(test, path = test.path) {
  return request("GET", path, test.name, 200, { validate: (data) => matches(test, data) });
}
export function catalog() {
  const i = exec.scenario.name === "popular" ? 0 : exec.scenario.iterationInTest;
  if (p.catalog === "search") return void measure(cases.search[i % cases.search.length]);
  const eligible = p.catalog === "journey" ? cases.suggest.filter((test) => test.expected.length) : cases.suggest;
  const result = measure(eligible[i % eligible.length]);
  if (p.catalog === "journey" && result?.length) {
    const chosen = result[0];
    const expected = selectedCase(cases, chosen);
    if (!expected) exec.test.abort("Unexpected selected location");
    measure(expected, pathWith("/accommodations", { ...chosen.searchParams, page: 0, size: 10, sortBy: "ID", direction: "ASC" }));
  }
}

export function handleSummary(data) {
  return { "/results/k6-summary.json": JSON.stringify(data, null, 2) };
}
