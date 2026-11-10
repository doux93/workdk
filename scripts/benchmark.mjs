import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  validateWorkspace,
  loadWorkspace,
  persistWorkspace,
} from "../src/workspace.ts";
import { searchWorkspace, filterEntries } from "../src/search.ts";
import { createLargeWorkspace } from "../tests/fixtures.mjs";

const budgets = {
  validate: 2000,
  backupRoundtrip: 2000,
  search: 1000,
  filter: 1000,
  persistMemory: 2000,
};
function measure(operation) {
  operation();
  const values = [];
  for (let index = 0; index < 5; index++) {
    const start = performance.now();
    operation();
    values.push(performance.now() - start);
  }
  values.sort((a, b) => a - b);
  return {
    medianMs: Number(values[2].toFixed(2)),
    p95Ms: Number(values[4].toFixed(2)),
  };
}
const results = [];
for (const count of [1000, 5000, 10000]) {
  const workspace = createLargeWorkspace(count);
  const raw = JSON.stringify(workspace);
  const query = `benchmark-value-${count - 1}。`;
  assert.equal(validateWorkspace(workspace), true);
  assert.equal(
    searchWorkspace(workspace.modules, query).entries[0].entry.id,
    `entry-${count - 1}`,
  );
  assert.equal(searchWorkspace(workspace.modules, "单词").entries.length, 30);
  const timings = {
    validate: measure(() => assert.equal(validateWorkspace(workspace), true)),
    backupRoundtrip: measure(() => {
      const restored = loadWorkspace(JSON.stringify(workspace));
      assert.equal(restored.recoveryRaw, null);
      assert.equal(restored.workspace.modules[0].entries.length, count);
    }),
    search: measure(() =>
      assert.equal(searchWorkspace(workspace.modules, query).entries.length, 1),
    ),
    filter: measure(() =>
      assert.equal(
        filterEntries(workspace.modules[0].entries, query).length,
        1,
      ),
    ),
    persistMemory: measure(() => {
      let value = null;
      const result = persistWorkspace(
        {
          getItem: () => value,
          setItem: (_, next) => {
            value = next;
          },
        },
        "workspace",
        workspace,
        null,
      );
      assert.equal(result.status, "saved");
    }),
  };
  for (const [stage, time] of Object.entries(timings))
    assert.ok(
      time.p95Ms < budgets[stage],
      `${count} records: ${stage} exceeded ${budgets[stage]} ms`,
    );
  results.push({
    records: count,
    jsonBytes: Buffer.byteLength(raw),
    jsonMiB: Number((Buffer.byteLength(raw) / 1024 / 1024).toFixed(2)),
    timings,
  });
}
const report = {
  generatedAt: new Date().toISOString(),
  runtime: process.version,
  platform: process.platform,
  samples: 5,
  budgetsMs: budgets,
  scope:
    "Synthetic data CPU and in-memory persistence. This is not a browser storage quota or frame-rate benchmark.",
  results,
};
console.table(
  results.map((row) => ({
    records: row.records,
    jsonMiB: row.jsonMiB,
    validateP95: row.timings.validate.p95Ms,
    backupP95: row.timings.backupRoundtrip.p95Ms,
    searchP95: row.timings.search.p95Ms,
    filterP95: row.timings.filter.p95Ms,
    persistMemoryP95: row.timings.persistMemory.p95Ms,
  })),
);
if (process.argv.includes("--write")) {
  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync(
    "reports/performance-latest.json",
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log("Performance budgets passed for 1,000 / 5,000 / 10,000 records.");
