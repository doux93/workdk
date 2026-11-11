// Cross-process protocol test. Hook payloads are fixtures, not a live model session.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = process.argv.indexOf("--collector-dir");
const agent =
  option >= 0
    ? path.resolve(process.argv[option + 1])
    : path.join(repo, "agent");
const root = mkdtempSync(path.join(tmpdir(), "workdk-process-qa-"));
const state = path.join(root, "state"),
  project = path.join(root, "project"),
  hooksRoot = path.join(root, "hook-home");
for (const dir of [state, project, hooksRoot])
  mkdirSync(dir, { recursive: true });
const token = randomBytes(32).toString("base64url");
const env = { ...process.env, WORKDK_AGENT_HOME: state };
const collector = path.join(agent, "collector.mjs");
const report = {
  test: "real collector + SQLite + HTTP receiver + MCP processes; synthetic hook payloads",
  runtime: process.version,
  checks: {},
};
let server, uploader;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function start(args, extra = {}) {
  return spawn(process.execPath, args, {
    cwd: repo,
    env: { ...env, ...extra },
    stdio: ["pipe", "pipe", "pipe"],
  });
}
function run(args, input = "", extra = {}) {
  return new Promise((resolve, reject) => {
    const p = start(args, extra);
    let stdout = "",
      stderr = "";
    p.stdout.on("data", (c) => (stdout += c));
    p.stderr.on("data", (c) => (stderr += c));
    p.once("error", reject);
    p.once("close", (code) => resolve({ code, stdout, stderr }));
    p.stdin.end(input);
  });
}
async function cli(args, input = "") {
  return run([collector, ...args], input);
}
async function status() {
  const r = await cli(["status"]);
  assert.equal(r.code, 0);
  return JSON.parse(r.stdout);
}
async function api(route, body, credential = token) {
  const r = await fetch("http://127.0.0.1:8788" + route, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + credential,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(5000),
  });
  return { status: r.status, body: await r.json() };
}
async function stop(process) {
  if (!process || process.exitCode !== null) return;
  process.kill("SIGTERM");
  for (let i = 0; i < 90 && process.exitCode === null; i++) await delay(200);
  if (process.exitCode === null) process.kill("SIGKILL");
}
try {
  const connection = path.join(root, "connection.json");
  writeFileSync(
    connection,
    JSON.stringify({ url: "http://127.0.0.1:8788", token, projects: [] }),
    { mode: 0o600 },
  );
  assert.equal((await cli(["init", connection])).code, 0);
  assert.equal((await cli(["add-project", project, "云电脑协议验收"])).code, 0);
  // Isolate only the installer's homedir lookup; do not modify global HOME / CODEX_HOME or active agent configuration.
  const homeStub = path.join(root, "home-stub.mjs");
  writeFileSync(
    homeStub,
    'import os from "node:os"; os.homedir=()=>process.env.WORKDK_TEST_HOOK_ROOT;',
  );
  mkdirSync(path.join(hooksRoot, ".codex"), { recursive: true });
  writeFileSync(
    path.join(hooksRoot, ".codex/hooks.json"),
    JSON.stringify({
      hooks: {
        Stop: [
          { hooks: [{ type: "command", command: "echo keep-existing-hook" }] },
        ],
      },
    }),
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await run(["--import", homeStub, collector, "install-hooks"], "", {
          WORKDK_TEST_HOOK_ROOT: hooksRoot,
        })
      ).code,
      0,
    );
  const installed = JSON.parse(
    readFileSync(path.join(hooksRoot, ".codex/hooks.json"), "utf8"),
  );
  assert.equal(
    installed.hooks.Stop.flatMap((g) => g.hooks).filter((h) =>
      h.command.includes("collector.mjs"),
    ).length,
    1,
  );
  assert.ok(
    installed.hooks.Stop.flatMap((g) => g.hooks).some(
      (h) => h.command === "echo keep-existing-hook",
    ),
  );
  assert.ok(
    readdirSync(path.join(hooksRoot, ".codex")).some((n) =>
      n.includes("workdk-backup"),
    ),
  );
  report.checks.installMergeBackupAndIdempotence = true;
  const common = {
    cwd: project,
    session_id: "protocol-qa",
    turn_id: "turn-qa",
  };
  const fixtures = [
    { hook_event_name: "SessionStart" },
    {
      hook_event_name: "UserPromptSubmit",
      prompt: "检查数字字段校验，password=test-only-secret",
    },
    {
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_use_id: "tool-qa",
      tool_input: { command: "node --test", content: "MUST_NOT_UPLOAD" },
      tool_response: { exit_code: 0 },
    },
    {
      hook_event_name: "Stop",
      last_assistant_message:
        "协议验收完成；真实 Codex 模型会话未在本测试中运行。",
    },
  ];
  for (const input of fixtures)
    assert.equal(
      (await cli(["hook", "codex"], JSON.stringify({ ...common, ...input })))
        .code,
      0,
    );
  let s = await status();
  assert.equal(s.pending, 4);
  // Exercise the failure path with an unavailable receiving process, then restart the collector process.
  assert.notEqual((await cli(["sync"])).code, 0);
  assert.equal((await status()).pending, 4);
  report.checks.failedUploadRetainsQueueAcrossProcesses = true;
  server = start([path.join(repo, "agent/server.mjs")], {
    WORKDK_INGEST_TOKEN: token,
    WORKDK_SERVER_DB: path.join(root, "receiver.sqlite"),
  });
  await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(
      () => reject(new Error("receiver startup timeout")),
      10000,
    );
    server.stdout.on("data", (c) => {
      output += c;
      if (output.includes("Agent API:")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.stderr.resume();
    server.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error("receiver startup failed: " + code));
    });
  });
  uploader = start([collector, "run"]);
  uploader.stdout.resume();
  uploader.stderr.resume();
  for (let i = 0; i < 100; i++) {
    if ((await status()).pending === 0) break;
    await delay(200);
  }
  assert.equal((await status()).pending, 0);
  report.checks.backgroundUploaderDrainsQueue = true;
  let list = await api("/api/agent-sessions");
  assert.equal(list.status, 200);
  assert.equal(list.body.sessions.length, 1);
  assert.equal(list.body.sessions[0].count, 4);
  assert.equal(list.body.sessions[0].state, "stop");
  let detail = await api(
    "/api/agent-session?id=" + encodeURIComponent(list.body.sessions[0].id),
  );
  assert.equal(detail.body.events.length, 4);
  assert.ok(detail.body.events.some((e) => e.evidence === "Bash · exit 0"));
  assert.ok(!JSON.stringify(detail.body.events).includes("test-only-secret"));
  assert.ok(!JSON.stringify(detail.body.events).includes("MUST_NOT_UPLOAD"));
  report.checks.apiReadSummaryEvidenceAndRedaction = true;
  const q = await import(path.join(agent, "queue.mjs"));
  const queue = q.openQueue(path.join(state, "events.sqlite"));
  const payloads = queue.db
    .prepare("SELECT payload FROM queue")
    .all()
    .map((r) => JSON.parse(r.payload));
  queue.close();
  assert.equal(
    (await api("/api/agent-events", { events: payloads })).status,
    200,
  );
  assert.equal((await api("/api/agent-sessions")).body.sessions[0].count, 4);
  report.checks.replayDoesNotDuplicate = true;
  assert.equal(
    (await api("/api/agent-events", { events: payloads }, "invalid")).status,
    401,
  );
  report.checks.invalidCredentialRejected = true;
  const messages = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "qa", version: "1" },
      },
    },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "record_work",
        arguments: {
          project: "云电脑协议验收",
          session: "mcp-protocol-qa",
          summary: "MCP 协议验收（合成测试）",
        },
      },
    },
  ];
  const mcp = await run(
    [path.join(agent, "mcp.mjs")],
    messages.map((m) => JSON.stringify(m)).join("\n") + "\n",
  );
  assert.equal(mcp.code, 0);
  const replies = mcp.stdout
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  assert.equal(replies.length, 3);
  assert.equal(replies[1].result.tools[0].name, "record_work");
  assert.notEqual(replies[2].result.isError, true);
  assert.equal((await cli(["sync"])).code, 0);
  list = await api("/api/agent-sessions");
  assert.ok(list.body.sessions.some((s) => s.source === "workbuddy"));
  report.checks.mcpInitializeToolCallAndUpload = true;
  report.sessions = list.body.sessions.length;
  report.events = list.body.sessions.reduce((sum, s) => sum + s.count, 0);
  report.status = await status();
} finally {
  await stop(uploader);
  await stop(server);
  rmSync(root, { recursive: true, force: true });
}
report.temporaryFilesRemoved = true;
console.log(JSON.stringify(report, null, 2));
