import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { openQueue, flushQueue } from "../../agent/queue.mjs";
import { drainHookEvents } from "../../agent/hook-spool.mjs";

// Windows CI points this at the unpacked download, verifying shipped modules too.
const agent = path.resolve(process.env.WORKDK_TEST_AGENT_DIR || "agent");
const { MAX_MESSAGE_BYTES, readMessages } = await import(
  pathToFileURL(path.join(agent, "mcp-protocol.mjs"))
);
const { installWorkBuddyMcp } = await import(
  pathToFileURL(path.join(agent, "mcp-install.mjs"))
);
const request = (id, method, params) => ({
  jsonrpc: "2.0",
  id,
  method,
  ...(params === undefined ? {} : { params }),
});
const initialize = (version = "2025-11-25") =>
  request(0, "initialize", {
    protocolVersion: version,
    capabilities: {},
    clientInfo: { name: "test-client", version: "1" },
  });
const ready = { jsonrpc: "2.0", method: "notifications/initialized" };
const args = {
  project: "测试项目",
  session: "task-1",
  summary: "完成本轮修改",
  evidence: "测试通过",
  kind: "stop",
};
const call = (id, arguments_ = args) =>
  request(id, "tools/call", { name: "record_work", arguments: arguments_ });
function fixture(t) {
  const home = mkdtempSync(path.join(tmpdir(), "workdk-mcp-"));
  const config = {
    version: 2,
    url: "https://example.com",
    token: "never-return-this-token",
    serviceToken: "never-return-service-token",
    device: "device-1",
    projects: [{ path: home, name: args.project }],
  };
  writeFileSync(path.join(home, "config.json"), JSON.stringify(config));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  return home;
}
function invoke(home, input, nodeArgs = []) {
  const processResult = spawnSync(
    process.execPath,
    [...nodeArgs, path.join(agent, "mcp.mjs")],
    {
      input:
        typeof input === "string"
          ? input
          : input.map((v) => JSON.stringify(v)).join("\n") + "\n",
      env: { ...process.env, WORKDK_AGENT_HOME: home },
      encoding: "utf8",
      timeout: 10000,
    },
  );
  assert.equal(
    processResult.status,
    0,
    processResult.stderr || String(processResult.error),
  );
  assert.equal(processResult.stderr, "");
  return processResult.stdout.trim()
    ? processResult.stdout.trim().split("\n").map(JSON.parse)
    : [];
}
function events(home) {
  const folder = path.join(home, "outbox");
  return existsSync(folder)
    ? readdirSync(folder)
        .filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(readFileSync(path.join(folder, f), "utf8")))
    : [];
}

test("MCP 协商已支持版本，未知版本返回明确降级版本和实际包版本", (t) => {
  const home = fixture(t);
  for (const version of [
    "2024-11-05",
    "2025-06-18",
    "2025-11-25",
    "2099-01-01",
  ]) {
    const result = invoke(home, [
      initialize(version),
      ready,
      request("list", "tools/list"),
    ]);
    assert.equal(result[0].id, 0);
    assert.equal(
      result[0].result.protocolVersion,
      version === "2099-01-01" ? "2025-11-25" : version,
    );
    assert.equal(
      result[0].result.serverInfo.version,
      JSON.parse(readFileSync("package.json", "utf8")).version,
    );
    assert.equal(result[1].result.tools[0].name, "record_work");
  }
});

test("MCP 无效 JSON / 请求 / 参数 / 方法分别返回协议错误，之后仍能处理请求", (t) => {
  const home = fixture(t);
  const lines = [
    "{invalid",
    "null",
    "[]",
    JSON.stringify(request(null, "ping")),
    JSON.stringify(request(1, "ping", [])),
    JSON.stringify(request(2, "missing")),
    JSON.stringify(request("", "ping")),
  ];
  const result = invoke(home, lines.join("\n"));
  assert.deepEqual(
    result.slice(0, -1).map((r) => r.error.code),
    [-32700, -32600, -32600, -32600, -32602, -32601],
  );
  assert.deepEqual(result.at(-1), { jsonrpc: "2.0", id: "", result: {} });
});

