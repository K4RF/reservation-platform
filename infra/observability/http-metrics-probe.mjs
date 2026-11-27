// Fixed queries executed only inside the verified load fixture; outputs numeric evidence, not raw labels.
const selector = '{job="reservation",instance="backend:9091"}';
const target = "http://prometheus:9090/api/v1/query?query=";

async function scalar(expression, fetchImpl) {
  const response = await fetchImpl(target + encodeURIComponent(expression), {
    redirect: "error", signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error("Prometheus query unavailable");
  const body = await response.json();
  const rows = body.data?.result;
  if (body.status !== "success" || body.data?.resultType !== "vector" || !Array.isArray(rows) || rows.length > 1)
    throw new Error("Unexpected Prometheus query result");
  if (!rows.length) return null;
  const value = Number(rows[0].value?.[1]);
  if (!Number.isFinite(value)) throw new Error("Prometheus sample not finite");
  return value;
}

export async function httpCheckpoint(notBefore, fetchImpl = fetch, now = Date.now) {
  // Apply timestamp to the stored sample before vector operators can assign evaluation time.
  const up = "up" + selector;
  const time = await scalar("timestamp(" + up + ") and (" + up + " == 1)", fetchImpl);
  if (time === null || time * 1000 < notBefore || time * 1000 > now() + 2000 || now() - time * 1000 > 35000)
    throw new Error("Waiting for a fresh successful scrape");
  return time;
}

export async function httpWindow({ before, after, histogram }, fetchImpl = fetch) {
  if (!Number.isFinite(before) || !Number.isFinite(after) || before <= 0 || before >= after ||
      typeof histogram !== "boolean")
    throw new Error("Invalid scrape bounds");
  const at = (metric, time, group = "", labels = selector) => "sum" + group + "(" + metric + labels + " @ " + time + ")";
  const delta = (metric, group, labels) => {
    const end = at(metric, after, group, labels), start = at(metric, before, group, labels);
    // A series first seen in this interval starts at zero only after verifying the same running process.
    return "(" + end + " - (" + start + " or " + end + " * 0))";
  };
  const countName = "http_server_requests_seconds_count";
  const sumName = "http_server_requests_seconds_sum";
  const buckets = "http_server_requests_seconds_bucket";
  const byLe = delta(buckets, " by (le)");
  const infinity = selector.slice(0, -1) + ',le="+Inf"}';
  const read = (q) => scalar(q, fetchImpl);
  const [started, ended, count, seconds, inf] = await Promise.all([
    read(at("process_start_time_seconds", before)), read(at("process_start_time_seconds", after)),
    read(delta(countName)), read(delta(sumName)), read(delta(buckets, "", infinity)),
  ]);
  if (started === null || started !== ended || !Number.isSafeInteger(count) || count < 0 ||
      seconds === null || seconds < 0 || (histogram ? inf !== count : inf !== null))
    throw new Error("Missing, reset or inconsistent HTTP counter/bucket window");
  const percentiles = !histogram || count === 0 ? null : await Promise.all([0.5, 0.95, 0.99].map((q) =>
    read("histogram_quantile(" + q + ", " + byLe + ")")));
  if (percentiles && (percentiles.some((value) => value === null || value < 0) ||
      percentiles[0] > percentiles[1] || percentiles[1] > percentiles[2]))
    throw new Error("Invalid HTTP quantiles");
  return { before, after, count, seconds, meanSeconds: count ? seconds / count : null,
    quantiles: percentiles && { p50: percentiles[0], p95: percentiles[1], p99: percentiles[2] },
    p99Sparse: count < 100 };
}
