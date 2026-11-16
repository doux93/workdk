import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { schemaSql, handleAgentRequest } from "../../agent/service.mjs";
import { createAgentServer } from "../../agent/server.mjs";
import { MAX_WORKSPACE_BYTES } from "../../server/workspace-service.mjs";
const workspace = (name = "工作台") => ({
  version: 1,
  name,
  theme: "light",
  layout: "balanced",
  example: false,
  modules: [],
});
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(schemaSql);
  return {
    db,
    adapter: {
      async all(sql, args) {
        return db.prepare(sql).all(...args);
      },
      async batch(rows) {
        db.exec("BEGIN");
        try {
          for (const r of rows) db.prepare(r.sql).run(...r.args);
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
    },
  };
}
const request = (
  body,
  query = "",
  method = body === undefined ? "GET" : "PUT",
) =>
  new Request("https://work.test/api/workspace-snapshot" + query, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined
      ? {}
      : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
const send = (
  s,
  body,
  query = "",
  access = { authorized: true, role: "owner" },
) => handleAgentRequest(request(body, query), s.adapter, access);
test("快照只允许所有者读取与写入，上传凭据不能获取数据", async () => {
  const s = fixture();
  try {
    for (const access of [
      { authorized: false },
      { authorized: true, role: "uploader" },
    ]) {
      assert.equal(
        (await send(s, undefined, "", access)).status,
        access.authorized ? 403 : 401,
      );
      assert.equal(
        (await send(s, { baseRevision: 0, workspace: workspace() }, "", access))
          .status,
        access.authorized ? 403 : 401,
      );
    }
    assert.equal(
      s.db.prepare("SELECT COUNT(*) n FROM workspace_snapshots").get().n,
      0,
    );
  } finally {
    s.db.close();
  }
});
test("完整快照往返并返回不缓存响应；过期版本不能覆盖", async () => {
  const s = fixture();
  try {
    assert.equal((await (await send(s)).json()).revision, 0);
    const first = await send(s, {
      baseRevision: 0,
      workspace: workspace("第一台"),
    });
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("cache-control"), "no-store");
    assert.equal((await first.json()).revision, 1);
    assert.equal(
      (await send(s, { baseRevision: 0, workspace: workspace("旧内容") }))
        .status,
      409,
    );
    const got = await (await send(s)).json();
    assert.equal(got.workspace.name, "第一台");
    assert.equal(got.history.length, 1);
  } finally {
    s.db.close();
  }
});
test("两个设备同时初始化或更新时只有一份条件写入成功", async () => {
  const s = fixture();
  try {
    for (const baseRevision of [0, 1]) {
      const results = await Promise.all(
        ["A", "B"].map((name) =>
          send(s, { baseRevision, workspace: workspace(name) }),
        ),
      );
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      assert.equal((await (await send(s)).json()).revision, baseRevision + 1);
    }
  } finally {
    s.db.close();
  }
});
test("无效快照、缺少版本及超过 UTF-8 字节限制的内容不会写入", async () => {
  const s = fixture();
  try {
    assert.equal((await send(s, "{")).status, 400);
    assert.equal((await send(s, { workspace: workspace() })).status, 428);
    assert.equal(
      (
        await send(s, {
          baseRevision: 0,
          workspace: { ...workspace(), homeMode: "invalid" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await send(s, {
          baseRevision: 0,
          workspace: {
            ...workspace(),
            name: "中".repeat(MAX_WORKSPACE_BYTES / 3 + 1000),
          },
        })
      ).status,
      413,
    );
    assert.equal((await send(s, undefined, "?revision=-1")).status, 400);
    assert.equal(
      s.db.prepare("SELECT COUNT(*) n FROM workspace_snapshots").get().n,
      0,
    );
  } finally {
    s.db.close();
  }
});
test("保留最近十个历史版本，清理失败不误报已成功的写入", async () => {
  const s = fixture();
  try {
    for (let i = 0; i < 12; i++)
      assert.equal(
        (await send(s, { baseRevision: i, workspace: workspace(String(i)) }))
          .status,
        200,
      );
    assert.equal(
      s.db.prepare("SELECT COUNT(*) n FROM workspace_snapshots").get().n,
      10,
    );
    assert.equal((await send(s, undefined, "?revision=1")).status, 404);
    assert.equal(
      (await (await send(s, undefined, "?revision=3")).json()).workspace.name,
      "2",
    );
    s.adapter.batch = async () => {
      throw new Error("cleanup failed");
    };
    assert.equal(
      (await send(s, { baseRevision: 12, workspace: workspace("仍成功") }))
        .status,
      200,
    );
    assert.equal((await (await send(s)).json()).workspace.name, "仍成功");
  } finally {
    s.db.close();
  }
});
test("快照迁移和本机表定义一致，不重建已有业务数据", () => {
  const s = fixture();
  const migrated = new DatabaseSync(":memory:");
  try {
    migrated.exec(
      readFileSync(
        new URL(
          "../../hosting/drizzle/0002_workspace_snapshots.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.deepEqual(
      migrated.prepare("PRAGMA table_info(workspace_snapshots)").all(),
      s.db.prepare("PRAGMA table_info(workspace_snapshots)").all(),
    );
  } finally {
    migrated.close();
    s.db.close();
  }
});
test("真实 HTTP 支持大于事件批次的快照且拒绝跨站、设备及匿名访问", async () => {
  const s = fixture();
  const server = createAgentServer({
    db: s.db,
    token: "local-admin-for-snapshot-test",
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/api/workspace-snapshot`;
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal(
      (
        await fetch(url, {
          headers: {
            Authorization: "Bearer local-admin-for-snapshot-test",
            Origin: "https://evil.example",
          },
        })
      ).status,
      401,
    );
    const body = {
      baseRevision: 0,
      workspace: {
        ...workspace(),
        modules: [
          {
            id: "notes",
            name: "笔记",
            description: "",
            icon: "note",
            color: "green",
            view: "notes",
            hidden: false,
            fields: [],
            entries: [
              {
                id: "note",
                title: "长文",
                description: "中".repeat(200000),
                status: "todo",
                priority: "普通",
                date: "",
                time: "",
                url: "",
                created: "2026-11-16",
                values: {},
              },
            ],
          },
        ],
      },
    };
    const write = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: "Bearer local-admin-for-snapshot-test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    assert.equal(write.status, 200);
    const got = await (
      await fetch(url, {
        headers: { Authorization: "Bearer local-admin-for-snapshot-test" },
      })
    ).json();
    assert.equal(
      got.workspace.modules[0].entries[0].description.length,
      200000,
    );
  } finally {
    await new Promise((r) => server.close(r));
    s.db.close();
  }
});