test("未完成初始化不能记录，通知无响应且不会触发工具写入", (t) => {
  const home = fixture(t);
  const result = invoke(home, [
    call(1),
    initialize(),
    call(2),
    ready,
    {
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "record_work", arguments: args },
    },
    { jsonrpc: "2.0", id: "unsolicited", result: {} },
    request(3, "tools/call", { name: "missing" }),
    request(4, "tools/list", { cursor: "invalid" }),
    request(5, "tools/call", { name: "record_work", arguments: [] }),
    request(6, "ping"),
  ]);
  assert.equal(result.length, 7);
  assert.deepEqual(
    [result[0].error.code, result[2].error.code],
    [-32000, -32000],
  );
  assert.deepEqual(
    result.slice(3, 6).map((r) => r.error.code),
    [-32602, -32602, -32602],
  );
  assert.deepEqual(events(home), []);
});

test("UTF-8 跨块保留中文，超限行和非法编码不会污染下一条请求", async () => {
  const valid = Buffer.from(JSON.stringify(request("中文", "ping")) + "\r\n");
  const pieces = Array.from(valid, (byte) => Buffer.from([byte]));
  pieces.push(
    Buffer.alloc(MAX_MESSAGE_BYTES + 1, 97),
    Buffer.from("more\n"),
    Buffer.from([0xff, 10]),
    valid,
  );
  const result = [];
  for await (const message of readMessages(Readable.from(pieces)))
    result.push(message);
  assert.equal(result.length, 4);
  assert.equal(result[0].value.id, "中文");
  assert.equal(result[1].error.error.code, -32600);
  assert.equal(result[2].error.error.code, -32700);
  assert.equal(result[3].value.id, "中文");
});

test("record_work 严格校验声明字段，拒绝空摘要、伪造来源、非法类型和超长内容", (t) => {
  const home = fixture(t);
  const invalid = [
    {},
    { ...args, summary: undefined },
    { ...args, summary: "  " },
    { ...args, summary: 1 },
    { ...args, summary: "a".repeat(12001) },
    { ...args, evidence: "b".repeat(8001) },
    { ...args, evidence: null },
    { ...args, session: " " },
    { ...args, project: "other" },
    { ...args, kind: "start" },
    { ...args, source: "codex" },
    { ...args, device: "other" },
    { ...args, id: "overwrite" },
  ];
  const result = invoke(home, [
    initialize(),
    ready,
    ...invalid.map((a, i) => call(i + 1, a)),
  ]);
  assert.ok(result.slice(1).every((r) => r.result.isError === true));
  assert.deepEqual(events(home), []);
});

test("MCP 真实进程不依赖 SQLite；脱敏后持久保存，并由现有上传队列同步确认", async (t) => {
  const home = fixture(t);
  const loader = path.join(home, "deny-sqlite.mjs"),
    bootstrap = path.join(home, "bootstrap.mjs");
  writeFileSync(
    loader,
    "export async function resolve(s,c,n){if(s==='node:sqlite'||s.endsWith('/queue.mjs'))throw new Error('SQLite must not load');return n(s,c);}",
  );
  writeFileSync(
    bootstrap,
    `import {register} from 'node:module';register(${JSON.stringify(pathToFileURL(loader).href)});`,
  );
  const result = invoke(
    home,
    [
      initialize(),
      ready,
      call(1, {
        ...args,
        summary: "修复完成 token=must-hide-this",
        evidence: "https://example.com/file?token=hidden",
      }),
    ],
    ["--import", bootstrap],
  );
  assert.equal(result[1].result.isError, false);
  assert.match(result[1].result.content[0].text, /入队不代表服务器已收到/);
  assert.equal(existsSync(path.join(home, "events.sqlite")), false);
  const saved = events(home);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].source, "workbuddy");
  assert.equal(saved[0].device, "device-1");
  assert.equal(saved[0].summary.includes("must-hide-this"), false);
  assert.equal(saved[0].evidence.includes("token="), false);
  const queue = openQueue(path.join(home, "events.sqlite"));
  try {
    assert.equal(drainHookEvents(queue, home), 1);
    assert.equal(events(home).length, 0);
    await flushQueue(
      queue,
      { url: "https://example.com", token: "test" },
      async (_, options) => {
        const batch = JSON.parse(options.body).events;
        assert.equal(batch[0].id, saved[0].id);
        return {
          ok: true,
          json: async () => ({ acknowledged: batch.map((e) => e.id) }),
        };
      },
    );
    assert.equal(queue.status().pending, 0);
    assert.equal(queue.status().sent, 1);
  } finally {
    queue.close();
  }
});

