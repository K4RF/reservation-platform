// MySQL Performance Schema counts the actual locking Publisher SELECT, including empty polls.
// Do not persist the SQL text, bindings, or other statements.
const pollSql = `
SELECT JSON_OBJECT(
  'sampledAtMs', ROUND(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3))*1000),
  'polls', COALESCE(SUM(COUNT_STAR),0),
  'statementPs', COALESCE(SUM(SUM_TIMER_WAIT),0),
  'rowsSent', COALESCE(SUM(SUM_ROWS_SENT),0),
  'rowsExamined', COALESCE(SUM(SUM_ROWS_EXAMINED),0)
) FROM performance_schema.events_statements_summary_by_digest
WHERE SCHEMA_NAME='reservation_load'
  AND UPPER(DIGEST_TEXT) LIKE 'SELECT % FROM %RESERVATION_OUTBOX_EVENTS% FOR UPDATE%';
`;
export const pollSnapshot = (sql) => JSON.parse(sql(pollSql));

export function pollDelta(before, after) {
  const fields = ["sampledAtMs", "polls", "statementPs", "rowsSent", "rowsExamined"];
  if (fields.some((key) => !Number.isSafeInteger(before[key]) || !Number.isSafeInteger(after[key]) ||
      before[key] < 0 || after[key] < before[key]))
    throw new Error("Invalid Outbox poll counters");
  const wallMs = after.sampledAtMs - before.sampledAtMs;
  const polls = after.polls - before.polls;
  if (!wallMs || !polls) throw new Error("Missing timed Outbox poll/query evidence");
  return { wallMs, polls, pollsPerSecond: polls * 1000 / wallMs,
    statementMs: (after.statementPs - before.statementPs) / 1e9,
    rowsSent: after.rowsSent - before.rowsSent, rowsExamined: after.rowsExamined - before.rowsExamined };
}
