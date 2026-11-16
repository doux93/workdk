import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { once } from "node:events";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createAgentServer } from "../../agent/server.mjs";
import { schemaSql, handleAgentRequest } from "../../agent/service.mjs";
import { authorizeAgent, hashToken } from "../../agent/credentials.mjs";
import { redact } from "../../agent/core.mjs";
import { openQueue, flushQueue } from "../../agent/queue.mjs";

async function fixture(t) {
  const db = new DatabaseSync(":memory:");
  db.exec(schemaSql);
  const server = createAgentServer({ db, token: "test-owner-secret" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    server.close();
    db.close();
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  const request = (
    path,
    body,
    token = "test-owner-secret",
    method = body ? "POST" : "GET",
    extra = {},
  ) =>
    fetch(url + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...extra,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const issue = async (body = { label: "测试电脑" }) => {
    const response = await request("/api/agent-setup", body);
    assert.equal(response.status, 200);
    return response.json();
  };
  const event = (device, id = crypto.randomUUID()) => ({
    id,
    device,
    session: "test",
    source: "codex",
    project: "test",
    kind: "stop",
    at: new Date().toISOString(),
    summary: "synthetic",
    evidence: "",
  });
  return { db, url, request, issue, event };
}

test("配置通过 POST 单独签发，数据库和设备列表不暴露原始凭据，GET 不创建设备", async (t) => {
  const f = await fixture(t);
  const fallback = await f.request("/api/agent-setup");
  assert.match(await fallback.text(), /method="post"/);
  assert.equal(f.db.prepare("SELECT count(*) n FROM agent_devices").get().n, 0);
  const a = await f.issue(),
    b = await f.issue();
  assert.notEqual(a.token, b.token);
  assert.notEqual(a.device, b.device);
  assert.equal(a.version, 2);
  assert.equal(a.url, f.url);
  assert.deepEqual(a.projects, []);
  const raw = JSON.stringify(f.db.prepare("SELECT * FROM agent_devices").all());
  assert.ok(!raw.includes(a.token));
  assert.ok(raw.includes(await hashToken(a.token)));
  const list = await (await f.request("/api/agent-devices")).text();
  assert.ok(!list.includes(a.token));
  assert.ok(!list.includes("token_hash"));
  assert.ok(!redact(a.token).includes(a.token));
});

test("设备只能上传自己的事件，不能读取、修正、签发或停用任何设备", async (t) => {
  const f = await fixture(t),
    a = await f.issue(),
    b = await f.issue();
  assert.equal(
    (
      await f.request(
        "/api/agent-events",
        { events: [f.event(a.device)] },
        a.token,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await f.request(
        "/api/agent-events",
        { events: [f.event(a.device), f.event(b.device)] },
        a.token,
      )
    ).status,
    403,
  );
  assert.equal(f.db.prepare("SELECT count(*) n FROM agent_events").get().n, 1);
  for (const [path, body, method] of [
    ["/api/agent-sessions", null, "GET"],
    ["/api/agent-session?id=x", null, "GET"],
    ["/api/agent-session", { id: "x" }, "PATCH"],
    ["/api/agent-setup", { label: "bad" }, "POST"],
    ["/api/agent-devices", null, "GET"],
    ["/api/agent-devices", { device: b.device }, "PATCH"],
  ])
    assert.equal(
      (await f.request(path, body, a.token, method)).status,
      403,
      path,
    );
  assert.equal(
    (
      await f.request(
        "/api/agent-events",
        { events: [f.event(a.device)] },
        "wkdev_" + "0".repeat(64),
      )
    ).status,
    401,
  );
});

test("停用只阻止对应设备，历史记录和待上传队列保留；重新签发后按原编号补传", async (t) => {
  const f = await fixture(t),
    a = await f.issue(),
    b = await f.issue();
  const root = mkdtempSync(join(tmpdir(), "workdk-device-"));
  const queue = openQueue(join(root, "queue.sqlite"));
  t.after(() => {
    queue.close();
    rmSync(root, { recursive: true, force: true });
  });
  queue.add(f.event(a.device, "first"));
  assert.equal(await flushQueue(queue, a), 1);
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await f.request(
          "/api/agent-devices",
          { device: a.device },
          undefined,
          "PATCH",
        )
      ).status,
      200,
    );
  queue.add(f.event(a.device, "second"));
  await assert.rejects(flushQueue(queue, a), /401/);
  assert.equal(queue.status().pending, 1);
  assert.equal(
    (
      await f.request(
        "/api/agent-events",
        { events: [f.event(b.device, "other")] },
        b.token,
      )
    ).status,
    200,
  );
  const renewed = await f.issue({ device: a.device, label: "重新连接" });
  assert.equal(renewed.device, a.device);
  assert.notEqual(renewed.token, a.token);
  assert.equal(await flushQueue(queue, renewed), 1);
  assert.equal(queue.status().pending, 0);
  assert.equal(f.db.prepare("SELECT count(*) n FROM agent_events").get().n, 3);
  assert.equal(
    (
      await f.request(
        "/api/agent-events",
        { events: [f.event(a.device)] },
        a.token,
      )
    ).status,
    401,
  );
});

test("鉴权后发生停用也不会写入或返回保存确认", async (t) => {
  const f = await fixture(t),
    a = await f.issue();
  const adapter = {
    all: async (sql, args) => f.db.prepare(sql).all(...args),
    batch: async (items) => {
      for (const item of items) f.db.prepare(item.sql).run(...item.args);
    },
  };
  const request = new Request(f.url + "/api/agent-events", {
    method: "POST",
    headers: { Authorization: `Bearer ${a.token}` },
    body: JSON.stringify({ events: [f.event(a.device)] }),
  });
  const access = await authorizeAgent(request, adapter);
  await f.request(
    "/api/agent-devices",
    { device: a.device },
    undefined,
    "PATCH",
  );
  assert.equal(
    (await handleAgentRequest(request, adapter, access)).status,
    401,
  );
  assert.equal(f.db.prepare("SELECT count(*) n FROM agent_events").get().n, 0);
});

test("拒绝跨站签发；本机 Vite 来源可用；旧共享凭据必须显式启用且仅能上传", async (t) => {
  const f = await fixture(t);
  assert.equal(
    (
      await f.request("/api/agent-setup", { label: "bad" }, undefined, "POST", {
        Origin: "https://other.example",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await f.request(
        "/api/agent-setup",
        { label: "local" },
        undefined,
        "POST",
        { Origin: "http://127.0.0.1:5173" },
      )
    ).status,
    200,
  );
  const request = new Request(f.url + "/api/agent-sessions", {
    headers: { Authorization: "Bearer legacy-token" },
  });
  const db = { all: async () => [] };
  assert.equal((await authorizeAgent(request, db)).authorized, false);
  const access = await authorizeAgent(request, db, {
    legacyToken: "legacy-token",
  });
  assert.equal(access.role, "uploader");
  assert.equal((await handleAgentRequest(request, db, access)).status, 403);
});

test("升级现有设备保留编号；采集器重新导入同设备配置保留项目，拒绝覆盖为另一设备", async (t) => {
  const f = await fixture(t);
  await f.request("/api/agent-events", {
    events: [f.event("existing-device")],
  });
  const a = await f.issue({ device: "existing-device", label: "原电脑" });
  const root = mkdtempSync(join(tmpdir(), "workdk-init-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, "incoming.json"),
    config = join(root, "config.json");
  writeFileSync(file, JSON.stringify(a));
  const init = () =>
    spawnSync(process.execPath, ["agent/collector.mjs", "init", file], {
      encoding: "utf8",
      env: { ...process.env, WORKDK_AGENT_HOME: root },
    });
  assert.equal(init().status, 0);
  const current = JSON.parse(readFileSync(config));
  current.projects = [{ name: "project", path: root }];
  writeFileSync(config, JSON.stringify(current));
  assert.equal(init().status, 0);
  assert.deepEqual(JSON.parse(readFileSync(config)).projects, current.projects);
  writeFileSync(file, JSON.stringify(await f.issue()));
  assert.notEqual(init().status, 0);
  assert.equal(JSON.parse(readFileSync(config)).device, a.device);
});

test("D1 迁移与本机设备表一致；非法设备和名称不产生授权记录", async (t) => {
  const f = await fixture(t);
  for (const body of [
    { label: "" },
    { label: "x".repeat(81) },
    { label: "x", device: "missing" },
  ])
    assert.ok((await f.request("/api/agent-setup", body)).status >= 400);
  assert.equal(f.db.prepare("SELECT count(*) n FROM agent_devices").get().n, 0);
  const migrated = new DatabaseSync(":memory:");
  t.after(() => migrated.close());
  migrated.exec(
    readFileSync("hosting/drizzle/0000_omniscient_iron_man.sql", "utf8"),
  );
  migrated.exec(
    readFileSync("hosting/drizzle/0001_device_credentials.sql", "utf8"),
  );
  assert.deepEqual(
    migrated.prepare("PRAGMA table_info(agent_devices)").all(),
    f.db.prepare("PRAGMA table_info(agent_devices)").all(),
  );
  assert.equal(
    migrated
      .prepare("PRAGMA index_list(agent_devices)")
      .all()
      .find((row) => row.name === "agent_device_token").unique,
    1,
  );
});
