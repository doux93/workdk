import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { MAX_BATCH_BYTES, MAX_BATCH_EVENTS, normalizeEvent } from "./core.mjs";
export function openQueue(file) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(
    "PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS queue(id TEXT PRIMARY KEY, payload TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);",
  );
  return {
    db,
    add(event) {
      db.prepare("INSERT OR IGNORE INTO queue(id,payload) VALUES (?,?)").run(
        event.id,
        JSON.stringify(event),
      );
    },
    pending() {
      return db
        .prepare(
          "SELECT payload FROM queue WHERE sent=0 ORDER BY rowid LIMIT ?",
        )
        .all(MAX_BATCH_EVENTS)
        .map((r) => JSON.parse(r.payload));
    },
    ack(ids) {
      const stmt = db.prepare("UPDATE queue SET sent=1 WHERE id=?");
      db.exec("BEGIN");
      try {
        for (const id of ids) stmt.run(id);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    meta(k, v) {
      if (v !== undefined)
        db.prepare(
          "INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        ).run(k, String(v));
      return db.prepare("SELECT value FROM meta WHERE key=?").get(k)?.value;
    },
    status() {
      return {
        pending: db
          .prepare("SELECT COUNT(*) AS n FROM queue WHERE sent=0")
          .get().n,
        sent: db.prepare("SELECT COUNT(*) AS n FROM queue WHERE sent=1").get()
          .n,
        lastSync: this.meta("lastSync") || null,
        error: this.meta("error") || null,
      };
    },
    close() {
      db.close();
    },
  };
}
export async function flushQueue(queue, config, fetcher = fetch) {
  const events = queue.pending();
  if (!events.length) return 0;
  try {
    // Reapply current redaction to events retained by an older collector.
    const pending = events.map(normalizeEvent);
    const batches = [];
    let batch = [];
    for (const event of pending) {
      const candidate = [...batch, event];
      if (
        Buffer.byteLength(JSON.stringify({ events: candidate })) >
        MAX_BATCH_BYTES
      ) {
        if (!batch.length)
          throw new Error("同步失败：单条事件超过上传限制，请检查本地队列。");
        batches.push(batch);
        batch = [];
      }
      batch.push(event);
    }
    if (batch.length) batches.push(batch);
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    };
    if (config.serviceToken)
      headers["OAI-Sites-Authorization"] = `Bearer ${config.serviceToken}`;
    async function send(events) {
      const response = await fetcher(config.url + "/api/agent-events", {
        method: "POST",
        headers,
        body: JSON.stringify({ events }),
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
      // Gateways may have a smaller body limit. Split without acknowledging
      // unconfirmed events; successful halves remain committed if a later half fails.
      if (response.status === 413 && events.length > 1) {
        const middle = Math.ceil(events.length / 2);
        return (
          (await send(events.slice(0, middle))) +
          (await send(events.slice(middle)))
        );
      }
      if (!response.ok) throw new Error(`同步失败（HTTP ${response.status}）`);
      const result = await response.json();
      const sentIds = new Set(events.map((e) => e.id));
      if (
        !Array.isArray(result.acknowledged) ||
        !result.acknowledged.length ||
        new Set(result.acknowledged).size !== result.acknowledged.length ||
        result.acknowledged.some((id) => !sentIds.has(id))
      )
        throw new Error("服务器未返回有效保存确认");
      queue.ack(result.acknowledged);
      queue.meta("lastSync", new Date().toISOString());
      queue.meta("error", "");
      return result.acknowledged.length;
    }
    let count = 0;
    for (const batch of batches) count += await send(batch);
    return count;
  } catch (e) {
    queue.meta(
      "error",
      e instanceof Error && e.message.startsWith("同步失败")
        ? e.message
        : "连接失败，事件已保留，稍后重试。",
    );
    throw new Error(queue.meta("error"));
  }
}
