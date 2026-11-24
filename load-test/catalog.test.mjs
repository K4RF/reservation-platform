import { deepEqual, equal, ok, throws } from "node:assert/strict";
import { test } from "node:test";
import { catalogRows, matrix, matches, selectedCase } from "./k6/catalog-cases.js";
import { argumentsFor, checkManifest, projectOf } from "./config.mjs";
import { plan } from "./k6/profiles.js";
import { catalogSqlDelta, classifyCatalogSelect, verifyCatalogSql } from "./catalog-diagnostics.mjs";
import { checkMeasurement } from "./verification.mjs";

const days = ["2026-12-29", "2026-12-30", "2026-12-31"];
const small = catalogRows(343, "small");
const expanded = catalogRows(343, "expanded");

test("catalog matrix has known selective, full-page, policy, inventory, empty and legacy outcomes", () => {
  deepEqual(catalogRows(343, "small"), small);
  ok(JSON.stringify(catalogRows(344, "small")) !== JSON.stringify(small));
  equal(small.length, 96);
  equal(expanded.length, 768);
  for (const rows of [small, expanded]) {
    const { search } = matrix(rows, days);
    const cases = Object.fromEntries(search.map((c) => [c.name.slice(7), c.expected]));
    ok(cases.exact_hot.total > 5 * cases.exact_rare.total);
    equal(cases.shallow.total, cases.deep.total);
    equal(cases.shallow.ids.length, cases.deep.ids.length);
    ok(cases.deep.index > 0 && cases.shallow.ids.at(-1) < cases.deep.ids[0]);
    ok(cases.stay.total > 0 && cases.stay.total < cases.amenities_price.total);
    ok(cases.not_available.total > cases.stay.total);
    equal(cases.empty.total, 0);
    ok(cases.legacy.total > 0);
    const e = cases.deep;
    const response = { content: e.ids.map((accommodationId) => ({ accommodationId, status: "ACTIVE" })),
      totalElements: e.total, totalPages: Math.ceil(e.total / e.size), first: false, last: false,
      page: e.index, size: e.size };
    const check = search.find((c) => c.name === "search.deep");
    ok(matches(check, response));
    equal(matches(check, { ...response, totalElements: e.total - 1 }), false);
    equal(matches(check, { ...response, content: response.content.toReversed() }), false);
  }
});

test("suggestions retain ranked tuples, normalize input, cap results and preserve selected exact fields", () => {
  const cases = matrix(expanded, days);
  const byName = Object.fromEntries(cases.suggest.map((c) => [c.name, c]));
  equal(byName["suggest.limit"].expected.length, 10);
  deepEqual(byName["suggest.literal"].expected, []);
  deepEqual(cases.control.expected, []);
  const homonyms = byName["suggest.homonyms"];
  ok(homonyms.expected.length >= 3);
  equal(new Set(homonyms.expected.map((row) => row.searchParams.country)).size, 2);
  for (const row of homonyms.expected) ok(selectedCase(cases, row).expected.total > 0);
  const normalized = byName["suggest.normalized"];
  deepEqual(new Set(normalized.expected.map((row) => row.displayName)), new Set(["Downtown"]));
  ok(matches(homonyms, homonyms.expected));
  equal(matches(homonyms, homonyms.expected.map((row) => ({ ...row,
    searchParams: { ...row.searchParams, destination: row.displayName } }))), false);
});

test("catalog workload is bounded and catalog size is part of the run identity", () => {
  const p = plan("catalog-search", "off", "distributed", "expanded");
  equal(p.stages.at(-1).at + p.stages.at(-1).seconds, 46);
  throws(() => plan("catalog-search", "warm", "distributed", "expanded"));
  throws(() => plan("catalog-search", "off", "distributed", "manual"));
  throws(() => plan("smoke", "off", "distributed", "small"));
  throws(() => argumentsFor(["prepare", "--confirm=isolated", "--target=http://localhost:8080"]));
  const id = "a".repeat(24);
  const manifest = { id, project: projectOf(id), engine: "test", schema: 1, source: "a".repeat(40),
    jarSha256: "a".repeat(64), seed: 343, state: "preparing", stay: days[0],
    profile: "catalog-search", cache: "off", room: "distributed", catalogSize: "expanded", workload: p };
  equal(checkManifest(manifest, id, "test"), manifest);
  throws(() => checkManifest({ ...manifest, catalogSize: "small" }, id, "test"));
  checkMeasurement({ count: 13, dropped: 0, transportErrors: 0, operations: {},
    offeredIterations: { low: 12 }, scenarioIterations: { low: 13 } }, p, 0);
});

test("diagnostic classification and counter deltas keep actual SELECT types separate", () => {
  equal(classifyCatalogSelect("SELECT COUNT ( a.id ) FROM `accommodations` a"), "count");
  equal(classifyCatalogSelect("select distinct a.time_zone from accommodations a"), "time_zone");
  equal(classifyCatalogSelect("SELECT DISTINCT a . `time_zone` FROM `accommodations` a"), "time_zone");
  equal(classifyCatalogSelect("SELECT DISTINCTROW `a1_0` . `time_zone` FROM `accommodations` `a1_0`"), "time_zone");
  equal(classifyCatalogSelect("WITH active_locations AS (SELECT id FROM accommodations) SELECT id FROM active_locations"), "suggestion");
  equal(classifyCatalogSelect("select a.id from accommodations a"), "content");
  equal(classifyCatalogSelect("select r.id from reservation_outbox_events r"), null);
  const before = { digests: [{ id: "1", kind: "count", calls: 4, timerPs: 15,
    rowsExamined: 30, rowsSent: 4, sortRows: 0 }], buffer: { innodb_buffer_pool_reads: 12 } };
  const after = { digests: [{ ...before.digests[0], calls: 8, timerPs: 45, rowsExamined: 140, rowsSent: 8 }],
    buffer: { innodb_buffer_pool_reads: 15 } };
  const delta = catalogSqlDelta(before, after);
  deepEqual(delta.totals.count, { calls: 4, timerPs: 30, rowsExamined: 110, rowsSent: 4, sortRows: 0 });
  equal(delta.buffer.innodb_buffer_pool_reads, 3);
  throws(() => catalogSqlDelta(after, before), /reset/);
  verifyCatalogSql({ operations: { "suggest.limit": { success: 2 } } },
    { totals: { suggestion: { calls: 2 } } });
  throws(() => verifyCatalogSql({ operations: { "suggest.limit": { success: 2 } } }, { totals: {} }));
});
