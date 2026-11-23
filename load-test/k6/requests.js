import http from "k6/http";
import exec from "k6/execution";
import { Counter, Rate, Trend } from "k6/metrics";

const origin = "http://backend:8080/api/v1";
const operations = new Counter("load_operations");
const bad = new Rate("load_system_error");
const outcomeLatency = new Trend("load_outcome_duration", true);
const knownCodes = ["INVENTORY_005", "INVENTORY_011", "INVENTORY_012", "INVENTORY_013",
  "BOOKING_POLICY_005", "AUTH_001", "AUTH_002", "COMMON_001", "COMMON_002"];

export function request(method, path, endpoint, expected, { body, owner, exhausted, validate } = {}) {
  if (!path.startsWith("/") || path.startsWith("//")) exec.test.abort("Unexpected route");
  const response = http.request(method, origin + path, body ? JSON.stringify(body) : null, {
    timeout: "5s",
    redirects: 0,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(owner ? { Authorization: "Bearer " + owner.token } : {}),
    },
    tags: { name: endpoint },
  });
  let data;
  try { data = response.json(); } catch { /* malformed success is not a confirmed write */ }
  const write = method !== "GET";
  const correct = response.status === expected && data && (!validate || validate(data));
  const rejection = exhausted && response.status === 409 && data?.code === "INVENTORY_005";
  const unknown = write && (!response.status || response.status >= 500 ||
    (response.status >= 200 && response.status < 400 && !correct));
  const outcome = correct ? "success" : rejection ? "expected_rejection" :
    unknown ? "unconfirmed_write" : "system_error";
  const tags = { name: endpoint, outcome, domain: knownCodes.includes(data?.code) ? data.code : "none_or_other",
    status: String(response.status) };
  operations.add(1, tags);
  outcomeLatency.add(response.timings.duration, tags);
  bad.add(outcome === "system_error" || unknown, { name: endpoint });
  if (unknown) exec.test.abort("Unconfirmed write: stop and verify DB; no retry");
  return correct ? data : null;
}
