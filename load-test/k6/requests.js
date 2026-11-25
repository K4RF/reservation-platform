import http from "k6/http";
import exec from "k6/execution";
import { Counter, Rate, Trend } from "k6/metrics";

const origin = "http://backend:8080/api/v1";
const operations = new Counter("load_operations");
const bad = new Rate("load_system_error");
const outcomeLatency = new Trend("load_outcome_duration", true);
const knownCodes = ["INVENTORY_005", "INVENTORY_011", "INVENTORY_012", "INVENTORY_013",
  "BOOKING_POLICY_005", "AUTH_001", "AUTH_002", "COMMON_001", "COMMON_002"];

export function request(method, path, endpoint, expected, {
  body, owner, exhausted, validate, expectedFailure, onResult, peer = false, timeout = "5s",
} = {}) {
  if (!path.startsWith("/") || path.startsWith("//")) exec.test.abort("Unexpected route");
  const response = http.request(method, (peer ? "http://backend-peer:8080/api/v1" : origin) + path,
    body ? JSON.stringify(body) : null, {
    timeout,
    redirects: 0,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(owner ? { Authorization: "Bearer " + owner.token } : {}),
    },
    tags: { name: endpoint },
  });
  let data;
  try { data = onResult ? JSON.parse(response.body) : response.json(); } catch { /* malformed success is not confirmed */ }
  const write = method !== "GET";
  let correct = false, validatorError = false;
  if (response.status === expected && data) {
    try { correct = !validate || validate(data); } catch { validatorError = true; }
  }
  const rejection = (exhausted && response.status === 409 && data?.code === "INVENTORY_005") ||
    (expectedFailure && response.status === expectedFailure.status && data?.code === expectedFailure.code);
  const unknown = write && !rejection && (!response.status || response.status >= 500 ||
    (response.status >= 200 && response.status < 400 && !correct));
  const outcome = correct ? "success" : rejection ? "expected_rejection" :
    unknown ? "unconfirmed_write" : "system_error";
  const tags = { name: endpoint, outcome, domain: knownCodes.includes(data?.code) ? data.code : "none_or_other",
    status: String(response.status) };
  operations.add(1, tags);
  outcomeLatency.add(response.timings.duration, tags);
  bad.add(outcome === "system_error" || unknown, { name: endpoint });
  onResult?.({ status: response.status, code: tags.domain, outcome,
    ...(validatorError ? { validatorError: true } : {}),
    reservationId: correct && write ? data.reservationId : null });
  if (unknown || (onResult && outcome === "system_error"))
    exec.test.abort("Unexpected write response: stop and verify DB; no retry");
  return correct ? data : null;
}
