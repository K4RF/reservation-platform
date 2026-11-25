import { setTimeout as delay } from "node:timers/promises";
import { rows } from "./lifecycle-verification.mjs";

const source = "reservation.events.v1";
const dlt = source + ".dlt";
export const outageProducerMaxBlockMs = 5000;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const kafka = (run, tool, args, options) => run.compose(["exec", "-T", "kafka", "/opt/kafka/bin/" + tool + ".sh",
  "--bootstrap-server", "kafka:29092", ...args], { label: "Isolated " + tool, timeout: 20_000, ...options });

export function lifecycleEvents(run, watermark) {
  if (!Number.isSafeInteger(watermark) || watermark < 0) throw new Error("Invalid Outbox watermark");
  return rows(run.sql("SELECT JSON_OBJECT('id',o.id,'aggregateId',o.aggregate_id,'eventId',o.event_id," +
    "'eventType',SUBSTRING(o.event_type,13),'status',o.status,'attempts',o.publish_attempts,'hasError',o.last_error IS NOT NULL," +
    "'pendingAgeMs',IF(o.status='PENDING',TIMESTAMPDIFF(MICROSECOND,o.created_at,UTC_TIMESTAMP(6))/1000,NULL)," +
    "'publishedMs',TIMESTAMPDIFF(MICROSECOND,o.created_at,o.published_at)/1000," +
    "'processedMs',TIMESTAMPDIFF(MICROSECOND,o.created_at,p.processed_at)/1000," +
    "'consumerMinusPublishedMs',TIMESTAMPDIFF(MICROSECOND,o.published_at,p.processed_at)/1000," +
    "'processedAt',CAST(p.processed_at AS CHAR)) FROM reservation_outbox_events o " +
    "LEFT JOIN processed_reservation_events p ON p.event_id=o.event_id AND p.aggregate_id=o.aggregate_id " +
    "AND p.event_type=o.event_type WHERE o.id>" + watermark + " ORDER BY o.id;"));
}

export function brokerOffsets(run) {
  const read = (topic) => {
    const output = kafka(run, "kafka-get-offsets", ["--topic", topic]);
    const result = output.split(/\r?\n/).map((line) => line.split(":")).sort((a, b) => Number(a[1]) - Number(b[1]));
    if (result.length !== 3 || result.some(([name, partition, off], i) =>
      name !== topic || Number(partition) !== i || !/^\d+$/.test(off) || !Number.isSafeInteger(Number(off))))
      throw new Error("Unexpected isolated topic offsets");
    return result.map(([, , offset]) => Number(offset));
  };
  return { source: read(source), dlt: read(dlt) };
}

function readSource(run, start, end) {
  return start.flatMap((offset, partition) => {
    const count = end[partition] - offset;
    if (!Number.isSafeInteger(count) || count < 0 || count > 200)
      throw new Error("Measured Kafka offset window is invalid");
    if (!count) return [];
    const raw = kafka(run, "kafka-console-consumer", ["--topic", source, "--partition", String(partition),
      "--offset", String(offset), "--max-messages", String(count), "--timeout-ms", "8000",
      ...["partition", "offset", "headers", "key"].flatMap((name) => ["--formatter-property", "print." + name + "=true"])]);
    const lines = raw.split(/\r?\n/);
    if (lines.length !== count) throw new Error("Could not read the bounded Kafka offset window");
    return lines.map((line, i) => {
      const [part, off, headers, key, payload, ...extra] = line.split("\t");
      if (part !== "Partition:" + partition || off !== "Offset:" + (offset + i) || extra.length ||
          !/^[1-9]\d*$/.test(key) || !/^__TypeId__:junsik\.reservation\.event\.reservation\.Reservation(Created|Changed|Cancelled)Event$/.test(headers))
        throw new Error("Unexpected Broker record format");
      const metadata = JSON.parse(payload)?.metadata;
      return { partition, offset: offset + i, key, eventId: metadata?.eventId,
        aggregateId: metadata?.aggregateId, eventType: metadata?.eventType?.replace(/^RESERVATION_/, ""),
        headers, payload };
    });
  });
}

export function matchEventOrder(events, messages, allowDuplicates) {
  const duplicates = [];
  const byEvent = Map.groupBy(messages, (message) => message.eventId);
  const scoped = new Set(events.map((event) => event.eventId));
  if (messages.some((message) => !scoped.has(message.eventId))) throw new Error("Unexpected event in source window");
  const aggregates = Map.groupBy(events, (e) => e.aggregateId);
  for (const batch of aggregates.values()) {
    let previous;
    for (const event of batch) {
      const hits = byEvent.get(event.eventId) ?? [];
      if (!hits.length || (!allowDuplicates && hits.length > 1) ||
          hits.some((hit) => hit.key !== String(event.aggregateId) || hit.aggregateId !== event.aggregateId ||
            hit.eventType !== event.eventType || hit.partition !== hits[0].partition))
        throw new Error("Source key, type, partition or event ID differs from Outbox");
      if (previous && (previous.partition !== hits[0].partition || previous.offset >= hits[0].offset))
        throw new Error("Aggregate first delivery is out of order");
      previous = hits[0];
      if (hits.length > 1) duplicates.push({ eventId: event.eventId, count: hits.length });
    }
  }
  return duplicates;
}

