import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";
import { once } from "node:events";
import { DatabaseSync } from "node:sqlite";
import { MAX_BATCH_BYTES, normalizeEvent, redact } from "../../agent/core.mjs";
import { openQueue, flushQueue } from "../../agent/queue.mjs";
import { schemaSql, handleAgentRequest } from "../../agent/service.mjs";
import { createAgentServer } from "../../agent/server.mjs";

const event = (id, summary = "中文摘要") =>
  normalizeEvent({
    id,
    device: "test",
    session: id,
    source: "manual",
    project: "测试项目",
    kind: "stop",
    at: new Date().toISOString(),
    summary,
    evidence: "",
  });
const config = { url: "http://localhost", token: "synthetic-test-only" };
function queue(t) {
  const root = mkdtempSync(path.join(tmpdir(), "workdk-reliability-"));
  const q = openQueue(path.join(root, "queue.sqlite"));
  t.after(() => {
    q.close();
    rmSync(root, { recursive: true, force: true });
  });
  return q;
}
function receiver(t) {
  const db = new DatabaseSync(":memory:");
  db.exec(schemaSql);
  t.after(() => db.close());
  return {
    db,
    adapter: {
      async all(sql, args) {
        return db.prepare(sql).all(...args);
      },
      async batch(statements) {
        db.exec("BEGIN");
        try {
          for (const s of statements) db.prepare(s.sql).run(...s.args);
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
    },
  };
}
const ack = (events) =>
  Response.json({ acknowledged: events.map((e) => e.id) });

test("长中文摘要按字节拆批，后续短记录也能上传，接收内容完整", async (t) => {
  const q = queue(t),
    r = receiver(t),
    sizes = [];
  for (let i = 0; i < 20; i++) q.add(event(`long-${i}`, "中".repeat(12000)));
  q.add(event("short"));
  const fetcher = async (url, options) => {
    sizes.push(Buffer.byteLength(options.body));
    return handleAgentRequest(new Request(url, options), r.adapter, {
      authorized: true,
    });
  };
  assert.equal(await flushQueue(q, config, fetcher), 20);
  assert.equal(await flushQueue(q, config, fetcher), 1);
  assert.ok(sizes.every((n) => n <= MAX_BATCH_BYTES));
  assert.equal(q.status().pending, 0);
  assert.equal(r.db.prepare("SELECT COUNT(*) n FROM agent_events").get().n, 21);
  assert.equal(
    r.db.prepare("SELECT summary FROM agent_events WHERE id='long-0'").get()
      .summary,
    "中".repeat(12000),
  );
});

test("网关 413 自动拆批；后半批失败时只确认已保存的事件", async (t) => {
  const q = queue(t);
  for (let i = 0; i < 4; i++) q.add(event(`e-${i}`));
  let fail = true;
  const fetcher = async (_, options) => {
    const { events } = JSON.parse(options.body);
    if (events.length > 2) return new Response(null, { status: 413 });
    if (fail && events.some((e) => e.id === "e-2"))
      return new Response(null, { status: 503 });
    return ack(events);
  };
  await assert.rejects(flushQueue(q, config, fetcher), /503/);
  assert.deepEqual(
    q.pending().map((e) => e.id),
    ["e-2", "e-3"],
  );
  fail = false;
  assert.equal(await flushQueue(q, config, fetcher), 2);
  assert.equal(q.status().pending, 0);
});

test("单条 413 不无限递归，空确认及重复确认不会丢失事件", async (t) => {
  const q = queue(t);
  q.add(event("single"));
  let calls = 0;
  await assert.rejects(
    flushQueue(q, config, async () => {
      calls++;
      return new Response(null, { status: 413 });
    }),
    /413/,
  );
  assert.equal(calls, 1);
  for (const acknowledged of [[], ["single", "single"]])
    await assert.rejects(
      flushQueue(q, config, async () => Response.json({ acknowledged })),
    );
  assert.equal(q.status().pending, 1);
});

test("脱敏覆盖完整引号值、转义引号、URL 用户信息与参数，并保留普通文本", () => {
  const inputs = [
    'password="test secret phrase"',
    "'api_key': 'private key with spaces'",
    String.raw`{"password":"escaped\"secret phrase"}`,
    "Authorization: Bearer synthetic-secret",
    "https://demo:dummy-pass@example.invalid/path?token=private#fragment",
    "https://demo:dummy-pass@example.invalid/path",
    "https://example.invalid/#private-fragment",
  ];
  for (const input of inputs) {
    const cleaned = redact(input);
    assert.doesNotMatch(
      cleaned,
      /test secret|secret phrase|private key|escaped|synthetic-secret|demo|dummy-pass|private-fragment/,
    );
    assert.equal(redact(cleaned), cleaned, "redaction must be idempotent");
  }
  assert.equal(redact('password="test secret phrase"'), 'password="[已隐藏]"');
  assert.equal(
    redact("修复保存逻辑，仍需人工验收"),
    "修复保存逻辑，仍需人工验收",
  );
});

test("升级前积压的事件在发送前重新脱敏，保持原事件 ID", async (t) => {
  const q = queue(t);
  q.add({ ...event("old"), summary: 'password="old secret phrase"' });
  await flushQueue(q, config, async (_, options) => {
    const { events } = JSON.parse(options.body);
    assert.equal(events[0].id, "old");
    assert.equal(events[0].summary, 'password="[已隐藏]"');
    return ack(events);
  });
  assert.equal(q.status().sent, 1);
});

test("真实 HTTP 分块切开中文和 emoji 字节后仍完整保存，字节超限被拒绝", async (t) => {
  const { db } = receiver(t);
  const token = "synthetic-local-token";
  const server = createAgentServer({ db, token });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function post(bytes, cuts = []) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        origin + "/api/agent-events",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
        },
        (res) => {
          res.resume();
          res.on("end", () => resolve(res.statusCode));
        },
      );
      req.on("error", reject);
      (async () => {
        let start = 0;
        for (const end of cuts) {
          req.write(bytes.subarray(start, end));
          start = end;
          await new Promise((r) => setTimeout(r, 10));
        }
        req.end(bytes.subarray(start));
      })().catch(reject);
    });
  }
  const summary = "中文摘要 🚲";
  const bytes = Buffer.from(
    JSON.stringify({ events: [event("unicode", summary)] }),
  );
  const chinese = bytes.indexOf(Buffer.from(summary)),
    emoji = bytes.indexOf(Buffer.from("🚲"));
  assert.equal(
    await post(bytes, [chinese + 1, chinese + 2, emoji + 1, emoji + 3]),
    200,
  );
  assert.equal(
    db.prepare("SELECT summary FROM agent_events WHERE id='unicode'").get()
      .summary,
    summary,
  );
  const large = Buffer.from(
    JSON.stringify({ events: [event("large", "中".repeat(12000))] }),
  );
  // A body below the character limit but over the byte limit must still fail.
  const oversized = Buffer.from(
    "中".repeat(Math.ceil(MAX_BATCH_BYTES / 3) + 1),
  );
  assert.equal(await post(oversized), 413);
  assert.equal(await post(large), 200);
});
