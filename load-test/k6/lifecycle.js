import exec from "k6/execution";
import { plan } from "./profiles.js";
import { request } from "./requests.js";
import {
  cycleInput, raceInput, matchesLifecycle, matchesPolicy, matchesCancellation,
  changePath, changeBody, createBody, raceFailures, historyMatches,
} from "./lifecycle-cases.js";

const p = plan(__ENV.LOAD_PROFILE, __ENV.LOAD_CACHE_MODE, __ENV.LOAD_ROOM_MODE);
const f = JSON.parse(open("/private/input.json"));
const history = p.lifecycle === "history" ? JSON.parse(open("/private/history.json")) : null;
if (!p.lifecycle || !/^[0-9a-f]{24}$/.test(f.runId) || f.runId !== __ENV.LOAD_ID || (history && history.runId !== f.runId))
  throw new Error("Missing verified lifecycle fixture");

export const options = {
  scenarios: Object.fromEntries(p.stages.map(({ name, at, seconds, vus, rate, iterations }) => [name, {
    startTime: at + "s", exec: "run", gracefulStop: "5s",
    ...(iterations ? { executor: "per-vu-iterations", vus, iterations: 1, maxDuration: seconds + "s" } :
      { executor: "constant-arrival-rate", rate, timeUnit: "1s", duration: seconds + "s",
        preAllocatedVUs: vus, maxVUs: vus }),
  }])),
  maxRedirects: 0,
  systemTags: ["name", "method", "status", "scenario", "expected_response", "error_code"],
  summaryTrendStats: ["count", "med", "p(95)", "p(99)", "max"],
  thresholds: { load_system_error: [{ threshold: "rate==0", abortOnFail: true, delayAbortEval: "3s" }] },
};

const remember = (data) => console.log("LIFECYCLE_LEDGER " + JSON.stringify(data));
function write(a, op, id, body, validate, expectedFailures) {
  const key = { ordinal: a.ordinal, ownerIndex: a.ownerIndex, scenario: exec.scenario.name,
    iteration: exec.scenario.iterationInTest, op };
  remember({ ...key, event: "dispatch", id, at: Date.now() });
  return request(op === "create" ? "POST" : "PATCH",
    op === "create" ? "/reservations" : changePath(id) + (op === "cancel" ? "/cancel" : ""),
    "lifecycle." + op, op === "create" ? 201 : 200, {
      body, owner: f.accounts[a.ownerIndex], validate, expectedFailures,
      onResult: (result, payload) => remember({ ...key, event: "response", ...result, at: Date.now(),
        ...(op === "cancel" && payload ? { closedAmount: payload.totalAmount, fee: payload.cancellationFeeAmount } : {}) }),
    });
}

export function run() {
  const stage = exec.scenario.name, i = exec.scenario.iterationInTest;
  if (p.lifecycle === "history") {
    const test = history.cases[i % history.cases.length];
    request("GET", test.path, test.name, 200, { owner: f.accounts[0],
      validate: (data) => historyMatches(test, data) });
    return;
  }
  if (p.lifecycle === "race") {
    const a = raceInput(f, stage, i);
    if (a.op === "change")
      write(a, a.op, a.id, changeBody(a.changed), (data) => matchesLifecycle(a.changed, data), raceFailures(a.op));
    else write(a, a.op, a.id, null, (data) =>
      matchesCancellation(a.created, a.id, data) || matchesCancellation(a.changed, a.id, data), raceFailures(a.op));
    return;
  }
  const a = cycleInput(f, stage, i, exec.vu.idInTest - 1);
  const created = write(a, "create", null, createBody(a.created, f.guest, a.ordinal),
    (data) => matchesLifecycle(a.created, data) && matchesPolicy(a.created, data.cancellationPolicySnapshot));
  if (!created) return;
  const id = created.reservationId;
  const changed = write(a, "change", id, changeBody(a.changed),
    (data) => data.reservationId === id && matchesLifecycle(a.changed, data) && matchesPolicy(a.changed, data.cancellationPolicySnapshot));
  if (!changed) return;
  write(a, "cancel", id, null, (data) => matchesCancellation(a.changed, id, data));
}

export function handleSummary(data) {
  return { "/results/k6-summary.json": JSON.stringify(data, null, 2) };
}
