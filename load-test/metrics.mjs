import { readFileSync } from "node:fs";

const redisFields = new Set(["connected_clients", "blocked_clients", "used_memory",
  "maxmemory", "evicted_keys", "keyspace_hits", "keyspace_misses", "total_commands_processed"]);
const redisCommands = new Set(["get", "set", "del", "unlink", "eval", "evalsha", "pttl", "scan", "exists", "pexpire"]);

function redisInfo(raw) {
  const info = {}, commands = {};
  for (const line of raw.split(/\r?\n/)) {
    const [key, value] = line.split(":");
    if (redisFields.has(key) && /^\d+$/.test(value)) info[key] = Number(value);
    if (key?.startsWith("cmdstat_") && redisCommands.has(key.slice(8))) {
      commands[key.slice(8)] = Object.fromEntries(value.split(",")
        .map((part) => part.split("=")).filter(([k, v]) =>
          ["calls", "usec", "rejected_calls", "failed_calls"].includes(k) && /^\d+$/.test(v))
        .map(([k, v]) => [k, Number(v)]));
    }
  }
  return { info, commands };
}

export function kafkaLag(compose) {
  const raw = compose(["exec", "-T", "kafka", "/opt/kafka/bin/kafka-consumer-groups.sh",
    "--bootstrap-server", "kafka:29092", "--describe", "--group", "reservation-load-consumer"]);
  return raw.split(/\r?\n/).map((row) => row.trim().split(/\s+/))
    .filter(([group, topic, part]) => group === "reservation-load-consumer" && topic === "reservation.events.v1" && /^\d+$/.test(part))
    .map(([, , part, current, end, lag]) => ({
      partition: Number(part), current: /^\d+$/.test(current) ? Number(current) : null,
      end: /^\d+$/.test(end) ? Number(end) : null, lag: /^\d+$/.test(lag) ? Number(lag) : null,
    })).sort((a, b) => a.partition - b.partition);
}

const mysqlSample = `
SELECT JSON_OBJECT(
  'slowQueries', (SELECT COUNT(*) FROM mysql.slow_log),
  'slowQuerySeconds', (SELECT COALESCE(SUM(TIME_TO_SEC(query_time)), 0) FROM mysql.slow_log),
  'lockWaitsNow', (SELECT COUNT(*) FROM performance_schema.data_lock_waits),
  'status', (SELECT JSON_OBJECTAGG(LOWER(VARIABLE_NAME), CAST(VARIABLE_VALUE AS UNSIGNED))
    FROM performance_schema.global_status WHERE VARIABLE_NAME IN
      ('Threads_connected','Threads_running','Connections','Questions','Slow_queries','Innodb_row_lock_waits','Innodb_row_lock_time')),
  'digests', (SELECT JSON_ARRAYAGG(JSON_OBJECT('digest',DIGEST,'calls',COUNT_STAR,
    'timerPs',SUM_TIMER_WAIT,'rowsExamined',SUM_ROWS_EXAMINED,'lockPs',SUM_LOCK_TIME))
    FROM (SELECT DIGEST,COUNT_STAR,SUM_TIMER_WAIT,SUM_ROWS_EXAMINED,SUM_LOCK_TIME
      FROM performance_schema.events_statements_summary_by_digest
      WHERE SCHEMA_NAME='reservation_load' AND DIGEST IS NOT NULL ORDER BY SUM_TIMER_WAIT DESC LIMIT 10) rows_by_timer)
);`;

export function sample({ compose, docker, sql, services, phase }) {
  const start = Date.now();
  const out = { phase, at: new Date(start).toISOString(), unavailable: [] };
  function observe(key, fn) {
    try { out[key] = fn(); } catch { out.unavailable.push(key); }
  }
  observe("docker", () => {
    const ids = services();
    if (!ids.length) throw new Error("No owned running containers");
    return docker(["stats", "--no-stream", "--format", "{{json .}}", ...ids])
      .split(/\r?\n/).map((line) => {
        const { Name, CPUPerc, MemUsage, MemPerc, PIDs, BlockIO } = JSON.parse(line);
        return { service: Name.replace(/^reservation-load-[a-f0-9]{24}-/, ""), cpu: CPUPerc,
          memory: MemUsage, memoryPercent: MemPerc, processes: PIDs, blockIO: BlockIO };
      });
  });
  observe("jvm", () => {
    const pid = compose(["exec", "-T", "backend", "jcmd", "-l"]).split(/\r?\n/)
      .find((line) => /^\d+ \/app\.jar(?:\s|$)/.test(line.trim()))?.split(" ")[0];
    if (!pid) throw new Error("Backend JVM PID not found");
    return JSON.parse(compose(["exec", "-T", "backend", "java", "-cp", "/tmp", "Observe", pid]));
  });
  observe("mysql", () => JSON.parse(sql(mysqlSample)));
  observe("redis", () => redisInfo(compose(["exec", "-T", "redis", "redis-cli", "INFO", "all"])));
  observe("events", () => ({
    outbox: JSON.parse(sql(`SELECT JSON_OBJECT('pending',SUM(status='PENDING'),
      'published',SUM(status='PUBLISHED'),'oldestPendingSeconds',
      TIMESTAMPDIFF(SECOND,MIN(IF(status='PENDING',created_at,NULL)),UTC_TIMESTAMP()),
      'processed',(SELECT COUNT(*) FROM processed_reservation_events)) FROM reservation_outbox_events;`)),
    lag: kafkaLag(compose),
    brokerWarningOrErrorLines: compose(["logs", "--no-color", "--since", "30s", "kafka"])
      .split(/\r?\n/).filter((line) => /\b(?:WARN|ERROR)\b/.test(line)).length,
  }));
  return { ...out, collectorMs: Date.now() - start };
}

