import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { normalizeEvent, redact, safeConfig } from "../../agent/core.mjs";
import { schemaSql, handleAgentRequest } from "../../agent/service.mjs";
import { openQueue, flushQueue } from "../../agent/queue.mjs";
import { adaptHook } from "../../agent/adapter.mjs";
const event = (over = {}) => ({
  id: "e1",
  device: "device",
  source: "codex",
  session: "session1",
  project: "workdk",
  kind: "stop",
  at: new Date(Date.now() - 1000).toISOString(),
  summary: "已修改保存逻辑，仍需人工验收",
  evidence: "test exit 0",
  ...over,
});
function server() {
  const db = new DatabaseSync(":memory:");
  db.exec(schemaSql);
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
const req = (pathname, data, method = data ? "POST" : "GET") =>
  new Request("http://localhost" + pathname, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
async function send(s, pathname, data, method) {
  return handleAgentRequest(req(pathname, data, method), s.adapter, {
    authorized: true,
  });
}
function temporary() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "workdk-agent-test-"));
  return {
    dir,
    file: path.join(dir, "events.sqlite"),
    close() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
test("未授权请求不能写入或读取", async () => {
  const s = server();
  try {
    assert.equal(
      (
        await handleAgentRequest(
          req("/api/agent-events", { events: [event()] }),
          s.adapter,
        )
      ).status,
      401,
    );
    assert.equal(
      s.db.prepare("SELECT COUNT(*) AS n FROM agent_events").get().n,
      0,
    );
  } finally {
    s.db.close();
  }
});
test("整批先验证，坏事件不会造成部分保存", async () => {
  const s = server();
  try {
    assert.equal(
      (
        await send(s, "/api/agent-events", {
          events: [event(), event({ id: "bad", kind: "done" })],
        })
      ).status,
      400,
    );
    assert.equal(
      s.db.prepare("SELECT COUNT(*) AS n FROM agent_events").get().n,
      0,
    );
  } finally {
    s.db.close();
  }
});
test("相同事件重复十次只保存一次；结束不是完成", async () => {
  const s = server(),
    e = event();
  try {
    for (let i = 0; i < 10; i++)
      assert.deepEqual(
        (await (await send(s, "/api/agent-events", { events: [e] })).json())
          .acknowledged,
        ["e1"],
      );
    const r = await (await send(s, "/api/agent-sessions")).json();
    assert.equal(r.sessions.length, 1);
    assert.equal(r.sessions[0].count, 1);
    assert.equal(r.sessions[0].state, "stop");
  } finally {
    s.db.close();
  }
});
test("乱序补传不会让旧开始事件覆盖最新失败状态", async () => {
  const s = server();
  try {
    const now = Date.now();
    await send(s, "/api/agent-events", {
      events: [
        event({ kind: "error", at: new Date(now - 1000).toISOString() }),
        event({
          id: "old",
          kind: "start",
          at: new Date(now - 5000).toISOString(),
        }),
      ],
    });
    const r = await (await send(s, "/api/agent-sessions")).json();
    assert.equal(r.sessions[0].state, "error");
  } finally {
    s.db.close();
  }
});
test("按来源和本地日期筛选，跨日补传仍归入实际发生日期", async () => {
  const s = server();
  try {
    await send(s, "/api/agent-events", {
      events: [
        event({ at: "2026-01-01T15:30:00Z" }),
        event({ id: "e2", source: "claude", at: "2026-01-01T10:00:00Z" }),
      ],
    });
    const r = await (
      await send(
        s,
        "/api/agent-sessions?day=2026-01-02&offsetMinutes=540&source=codex",
      )
    ).json();
    assert.equal(r.sessions.length, 1);
    assert.equal(r.sessions[0].source, "codex");
  } finally {
    s.db.close();
  }
});
test("列表分页 50；详情分页 100，不丢事件", async () => {
  const s = server();
  try {
    for (let i = 0; i < 105; i++)
      await send(s, "/api/agent-events", {
        events: [event({ id: "e" + i, session: "s" + i })],
      });
    let r = await (await send(s, "/api/agent-sessions")).json();
    assert.equal(r.sessions.length, 50);
    assert.equal(r.hasMore, true);
    r = await (await send(s, "/api/agent-sessions?offset=100")).json();
    assert.equal(r.sessions.length, 5);
  } finally {
    s.db.close();
  }
});
test("摘要修正保留原始事件", async () => {
  const s = server();
  try {
    const e = event();
    await send(s, "/api/agent-events", { events: [e] });
    let r = await (await send(s, "/api/agent-sessions")).json();
    const id = r.sessions[0].id;
    assert.equal(
      (
        await send(
          s,
          "/api/agent-session",
          { id, title: "修正标题", summary: "修正摘要", project: "项目A" },
          "PATCH",
        )
      ).status,
      200,
    );
    r = await (
      await send(s, "/api/agent-session?id=" + encodeURIComponent(id))
    ).json();
    assert.equal(r.events[0].summary, e.summary);
    assert.equal(
      (await (await send(s, "/api/agent-sessions")).json()).sessions[0]
        .summary_override,
      "修正摘要",
    );
  } finally {
    s.db.close();
  }
});
test("凭据及 URL 参数在上传前隐藏；无正文上传字段", () => {
  const e = normalizeEvent(
    event({
      summary: "api_key=secretvalue https://example.com/doc?token=abc",
      fileContent: "secret",
    }),
  );
  assert.ok(!e.summary.includes("secretvalue"));
  assert.ok(!e.summary.includes("token=abc"));
  assert.ok(!("fileContent" in e));
  assert.ok(redact("sk-12345678901234567890").includes("隐藏"));
});
test("采集器拒绝远程明文 HTTP、URL 凭据和重定向地址参数", () => {
  for (const url of [
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com/?x=1",
  ])
    assert.throws(() => safeConfig({ url, token: "a", projects: [] }));
});
test("仅允许项目目录及其子目录，拒绝前缀近似目录", () => {
  const config = {
    device: "d",
    projects: [{ path: "/projects/app", name: "app" }],
  };
  assert.equal(
    adaptHook(
      "codex",
      { cwd: "/projects/app-other", session_id: "s", hook_event_name: "Stop" },
      config,
    ),
    null,
  );
  const e = adaptHook(
    "claude",
    {
      cwd: "/projects/app/src",
      session_id: "s",
      hook_event_name: "Stop",
      last_assistant_message: "完成本轮",
    },
    config,
  );
  assert.equal(e.project, "app");
  assert.equal(e.kind, "stop");
});
test("工具采集只取元数据，重复同一工具事件稳定去重", () => {
  const c = { device: "d", projects: [{ path: "/project", name: "p" }] },
    i = {
      cwd: "/project",
      session_id: "s",
      hook_event_name: "PostToolUse",
      tool_use_id: "call1",
      tool_name: "Write",
      tool_input: { file_path: "/project/a.ts", content: "SECRET_CONTENT" },
      tool_response: { exit_code: 0 },
    };
  const a = adaptHook("claude", i, c),
    b = adaptHook("claude", i, c);
  assert.equal(a.id, b.id);
  assert.ok(!JSON.stringify(a).includes("SECRET_CONTENT"));
  assert.ok(a.evidence.includes("a.ts"));
});
test("断网一百次后记录仍在；重启队列后成功补传", async () => {
  const tmp = temporary();
  let q = openQueue(tmp.file);
  try {
    q.add(event());
    for (let i = 0; i < 100; i++)
      await assert.rejects(
        flushQueue(q, { url: "https://example.com", token: "x" }, async () => {
          throw new Error("offline");
        }),
      );
    q.close();
    q = openQueue(tmp.file);
    assert.equal(q.status().pending, 1);
    const s = server();
    try {
      await flushQueue(
        q,
        { url: "https://example.com", token: "x" },
        async (url, o) =>
          handleAgentRequest(new Request(url, o), s.adapter, {
            authorized: true,
          }),
      );
      assert.equal(q.status().pending, 0);
      assert.equal(q.status().sent, 1);
      assert.equal(
        s.db.prepare("SELECT COUNT(*) AS n FROM agent_events").get().n,
        1,
      );
    } finally {
      s.db.close();
    }
  } finally {
    q.close();
    tmp.close();
  }
});
test("服务器保存后响应丢失，重传仍只保存一次", async () => {
  const tmp = temporary(),
    q = openQueue(tmp.file),
    s = server();
  try {
    q.add(event());
    const config = { url: "https://example.com", token: "x" };
    await assert.rejects(
      flushQueue(q, config, async (url, o) => {
        await handleAgentRequest(new Request(url, o), s.adapter, {
          authorized: true,
        });
        throw new Error("connection lost");
      }),
    );
    assert.equal(q.status().pending, 1);
    await flushQueue(q, config, (url, o) =>
      handleAgentRequest(new Request(url, o), s.adapter, { authorized: true }),
    );
    assert.equal(
      s.db.prepare("SELECT COUNT(*) AS n FROM agent_events").get().n,
      1,
    );
    assert.equal(q.status().pending, 0);
  } finally {
    q.close();
    s.db.close();
    tmp.close();
  }
});
test("无效保存确认与鉴权失败都不会丢弃排队记录", async () => {
  const tmp = temporary(),
    q = openQueue(tmp.file);
  try {
    q.add(event());
    for (const r of [
      new Response("", { status: 401 }),
      new Response(JSON.stringify({ acknowledged: ["unknown"] })),
    ]) {
      await assert.rejects(
        flushQueue(
          q,
          { url: "https://example.com", token: "x" },
          async () => r,
        ),
      );
      assert.equal(q.status().pending, 1);
    }
  } finally {
    q.close();
    tmp.close();
  }
});
test("真实独立 Hook 进程写入后退出，不依赖上传服务存活", () => {
  const tmp = temporary();
  try {
    writeFileSync(
      path.join(tmp.dir, "config.json"),
      JSON.stringify({
        url: "https://example.com",
        token: "x",
        device: "test-device",
        projects: [{ name: "app", path: tmp.dir }],
      }),
    );
    const r = spawnSync(
      process.execPath,
      ["agent/collector.mjs", "hook", "codex"],
      {
        cwd: process.cwd(),
        input: JSON.stringify({
          hook_event_name: "Stop",
          cwd: tmp.dir,
          session_id: "s",
          turn_id: "t",
          last_assistant_message: "完成本轮",
        }),
        env: { ...process.env, WORKDK_AGENT_HOME: tmp.dir },
        encoding: "utf8",
      },
    );
    assert.equal(r.status, 0);
    assert.deepEqual(JSON.parse(r.stdout), {});
    const q = openQueue(tmp.file);
    try {
      assert.equal(q.status().pending, 1);
    } finally {
      q.close();
    }
  } finally {
    tmp.close();
  }
});

test("同一会话跨天时，前一天不显示后一天的总结", async () => {
  const s = server();
  try {
    await send(s, "/api/agent-events", {
      events: [
        event({
          id: "yesterday",
          at: "2026-01-01T01:00:00Z",
          summary: "第一天进度",
        }),
        event({
          id: "today",
          at: "2026-01-02T01:00:00Z",
          summary: "第二天进度",
        }),
      ],
    });
    const r = await (
      await send(s, "/api/agent-sessions?day=2026-01-01")
    ).json();
    assert.equal(r.sessions[0].summary, "第一天进度");
  } finally {
    s.db.close();
  }
});
test("详情超过 100 个事件可完整翻页", async () => {
  const s = server();
  try {
    for (let i = 0; i < 105; i++)
      await send(s, "/api/agent-events", {
        events: [event({ id: "detail-" + String(i).padStart(3, "0") })],
      });
    const rows = await (await send(s, "/api/agent-sessions")).json();
    const id = encodeURIComponent(rows.sessions[0].id);
    const first = await (await send(s, "/api/agent-session?id=" + id)).json();
    const second = await (
      await send(
        s,
        "/api/agent-session?id=" +
          id +
          "&before=" +
          encodeURIComponent(first.next),
      )
    ).json();
    assert.equal(first.events.length, 100);
    assert.equal(second.events.length, 5);
    assert.equal(
      new Set([...first.events, ...second.events].map((e) => e.id)).size,
      105,
    );
  } finally {
    s.db.close();
  }
});