export async function verifyBroker(run, { m, before, events, drain, canary }) {
  run.resources(true);
  if (events.some((e) => e.status !== "PUBLISHED" || !e.processedAt || !Number.isFinite(e.publishedMs) ||
      !Number.isFinite(e.processedMs) || e.publishedMs < 0 || e.processedMs < 0))
    throw new Error("Missing durable Publisher/Consumer evidence");
  const after = brokerOffsets(run);
  if (!same(before.dlt, after.dlt)) throw new Error("Unexpected Dead Letter Topic entries");
  const messages = readSource(run, before.source, after.source);
  const duplicates = matchEventOrder(events, messages, m.workload.lifecycle === "broker-down");
  const locations = messages.map(({ headers: _headers, payload: _payload, ...location }) => location);
  const result = { before, after, locations, duplicates, dltRecords: 0 };
  if (!canary) return result;
  const record = messages.find((entry) => entry.eventType === "CREATED");
  if (!record) throw new Error("Missing duplicate delivery probe record");
  // One intentional Kafka duplicate (not a reservation write replay); preserve bytes, key and type header.
  kafka(run, "kafka-console-producer", ["--topic", source, "--sync", "--reader-property", "parse.headers=true",
    "--reader-property", "parse.key=true", "--producer-property", "acks=all"],
  { input: [record.headers, record.key, record.payload].join("\t") + "\n" });
  const finalOffsets = brokerOffsets(run);
  const repeated = readSource(run, after.source, finalOffsets.source);
  if (repeated.length !== 1 || !same(after.dlt, finalOffsets.dlt) ||
      !["partition", "key", "eventId", "headers", "payload"].every((k) => record[k] === repeated[0][k]))
    throw new Error("Duplicate probe did not produce exactly the same record");
  const settled = await drain(run);
  if (!same(events, lifecycleEvents(run, m.lifecycleWatermark)) ||
      !same(finalOffsets.dlt, brokerOffsets(run).dlt))
    throw new Error("Repeated event changed durable evidence or went to DLT");
  result.duplicateProbe = { eventId: record.eventId, partition: record.partition, originalOffset: record.offset,
    repeatedOffset: repeated[0].offset, sameLedger: true, lag: settled.lag };
  return result;
}

export async function kafkaOutage(run, m, measure, report) {
  const owned = m.resources.kafka;
  if (run.resources(true).services.kafka?.Id !== owned) throw new Error("Unsafe broker outage scope");
  const evidence = { stopped: false, restored: false, pending: [], producerMaxBlockMs: outageProducerMaxBlockMs };
  const requireOwned = () => {
    const broker = run.resources().services.kafka;
    if (broker?.Id !== owned) throw new Error("Owned Kafka instance was replaced");
    return broker;
  };
  try {
    run.docker(["stop", "--time", "5", owned], { label: "Stop owned broker only" });
    if (requireOwned().State.Running) throw new Error("Owned broker did not stop");
    evidence.stopped = true;
    evidence.startedAt = new Date().toISOString();
    const code = await measure();
    const deadline = Date.now() + 28_000;
    do {
      evidence.pending = lifecycleEvents(run, m.lifecycleWatermark);
      if (evidence.pending.length === 3 && evidence.pending.every((e) => e.status === "PENDING" && !e.processedAt) &&
          evidence.pending.some((e) => e.attempts > 0 && e.hasError)) return code;
      await delay(750);
    } while (Date.now() < deadline);
    throw new Error("No bounded observation of committed PENDING with a recorded publish failure");
  } finally {
    try {
      if (!requireOwned().State.Running) {
        evidence.restartRequestedAt = new Date().toISOString();
        run.docker(["start", owned], { label: "Restart the same owned broker" });
      }
      const deadline = Date.now() + 40_000;
      do {
        if (requireOwned().State.Health?.Status === "healthy") {
          evidence.restored = true;
          evidence.healthyAt = new Date().toISOString();
          break;
        }
        await delay(1000);
      } while (Date.now() < deadline);
      if (!evidence.restored) throw new Error("Owned broker restart did not recover");
    } finally {
      report("lifecycle-outage.json", evidence);
    }
  }
}

export function lifecycleTimings(log, events) {
  const stats = (samples) => {
    const s = samples.sort((a, b) => a - b);
    if (!s.length) return { count: 0 };
    const p = (fraction) => Number(s[Math.ceil(s.length * fraction) - 1].toFixed(3));
    return { count: s.length, min: Number(s[0].toFixed(3)), p50: p(0.50), p95: p(0.95), max: p(1) };
  };
  const sends = [...log.matchAll(/LOAD_OUTBOX_SEND ack=(true|false) elapsedNs=(\d+)/g)];
  const batches = [...log.matchAll(/LOAD_OUTBOX_BATCH rows=(\d+) published=(\d+) committed=(true|false) elapsedNs=(\d+)/g)];
  const collect = (name) => stats(events.map((row) => row[name]).filter(Number.isFinite));
  return {
    brokerAckWaitMs: stats(sends.filter(([, ack]) => ack === "true").map(([, , ns]) => Number(ns) / 1e6)),
    brokerFailedWaitMs: stats(sends.filter(([, ack]) => ack === "false").map(([, , ns]) => Number(ns) / 1e6)),
    committedNonemptyBatchMs: stats(batches.filter(([, , , ok]) => ok === "true").map(([, , , , ns]) => Number(ns) / 1e6)),
    rolledBackBatchCount: batches.filter(([, , , ok]) => ok === "false").length,
    publishedRowsInCommittedBatches: batches.filter(([, , , ok]) => ok === "true").reduce((n, [, , rows]) => n + Number(rows), 0),
    outboxToPublishedTimestampMs: collect("publishedMs"), outboxToProcessedTimestampMs: collect("processedMs"),
    consumerTimestampMinusPublishedTimestampMs: collect("consumerMinusPublishedMs"),
    attempts: events.map(({ id, attempts }) => ({ id, attempts })),
  };
}
