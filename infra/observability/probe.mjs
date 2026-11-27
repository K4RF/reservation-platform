// Runs inside the owned fixture container with private credentials over stdin.
// No target arguments, raw responses, credential output or backend replay.
export async function monitoringProbe({ scrape, grafana }, fetchImpl = fetch, now = Date.now) {
  const basic = (user, password) => "Basic " + Buffer.from(user + ":" + password).toString("base64");
  const api = "http://backend:8080";
  const management = "http://backend:9091";
  const prom = "http://prometheus:9090";
  const dashboard = "http://grafana:3000";
  const datasource = "/api/datasources/uid/reservation-prometheus";
  const scrapeAuth = basic("reservation-scraper", scrape);
  const grafanaAuth = basic("reservation-observer", grafana);
  async function get(base, path, authorization, status = 200) {
    const res = await fetchImpl(base + path, {
      redirect: "error", signal: AbortSignal.timeout(4000),
      headers: authorization ? { Authorization: authorization } : {},
    });
    if (status === "denied" ? res.status < 400 || res.status >= 500 : res.status !== status)
      throw new Error("Monitoring HTTP contract failed");
    return res;
  }
  async function health(path) {
    const body = await (await get(management, "/actuator/health" + path, scrapeAuth)).json();
    // Boot's aggregate response may advertise public health group names, but never component details.
    const groups = body.groups;
    if (body.status !== "UP" ||
        Object.keys(body).some((key) => key !== "status" && (path || key !== "groups")) ||
        (groups !== undefined && (!Array.isArray(groups) || groups.length !== 2 ||
          !groups.includes("liveness") || !groups.includes("readiness"))))
      throw new Error("Unexpected health status or details");
    return body.status;
  }
  async function metric(expression) {
    const body = await (await get(prom, "/api/v1/query?query=" + encodeURIComponent(expression))).json();
    const hits = body?.data?.result;
    if (body?.status !== "success" || body.data.resultType !== "vector" || hits?.length !== 1 ||
        hits[0].metric?.job !== "reservation" || hits[0].metric?.instance !== "backend:9091" ||
        !Array.isArray(hits[0].value) || !Number.isFinite(Number(hits[0].value[1])))
      throw new Error("Prometheus sample unavailable");
    return Number(hits[0].value[1]);
  }
  const selector = '{job="reservation",instance="backend:9091"}';
  const [up, durationSeconds, samples, lastSuccess, live, ready, aggregate, source, sourceHealth] = await Promise.all([
    metric("up" + selector), metric("scrape_duration_seconds" + selector),
    metric("scrape_samples_scraped" + selector), metric("timestamp(up" + selector + " == 1)"),
    health("/liveness"), health("/readiness"), health(""),
    get(dashboard, datasource, grafanaAuth).then((r) => r.json()),
    get(dashboard, datasource + "/health", grafanaAuth).then((r) => r.json()),
    get(management, "/actuator/prometheus", undefined, 401),
    get(api, "/actuator/prometheus", scrapeAuth, "denied"),
    get(management, "/actuator/env", scrapeAuth, "denied"),
    get(dashboard, datasource, undefined, 401),
  ]);
  if (up !== 1 || durationSeconds < 0 || durationSeconds > 3 || samples < 1 || samples > 2000 ||
      lastSuccess > now() / 1000 + 2 || now() / 1000 - lastSuccess > 35 ||
      source.uid !== "reservation-prometheus" || source.type !== "prometheus" || source.url !== prom ||
      sourceHealth.status !== "OK")
    throw new Error("Monitoring evidence is missing, stale or unhealthy");
  return { up, durationSeconds, samples, lastSuccessfulScrape: new Date(lastSuccess * 1000).toISOString(),
    health: { live, ready, aggregate }, datasource: { uid: source.uid, healthy: true } };
}
