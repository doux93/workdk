import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
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
          "SELECT payload FROM queue WHERE sent=0 ORDER BY rowid LIMIT 20",
        )
        .all()
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
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    };
    if (config.serviceToken)
      headers["OAI-Sites-Authorization"] = `Bearer ${config.serviceToken}`;
    const response = await fetcher(config.url + "/api/agent-events", {
      method: "POST",
      headers,
      body: JSON.stringify({ events }),
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`同步失败（HTTP ${response.status}）`);
    const result = await response.json();
    const sentIds = new Set(events.map((e) => e.id));
    if (
      !Array.isArray(result.acknowledged) ||
      result.acknowledged.some((id) => !sentIds.has(id))
    )
      throw new Error("服务器未返回有效保存确认");
    queue.ack(result.acknowledged);
    queue.meta("lastSync", new Date().toISOString());
    queue.meta("error", "");
    return result.acknowledged.length;
  } catch (e) {
    queue.meta(
      "error",
      e.message.startsWith("同步失败")
        ? e.message
        : "连接失败，事件已保留，稍后重试。",
    );
    throw new Error(queue.meta("error"));
  }
}