export function summarize(rawPath, workload) {
  const points = readFileSync(rawPath, "utf8").trim().split(/\r?\n/);
  const http = {}, operations = {}, codes = {}, durations = {}, outcomes = {}, scenarioIterations = {};
  const errors = {};
  let dropped = 0, transportErrors = 0, timeouts = 0, count = 0, earliest = Infinity, latest = 0;
  const add = (map, key, amount = 1) => { map[key] = (map[key] ?? 0) + amount; };
  for (const line of points) {
    const { type, metric, data } = JSON.parse(line);
    if (type !== "Point") continue;
    const { name, outcome, domain, status, scenario } = data.tags ?? {};
    const key = scenario + "/" + name;
    if (metric === "load_operations") {
      add(operations[name] ??= {}, outcome);
      add(codes[key] ??= {}, status + "/" + domain + "/" + outcome);
    }
    if (metric === "http_req_duration") {
      (durations[key] ??= []).push(data.value);
      const t = Date.parse(data.time);
      earliest = Math.min(earliest, t);
      latest = Math.max(latest, t);
    }
    if (metric === "load_outcome_duration")
      (outcomes[key + "/" + outcome] ??= []).push(data.value);
    if (metric === "http_reqs") {
      count += data.value;
      add(http[key] ??= {}, status, data.value);
      if (status === "0") {
        transportErrors += data.value;
        add(errors, data.tags.error_code ?? "unknown", data.value);
        // k6 request timeout error code; raw numeric code is retained separately.
        if (data.tags.error_code === "1050") timeouts += data.value;
      }
    }
    if (metric === "dropped_iterations") dropped += data.value;
    if (metric === "iterations") add(scenarioIterations, scenario, data.value);
  }
  const elapsedSeconds = latest > earliest ? (latest - earliest) / 1000 : null;
  const offeredIterations = workload.stages ? Object.fromEntries(workload.stages.map(({ name, rate, seconds, iterations }) =>
    [name, iterations ?? rate * seconds])) : { read: workload.reads ?? (workload.rate ?? 0) * (workload.seconds ?? 0),
    write: (workload.writers ?? 0) * (workload.writes ?? 0), ...(workload.smoke ? { smoke: workload.smoke } : {}) };
  function summarizeTimings(values) {
    values.sort((a, b) => a - b);
    const n = values.length;
    const p = (fraction) => values[Math.ceil(n * fraction) - 1];
    return { n, p50: p(0.50), p95: p(0.95), p99: p(0.99), p99Sparse: n < 100,
      rpsOverRun: elapsedSeconds ? n / elapsedSeconds : null };
  }
  for (const [key, values] of Object.entries(durations)) {
    const failures = Object.entries(http[key] ?? {}).reduce((n, [status, value]) => n + (Number(status) >= 400 || status === "0" ? value : 0), 0);
    durations[key] = { ...summarizeTimings(values), httpErrorRate: failures / values.length };
  }
  for (const [key, values] of Object.entries(outcomes)) outcomes[key] = summarizeTimings(values);
  const stages = Object.fromEntries((workload.stages ?? []).map(({ name, seconds }) => {
    const requests = Object.entries(durations).filter(([key]) => key.startsWith(name + "/"))
      .reduce((total, [, stats]) => total + stats.n, 0);
    return [name, { seconds, requests, rpsOverStageWindow: requests / seconds }];
  }));
  return { count, elapsedSeconds, rpsOverRun: elapsedSeconds ? count / elapsedSeconds : null,
    offeredIterations, scenarioIterations, dropped, transportErrors, timeouts, transportCodes: errors,
    durations, outcomes, http, operations, codes, ...(workload.stages ? { stages } : {}) };
}
