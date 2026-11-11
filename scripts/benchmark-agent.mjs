import { DatabaseSync } from "node:sqlite";
import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { schemaSql, handleAgentRequest } from "../agent/service.mjs";
const rows = [];
for (const count of [1000, 5000, 10000]) {
  const db = new DatabaseSync(":memory:");
  db.exec(schemaSql);
  const adapter = {
    async all(sql, args) {
      return db.prepare(sql).all(...args);
    },
    async batch(ss) {
      db.exec("BEGIN");
      for (const s of ss) db.prepare(s.sql).run(...s.args);
      db.exec("COMMIT");
    },
  };
  const insert = db.prepare(
    "INSERT INTO agent_events VALUES (?,?,?,?,?,?,?,?,?,?,?)",
  );
  const now = new Date().toISOString();
  db.exec("BEGIN");
  for (let i = 0; i < count; i++) {
    const key = "session-" + Math.floor(i / 10);
    insert.run(
      "e" + i,
      key,
      "device",
      "codex",
      "benchmark",
      key,
      i % 10 === 9 ? "stop" : "tool",
      now,
      "合成工作摘要",
      "工具退出 0",
      now,
    );
  }
  db.exec("COMMIT");
  const timings = [];
  for (let i = 0; i < 6; i++) {
    const start = performance.now();
    const response = await handleAgentRequest(
      new Request("http://localhost/api/agent-sessions"),
      adapter,
      { authorized: true },
    );
    const result = await response.json();
    assert.equal(result.sessions.length, 50);
    if (i) timings.push(performance.now() - start);
  }
  const maxMs = Math.max(...timings);
  assert.ok(maxMs < 2000);
  rows.push({
    events: count,
    sessions: count / 10,
    listP95Ms: Number(maxMs.toFixed(2)),
  });
  db.close();
}
console.log(
  JSON.stringify(
    {
      runtime: process.version,
      storage: "in-memory SQLite; not cloud network latency",
      samples: 5,
      results: rows,
    },
    null,
    2,
  ),
);