test("配置或写入失败给出可操作提示，不回显凭据或底层异常内容", (t) => {
  const home = fixture(t);
  writeFileSync(path.join(home, "outbox"), "blocking-file");
  let result = invoke(home, [initialize(), ready, call(1)]);
  assert.match(result[1].result.content[0].text, /磁盘空间/);
  assert.equal(result[1].result.isError, true);
  writeFileSync(
    path.join(home, "config.json"),
    '{"token":"never-return-this-token",',
  );
  result = invoke(home, [initialize(), ready, call(2)]);
  assert.match(result[1].result.content[0].text, /初始化/);
  assert.equal(JSON.stringify(result).includes("never-return"), false);
});

test("WorkBuddy 安装保留其他服务器和选项，备份原文件，重复执行不创建副本", (t) => {
  const home = fixture(t),
    target = path.join(home, ".workbuddy", "mcp.json");
  mkdirSync(path.dirname(target));
  const original = JSON.stringify({
    custom: true,
    mcpServers: {
      other: { command: "tool", env: { TOKEN: "keep-only-in-config" } },
    },
  });
  writeFileSync(target, original);
  const first = installWorkBuddyMcp({ home, target });
  const doc = JSON.parse(readFileSync(target, "utf8"));
  assert.equal(doc.custom, true);
  assert.deepEqual(doc.mcpServers.other, JSON.parse(original).mcpServers.other);
  assert.equal(readFileSync(first.backup, "utf8"), original);
  assert.deepEqual(doc.mcpServers["workdk-journal"].env, {
    WORKDK_AGENT_HOME: home,
  });
  const count = readdirSync(path.dirname(target)).length;
  assert.equal(installWorkBuddyMcp({ home, target }).changed, false);
  assert.equal(readdirSync(path.dirname(target)).length, count);
});

test("WorkBuddy 无效配置或同名非本工具条目不会被覆盖", (t) => {
  const home = fixture(t),
    target = path.join(home, "mcp.json");
  for (const original of [
    "{broken",
    "null",
    "[]",
    '{"mcpServers":[]}',
    '{"mcpServers":{"workdk-journal":{"command":"other"}}}',
  ]) {
    writeFileSync(target, original);
    assert.throws(() => installWorkBuddyMcp({ home, target }));
    assert.equal(readFileSync(target, "utf8"), original);
  }
});

test("WorkBuddy 安装命令生成的配置可直接启动打包 MCP，路径含中文和空格", (t) => {
  const home = fixture(t),
    userHome = path.join(home, "模拟 用户");
  const stub = path.join(home, "homedir.mjs");
  writeFileSync(
    stub,
    `import os from 'node:os';os.homedir=()=>${JSON.stringify(userHome)};`,
  );
  const result = spawnSync(
    process.execPath,
    ["--import", stub, path.join(agent, "collector.mjs"), "install-mcp"],
    {
      env: { ...process.env, WORKDK_AGENT_HOME: home },
      encoding: "utf8",
      timeout: 10000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const doc = JSON.parse(
    readFileSync(path.join(userHome, ".workbuddy", "mcp.json"), "utf8"),
  );
  const entry = doc.mcpServers["workdk-journal"];
  assert.equal(JSON.stringify(entry).includes("never-return"), false);
  const child = spawnSync(entry.command, entry.args, {
    env: { ...process.env, ...entry.env },
    input: [initialize(), ready, call(1)].map(JSON.stringify).join("\n") + "\n",
    encoding: "utf8",
    timeout: 10000,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stderr, "");
  assert.equal(events(home).length, 1);
});
