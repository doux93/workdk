// Run on Windows: exercise the shipped CMD wrappers and interactive Node setup.
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  copyFileSync,
  linkSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { isWorkdkHook } from "../agent/hook-launcher.mjs";
const nodeOnly = process.argv.includes("--node-only");
assert.ok(
  nodeOnly || process.platform === "win32",
  "This check requires Windows CMD or --node-only.",
);
const index = process.argv.indexOf("--agent-dir");
const agent =
  index >= 0
    ? path.resolve(process.argv[index + 1])
    : fileURLToPath(new URL("../agent/", import.meta.url));
const root = mkdtempSync(path.join(tmpdir(), "workdk-windows-"));
const state = path.join(root, "采集 配置"),
  home = path.join(root, "模拟 用户"),
  project = path.join(root, "项目 & 空格");
for (const dir of [state, home, project]) mkdirSync(dir, { recursive: true });
const connection = path.join(root, "连接 配置.json");
writeFileSync(
  connection,
  JSON.stringify({
    url: "https://example.com",
    token: "test-only-key",
    projects: [],
  }),
);
const stub = path.join(root, "homedir.mjs");
writeFileSync(
  stub,
  'import os from "node:os";os.homedir=()=>process.env.WORKDK_TEST_HOOK_ROOT;',
);
const env = {
  ...process.env,
  WORKDK_AGENT_HOME: state,
  WORKDK_TEST_HOOK_ROOT: home,
  NODE_OPTIONS: "--import=" + pathToFileURL(stub).href,
};
async function runBatch(name, answers) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      nodeOnly ? process.execPath : process.env.ComSpec || "cmd.exe",
      nodeOnly
        ? name === "setup-agent.cmd"
          ? [path.join(agent, "setup.mjs")]
          : [path.join(agent, "collector.mjs"), "status"]
        : ["/d", "/c", name],
      {
        cwd: agent,
        env,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let stdout = "",
      stderr = "",
      sent = 0;
    const prompts = [
      "连接配置文件路径：",
      "允许采集的项目目录：",
      "工作台中的项目名称（留空使用文件夹名称）：",
    ];
    const timer = setTimeout(() => {
      child.kill();
      reject(
        new Error("Windows launcher timed out: " + stdout + "\n" + stderr),
      );
    }, 45000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (text) => {
      stdout += text;
      if (answers && sent < answers.length && stdout.includes(prompts[sent])) {
        child.stdin.write(answers[sent++] + "\r\n");
        if (sent === answers.length) child.stdin.end();
      }
    });
    child.stderr.on("data", (text) => (stderr += text));
    child.once("error", reject);
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, sent });
    });
    if (!answers) child.stdin.end("\r\n");
  });
}
try {
  for (const name of [
    "setup-agent.cmd",
    "start-agent.cmd",
    "status-agent.cmd",
  ]) {
    const b = readFileSync(path.join(agent, name));
    assert.ok(b.every((x) => x < 128));
    assert.equal(
      b.toString("ascii").replaceAll("\r\n", "").includes("\n"),
      false,
    );
  }
  for (let i = 0; i < 2; i++) {
    const setup = await runBatch("setup-agent.cmd", [
      '"' + connection + '"',
      '"' + project + '"',
      "Windows QA & 测试",
    ]);
    assert.equal(setup.sent, 3);
    assert.equal(setup.code, 0, setup.stdout + "\n" + setup.stderr);
    assert.ok(setup.stdout.includes("配置完成"));
  }
  const config = JSON.parse(
    readFileSync(path.join(state, "config.json"), "utf8"),
  );
  assert.equal(config.projects.length, 1);
  assert.equal(config.projects[0].path, project);
  assert.equal(config.projects[0].name, "Windows QA & 测试");
  const hooks = JSON.parse(
    readFileSync(path.join(home, ".codex/hooks.json"), "utf8"),
  );
  assert.equal(
    hooks.hooks.Stop.flatMap((g) => g.hooks).filter((h) =>
      isWorkdkHook(h.command),
    ).length,
    1,
  );
  const status = await runBatch("status-agent.cmd");
  assert.equal(status.code, 0, status.stdout + "\n" + status.stderr);
  assert.ok(status.stdout.includes('"pending": 0'));
  if (!nodeOnly) {
    const nodeDir = path.join(root, "Node runtime with spaces");
    mkdirSync(nodeDir);
    const spacedNode = path.join(nodeDir, "node.exe");
    try {
      linkSync(process.execPath, spacedNode);
    } catch {
      copyFileSync(process.execPath, spacedNode);
    }
    const invoke = (program, args, input, extra = {}) =>
      new Promise((resolve, reject) => {
        const child = spawn(program, args, {
          cwd: project,
          env: { ...env, ...extra },
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        });
        let stdout = "",
          stderr = "";
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error("Hook startup timed out"));
        }, 15000);
        child.stdout.on("data", (c) => (stdout += c));
        child.stderr.on("data", (c) => (stderr += c));
        child.once("error", (e) => {
          clearTimeout(timer);
          reject(e);
        });
        child.once("exit", (code) => {
          clearTimeout(timer);
          resolve({ code, stdout, stderr });
        });
        child.stdin.end(input);
      });
    const readSpool = () => {
      const dir = path.join(state, "outbox");
      return existsSync(dir)
        ? readdirSync(dir)
            .filter((f) => f.endsWith(".json"))
            .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")))
        : [];
    };
    for (const folder of [
      "package-flat",
      "package with spaces",
      "package & special",
    ]) {
      const target = path.join(root, folder);
      mkdirSync(target);
      for (const file of readdirSync(agent)) {
        if (file.startsWith(".") || file === "node.exe") continue;
        const src = path.join(agent, file);
        try {
          copyFileSync(src, path.join(target, file));
        } catch (e) {
          if (e.code !== "EISDIR") throw e;
        }
      }
      // Exercise the installer using a Node executable whose own path contains spaces.
      for (let i = 0; i < 2; i++) {
        const installed = await invoke(
          spacedNode,
          [path.join(target, "collector.mjs"), "install-hooks"],
          "",
        );
        assert.equal(installed.code, 0, installed.stderr);
      }
      for (const source of ["codex", "claude"]) {
        const file = path.join(
          home,
          source === "codex" ? ".codex/hooks.json" : ".claude/settings.json",
        );
        const hooks = JSON.parse(readFileSync(file, "utf8"));
        const own = hooks.hooks.Stop.flatMap((g) => g.hooks).filter((h) =>
          isWorkdkHook(h.command),
        );
        assert.equal(own.length, 1);
        const command = own[0].command;
        const payload = JSON.stringify({
          cwd: project,
          session_id: "windows-hook",
          turn_id: folder + "-" + source,
          hook_event_name: "Stop",
          last_assistant_message: "Windows 回调中文内容",
        });
        for (const mode of ["cmd", "split"]) {
          const before = readSpool().length;
          const pieces = command.split(/\s+/);
          const result = await invoke(
            mode === "cmd" ? process.env.ComSpec || "cmd.exe" : pieces[0],
            mode === "cmd" ? ["/C", command] : pieces.slice(1),
            payload,
          );
          assert.equal(
            result.code,
            0,
            folder +
              " / " +
              mode +
              " / " +
              source +
              "\n" +
              result.stdout +
              "\n" +
              result.stderr,
          );
          assert.ok(!result.stderr.includes("ExperimentalWarning"));
          assert.equal(
            readSpool().length,
            before + 1,
            folder + " / " + mode + " did not capture event",
          );
          assert.ok(
            readSpool().some((e) => e.summary === "Windows 回调中文内容"),
          );
        }
        const bad = await invoke(
          process.env.ComSpec || "cmd.exe",
          ["/C", command],
          "{",
        );
        assert.equal(bad.code, 0);
        assert.ok(existsSync(path.join(state, "hook-error.log")));
      }
    }
    console.log(
      "PASS: generated Codex/Claude hooks run with cmd /C and split spawn; flat/space/special directories; runtime path spaces; Unicode stdin; fail-open errors.",
    );
  }
  console.log(
    `PASS: ${nodeOnly ? "Node installer entry" : "Windows CMD"} setup and status; quoted Unicode/space paths; repeated install; no duplicate hooks.`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
