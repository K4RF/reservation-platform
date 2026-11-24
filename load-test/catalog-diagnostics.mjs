const parseLines = (value) => value ? value.split(/\r?\n/).map((line) => JSON.parse(line)) : [];
const fields = ["calls", "timerPs", "rowsExamined", "rowsSent", "sortRows"];

export function classifyCatalogSelect(statement) {
  const query = statement.replaceAll("`", "").trim();
  if (/^with\s+active_locations\s+as\s*\(/i.test(query)) return "suggestion";
  if (!/^select\s/i.test(query)) return null;
  if (/\bfrom\s+accommodations\b/i.test(query)) {
    if (/^select\s+count\s*\(/i.test(query)) return "count";
    if (/^select\s+distinct\s+(?:\w+\s*\.\s*)?time_zone\b/i.test(query)) return "time_zone";
    return "content";
  }
  if (/\bfrom\s+(catalog_media|accommodation_amenities)\b/i.test(query)) return "catalog_enrichment";
  return null;
}

export function catalogSqlSnapshot(sql) {
  const digests = parseLines(sql(`
SELECT JSON_OBJECT('id',DIGEST,'text',DIGEST_TEXT,'calls',COUNT_STAR,'timerPs',SUM_TIMER_WAIT,
  'rowsExamined',SUM_ROWS_EXAMINED,'rowsSent',SUM_ROWS_SENT,'sortRows',SUM_SORT_ROWS)
FROM performance_schema.events_statements_summary_by_digest
WHERE SCHEMA_NAME='reservation_load' AND DIGEST IS NOT NULL;
`)).flatMap(({ id, text, ...counters }) => {
    const kind = classifyCatalogSelect(text);
    return kind ? [{ id, kind, ...counters }] : [];
  });
  const buffer = JSON.parse(sql(`
SELECT JSON_OBJECTAGG(LOWER(VARIABLE_NAME), CAST(VARIABLE_VALUE AS UNSIGNED))
FROM performance_schema.global_status WHERE VARIABLE_NAME IN ('Innodb_buffer_pool_reads',
  'Innodb_buffer_pool_read_requests','Innodb_data_reads','Innodb_data_read','Innodb_data_writes');
`));
  return { digests, buffer };
}

export function catalogSqlDelta(before, after) {
  const previous = new Map(before.digests.map((d) => [d.id, d]));
  const digests = after.digests.map(({ id, kind, ...curr }) => {
    const data = Object.fromEntries(fields.map((field) => [field, curr[field] - (previous.get(id)?.[field] ?? 0)]));
    if (fields.some((field) => data[field] < 0)) throw new Error("Catalog digest reset during measurement");
    return { id, kind, ...data };
  }).filter(({ calls }) => calls > 0);
  const totals = {};
  for (const { kind, ...row } of digests) {
    const result = totals[kind] ??= Object.fromEntries(fields.map((field) => [field, 0]));
    for (const field of fields) result[field] += row[field];
  }
  const buffer = Object.fromEntries(Object.entries(after.buffer).map(([key, value]) =>
    [key, value - (before.buffer[key] ?? 0)]));
  return { totals, digests, buffer };
}

export function verifyCatalogSql(result, delta) {
  const successful = (prefix) => Object.entries(result.operations)
    .filter(([name]) => name.startsWith(prefix)).reduce((n, [, counts]) => n + (counts.success ?? 0), 0);
  const searches = successful("search.");
  const suggestions = successful("suggest.");
  const calls = (kind) => delta.totals[kind]?.calls ?? 0;
  if (searches !== calls("content") || searches !== calls("time_zone") || suggestions !== calls("suggestion") ||
      calls("count") > searches)
    throw new Error("Catalog SELECT delta does not reconcile with measured HTTP calls");
}

const representative = {
  search: ["search.exact_hot", "search.exact_rare", "search.free_tokens", "search.shallow",
    "search.deep", "search.name_desc", "search.amenities_price", "search.stay", "search.empty"],
  suggest: ["suggest.prefix", "suggest.partial", "suggest.tokens", "suggest.limit", "suggest.empty", "control.short"],
};

// No production tracing changes. The short general_log window and EXPLAIN read only
// owned fixture SELECTs, after the measurement and SQL-counter snapshot are finished.
export function explainCatalog({ sql, fixture }, scope) {
  const cases = [...(scope === "suggest" ? [] : representative.search),
    ...(scope === "search" ? [] : representative.suggest)];
  const output = {};
  for (const name of cases) {
    const since = sql("SET GLOBAL general_log=ON; SELECT DATE_FORMAT(NOW(6),'%Y-%m-%d %H:%i:%s.%f');");
    try {
      if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/.test(since))
        throw new Error("Invalid diagnostic boundary");
      fixture("catalog-check", name);
    } finally {
      sql("SET GLOBAL general_log=OFF;");
    }
    const trace = parseLines(sql(`
SELECT JSON_OBJECT('statement',CAST(argument AS CHAR CHARACTER SET utf8mb4))
FROM mysql.general_log
WHERE event_time >= '${since}' AND user_host LIKE 'reservation_load[%'
  AND command_type IN ('Query', 'Execute')
ORDER BY event_time;
`)).flatMap(({ statement }) => {
      const kind = classifyCatalogSelect(statement);
      if (!kind) return [];
      if (/[;\u0000]/u.test(statement)) throw new Error("Multi-statement diagnostic is not permitted");
      return [{ kind, statement }];
    });
    const primary = name.startsWith("search.") ? "content" : "suggestion";
    if (name === "control.short" ? trace.length !== 0 : trace.filter(({ kind }) => kind === primary).length !== 1)
      throw new Error("Unexpected SQL count for " + name + ": " + trace.map(({ kind }) => kind).join(","));
    output[name] = { selectCalls: trace.length, statements: trace.map((entry) => {
      if (!["content", "count", "suggestion"].includes(entry.kind)) return entry;
      return { ...entry, plan: sql("EXPLAIN ANALYZE " + entry.statement + ";") };
    }) };
  }
  return output;
}
