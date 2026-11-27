import test from "node:test";
import assert from "node:assert/strict";
import { argumentsFor } from "./config.mjs";
import { httpCheckpoint, httpWindow } from "../infra/observability/http-metrics-probe.mjs";

test("HTTP window comparison is opt-in, fixture-bounded, and provides no endpoint overrides", () => {
  const stay = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const command = ["prepare", "--confirm=isolated", "--seed=359", "--stay=" + stay, "--profile=mixed", "--cache=warm"];
  assert.throws(() => argumentsFor([...command, "--http-metrics=base"]), /requires monitored/);
  assert.equal(argumentsFor([...command, "--monitoring=on", "--http-metrics=histogram"]).httpMetrics, "histogram");
  assert.equal(argumentsFor([...command, "--monitoring=on", "--http-metrics=base"]).httpMetrics, "base");
  assert.throws(() => argumentsFor([...command, "--monitoring=on", "--http-metrics=url"]), /requires monitored/);
  assert.throws(() => argumentsFor([...command.map((a) => a.replace("=mixed", "=smoke")),
    "--monitoring=on", "--http-metrics=base"]), /requires monitored/);
});

function prometheus(query) {
  return async (url, { signal, redirect }) => {
    const u = new URL(url);
    assert.equal(u.origin + u.pathname, "http://prometheus:9090/api/v1/query");
    assert.ok(signal instanceof AbortSignal);
    assert.equal(redirect, "error");
    const expression = u.searchParams.get("query");
    assert.match(expression, /\{job="reservation",instance="backend:9091"(?:,le="\+Inf")?\}/);
    const value = query(expression);
    return { ok: true, json: async () => ({ status: "success", data: { resultType: "vector",
      result: value === null ? [] : [{ value: [1800000080, String(value)] }] } }) };
  };
}

test("each boundary must see a fresh scrape after the respective workload marker", async () => {
  const time = 1_800_000_015;
  const now = () => 1000 * (time + 1);
  assert.equal(await httpCheckpoint(1000 * time, prometheus((expression) => {
    assert.match(expression, /^timestamp\(up\{[^}]+\}\) and \(up\{[^}]+\} == 1\)$/);
    return time;
  }), now), time);
  await assert.rejects(httpCheckpoint(1000 * time + 1, prometheus(() => time), now), /fresh/);
  await assert.rejects(httpCheckpoint(1000 * time - 50_000, prometheus(() => time - 45), now), /fresh/);
  await assert.rejects(httpCheckpoint(1000 * time, prometheus(() => null), now), /fresh/);
});

test("same-process counter and bucket deltas distinguish sparse, empty, disabled, reset and missing windows", async () => {
  const window = { before: 1_800_000_015, after: 1_800_000_045, histogram: true };
  const fixture = ({ count = 24, seconds = 0.1, inf = count, reset = false } = {}) => prometheus((expr) => {
    assert.match(expr, / @ 18000000(15|45)/);
    if (expr.includes("process_start_time")) return !reset || expr.includes("1800000015") ? 1 : 2;
    if (expr.includes("histogram_quantile")) return Number(expr.match(/quantile\(([\d.]+)/)[1]) / 100;
    if (expr.includes("_bucket")) {
      assert.match(expr, /_bucket\{[^}]+,le="\+Inf"\}/);
      return inf;
    }
    if (expr.includes("_count")) return count;
    return seconds;
  });
  const evidence = await httpWindow(window, fixture());
  assert.equal(evidence.count, 24);
  assert.equal(evidence.quantiles.p99, 0.009899999999999999);
  assert.ok(evidence.p99Sparse);
  const idle = await httpWindow(window, fixture({ count: 0, seconds: 0 }));
  assert.equal(idle.meanSeconds, null);
  assert.equal(idle.quantiles, null);
  assert.equal((await httpWindow({ ...window, histogram: false }, fixture({ inf: null }))).quantiles, null);
  await assert.rejects(httpWindow(window, fixture({ reset: true })), /reset/);
  await assert.rejects(httpWindow(window, fixture({ inf: 23 })), /inconsistent/);
  await assert.rejects(httpWindow(window, fixture({ count: null })), /Missing/);
});
