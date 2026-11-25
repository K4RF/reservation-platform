import exec from "k6/execution";
import { plan } from "./profiles.js";
import { detailReadCase, detailMatches } from "./detail-cases.js";
import { request } from "./requests.js";

const p = plan(__ENV.LOAD_PROFILE, __ENV.LOAD_CACHE_MODE, __ENV.LOAD_ROOM_MODE);
const { runId, cases } = JSON.parse(open("/private/detail.json"));
if (runId !== __ENV.LOAD_ID || !/^[0-9a-f]{24}$/.test(runId) || !["reads", "outage"].includes(p.detail))
  throw new Error("Missing verified detail fixture");

export const options = {
  scenarios: Object.fromEntries(p.stages.map(({ name, at, seconds, vus, rate, iterations }) => [name, {
    startTime: at + "s", gracefulStop: "5s", exec: "detail",
    ...(iterations ? { executor: "per-vu-iterations", vus, iterations, maxDuration: seconds + "s" } :
      { executor: "constant-arrival-rate", rate, timeUnit: "1s", duration: seconds + "s",
        preAllocatedVUs: vus, maxVUs: vus }),
  }])),
  maxRedirects: 0,
  systemTags: ["name", "method", "status", "scenario", "expected_response", "error_code"],
  thresholds: { load_system_error: [{ threshold: "rate==0", abortOnFail: true, delayAbortEval: "3s" }] },
};

export function detail() {
  const test = detailReadCase(cases, exec.scenario.name, exec.scenario.iterationInTest);
  request("GET", test.path, test.name, 200, { validate: (data) => detailMatches(test, data) });
}

export function handleSummary(data) {
  return { "/results/k6-summary.json": JSON.stringify(data, null, 2) };
}
