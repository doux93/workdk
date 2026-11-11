import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  rmSync,
  mkdirSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import {
  isWorkdkHook,
  mergeHooks,
  windowsHookCommand,
} from "../../agent/hook-launcher.mjs";
import { writeHookEvent, drainHookEvents } from "../../agent/hook-spool.mjs";
import { openQueue } from "../../agent/queue.mjs";
function fixture() {
  const home = mkdtempSync(path.join(tmpdir(), "workdk-hook-"));
  writeFileSync(
    path.join(home, "config.json"),
    JSON.stringify({
      url: "https://example.com",
      token: "private-test-only",
      device: "test",
      projects: [{ path: home, name: "test" }],
    }),
  );
  return {
    home,
    input: JSON.stringify({
      hook_event_name: "Stop",
      cwd: home,
      session_id: "s",
      turn_id: "t",
      last_assistant_message: "完成本轮中文测试",
    }),
    close() {
      rmSync(home, { recursive: true, force: true });
    },
  };
}
const event = {
  id: "same-event",
  device: "test",
  source: "codex",
  session: "s",
  project: "test",
  kind: "stop",
  at: "2026-01-01T00:00:00Z",
  summary: "test",
  evidence: "",
};
test("迁移已知 quoted/unquoted/带参数/包装脚本回调，保留无关 collector 任务", () => {
  for (const command of [
    '"C:/Program Files/node.exe" "E:/work/collector.mjs" hook codex',
    "E:/work/node.exe --no-warnings E:/work/collector.mjs hook codex",
    "E:/work/workdk-hook.cmd codex",
  ])
    assert.equal(isWorkdkHook(command), true, command);
  assert.equal(
    isWorkdkHook("node E:/other/collector.mjs unrelated-job"),
    false,
  );
  const command = windowsHookCommand(
    "C:\\Program Files\\workdk\\collector.mjs",
    "codex",
    "C:\\Program Files\\workdk\\node.exe",
  );
  assert.ok(isWorkdkHook(command));
  const doc = {
    hooks: {
      Stop: [
        {
          hooks: [
            { command },
            { command: "node other/collector.mjs unrelated-job" },
            { command: "E:/old/collector.mjs hook codex" },
          ],
        },
      ],
    },
  };
  const groups = mergeHooks(doc, "Stop", { command }, "codex");
  assert.equal(
    groups.flatMap((g) => g.hooks).filter((h) => isWorkdkHook(h.command))
      .length,
    1,
  );
  assert.equal(groups.flatMap((g) => g.hooks).length, 2);
});
test("Windows 无空格路径无引号；空格与命令字符路径生成可安全分词的包装入口", () => {
  const flat = windowsHookCommand(
    "E:\\work\\collector.mjs",
    "codex",
    "E:\\work\\node.exe",
  );
  assert.equal(
    flat,
    "E:\\work\\node.exe --no-warnings E:\\work\\collector.mjs hook codex",
  );
  assert.ok(!flat.includes('"'));
  for (const folder of ["C:\\Some Folder", "C:\\R&D", "C:\\work(1)"]) {
    const command = windowsHookCommand(
      folder + "\\collector.mjs",
      "claude",
      folder + "\\node.exe",
    );
    const pieces = command.split(/\s+/);
    assert.equal(pieces.length, 6);
    assert.equal(pieces[0], "powershell.exe");
    assert.ok(!command.includes('"'));
    assert.ok(isWorkdkHook(command));
    assert.ok(
      Buffer.from(pieces[5], "base64")
        .toString("utf16le")
        .includes("workdk-hook.cmd"),
    );
  }
});
test("真实 hook 进程不加载 queue/sqlite，无实验警告，事件先持久写入 outbox", () => {
  const f = fixture();
  try {
    const loader = path.join(f.home, "deny-sqlite.mjs"),
      bootstrap = path.join(f.home, "bootstrap.mjs");
    writeFileSync(
      loader,
      "export async function resolve(s,c,n){if(s==='node:sqlite'||s.endsWith('/queue.mjs'))throw new Error('SQLite must not load in hook mode');return n(s,c);}",
    );
    writeFileSync(
      bootstrap,
      `import {register} from 'node:module';register(${JSON.stringify(pathToFileURL(loader).href)});`,
    );
    const r = spawnSync(
      process.execPath,
      ["--import", bootstrap, "agent/collector.mjs", "hook", "codex"],
      {
        input: f.input,
        env: { ...process.env, WORKDK_AGENT_HOME: f.home },
        encoding: "utf8",
      },
    );
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
    assert.equal(r.stdout, "{}");
    assert.ok(!existsSync(path.join(f.home, "events.sqlite")));
    const files = readdirSync(path.join(f.home, "outbox")).filter((x) =>
      x.endsWith(".json"),
    );
    assert.equal(files.length, 1);
    assert.equal(
      JSON.parse(readFileSync(path.join(f.home, "outbox", files[0]), "utf8"))
        .summary,
      "完成本轮中文测试",
    );
  } finally {
    f.close();
  }
});
test("无效 JSON、缺失模块和无法写日志都不会使 hook 返回非零状态", () => {
  const f = fixture();
  try {
    let r = spawnSync(
      process.execPath,
      ["agent/collector.mjs", "hook", "codex"],
      {
        input: '{"password":"do-not-log",',
        env: { ...process.env, WORKDK_AGENT_HOME: f.home },
        encoding: "utf8",
      },
    );
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "{}");
    assert.equal(r.stderr, "");
    const log = readFileSync(path.join(f.home, "hook-error.log"), "utf8");
    assert.ok(log.includes("SyntaxError"));
    assert.ok(!log.includes("do-not-log"));
    const isolated = path.join(f.home, "isolated");
    mkdirSync(isolated);
    copyFileSync("agent/collector.mjs", path.join(isolated, "collector.mjs"));
    r = spawnSync(
      process.execPath,
      [path.join(isolated, "collector.mjs"), "hook", "codex"],
      {
        input: f.input,
        env: { ...process.env, WORKDK_AGENT_HOME: f.home },
        encoding: "utf8",
      },
    );
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
    const file = path.join(f.home, "not-a-directory");
    writeFileSync(file, "test");
    r = spawnSync(process.execPath, ["agent/collector.mjs", "hook", "codex"], {
      input: f.input,
      env: { ...process.env, WORKDK_AGENT_HOME: file },
      encoding: "utf8",
    });
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
  } finally {
    f.close();
  }
});
test("outbox 转入 SQLite 可重放去重，坏文件保留并隔离", () => {
  const f = fixture();
  const q = openQueue(path.join(f.home, "events.sqlite"));
  try {
    writeHookEvent(f.home, event);
    writeHookEvent(f.home, event);
    writeFileSync(path.join(f.home, "outbox", "broken.json"), "{");
    const errors = [];
    assert.equal(
      drainHookEvents(q, f.home, (e) => errors.push(e)),
      2,
    );
    assert.equal(q.status().pending, 1);
    assert.equal(errors.length, 1);
    assert.ok(existsSync(path.join(f.home, "outbox", "broken.json.invalid")));
    assert.equal(drainHookEvents(q, f.home), 0);
  } finally {
    q.close();
    f.close();
  }
});
