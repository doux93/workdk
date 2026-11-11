import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  copyFileSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { safeConfig, normalizeEvent } from "./core.mjs";
import { adaptHook } from "./adapter.mjs";
import { openQueue, flushQueue } from "./queue.mjs";
const home =
  process.env.WORKDK_AGENT_HOME || path.join(os.homedir(), ".workdk-agent");
const configPath = path.join(home, "config.json");
const command = process.argv[2] || "status";
const stdin = async () => {
  let text = "";
  for await (const chunk of process.stdin) {
    text += chunk;
    if (text.length > 200000) throw new Error("输入内容过大");
  }
  return text;
};
function load() {
  return safeConfig(JSON.parse(readFileSync(configPath, "utf8")));
}
function queue() {
  return openQueue(path.join(home, "events.sqlite"));
}
function installHooks(config, source) {
  const target = path.join(
    os.homedir(),
    source === "codex" ? ".codex/hooks.json" : ".claude/settings.json",
  );
  mkdirSync(path.dirname(target), { recursive: true });
  const doc = existsSync(target)
    ? JSON.parse(readFileSync(target, "utf8"))
    : {};
  const executable = JSON.stringify(process.execPath.replaceAll("\\", "/"));
  const script = JSON.stringify(
    fileURLToPath(import.meta.url).replaceAll("\\", "/"),
  );
  const run = `${executable} ${script} hook ${source}`;
  doc.hooks ??= {};
  const events =
    source === "codex"
      ? [
          "SessionStart",
          "UserPromptSubmit",
          "PostToolUse",
          "Stop",
          "Interrupt",
          "SessionEnd",
        ]
      : [
          "SessionStart",
          "UserPromptSubmit",
          "PostToolUse",
          "PostToolUseFailure",
          "Stop",
          "StopFailure",
          "SessionEnd",
        ];
  for (const event of events) {
    const groups = doc.hooks[event] || [];
    doc.hooks[event] = groups
      .map((group) => ({
        ...group,
        hooks: (group.hooks || []).filter(
          (h) =>
            !String(h.command || "").includes('collector.mjs" hook ' + source),
        ),
      }))
      .filter((g) => g.hooks.length);
    doc.hooks[event].push({
      hooks: [
        {
          type: "command",
          command: run,
          timeout:
            source === "codex" && ["Interrupt", "SessionEnd"].includes(event)
              ? 3
              : 10,
        },
      ],
    });
  }
  if (existsSync(target))
    copyFileSync(target, target + ".workdk-backup-" + Date.now());
  writeFileSync(target, JSON.stringify(doc, null, 2) + "\n", { mode: 0o600 });
  console.log(`${source} 回调已配置。请在工具中检查 /hooks 并信任新回调。`);
}
try {
  if (command === "init") {
    const file = process.argv[3];
    if (!file)
      throw new Error("用法：node agent/collector.mjs init 配置文件.json");
    const config = safeConfig(JSON.parse(readFileSync(file, "utf8")));
    config.device = randomUUID();
    // Each project must be explicitly selected on this computer; the downloaded config starts with an empty allowlist.
    mkdirSync(home, { recursive: true, mode: 0o700 });
    if (existsSync(configPath))
      copyFileSync(configPath, configPath + ".backup-" + Date.now());
    writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
    console.log("采集器已初始化。下一步添加允许记录的项目。");
  } else if (command === "add-project") {
    const config = load(),
      root = path.resolve(process.argv[3] || ""),
      name = process.argv[4] || path.basename(root);
    if (!process.argv[3] || !existsSync(root))
      throw new Error("请指定存在的项目目录");
    config.projects = config.projects.filter((p) => p.path !== root);
    config.projects.push({ path: root, name });
    writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
    console.log("已添加项目：" + name);
  } else if (command === "install-hooks") {
    const config = load();
    if (!config.projects.length) throw new Error("请先添加至少一个项目");
    for (const source of ["codex", "claude"]) installHooks(config, source);
  } else if (command === "hook") {
    const config = load(),
      input = JSON.parse(await stdin()),
      event = adaptHook(process.argv[3], input, config);
    if (event) {
      const q = queue();
      try {
        q.add(event);
      } finally {
        q.close();
      }
    }
    // Never block or continue the Agent. Stop requires valid JSON when output is present.
    if (process.argv[3] === "codex" && input.hook_event_name === "Stop")
      process.stdout.write("{}");
  } else if (command === "record") {
    const config = load();
    const input = JSON.parse(await stdin());
    const event = normalizeEvent({
      ...input,
      id: input.id || randomUUID(),
      device: config.device,
      at: input.at || new Date().toISOString(),
    });
    if (!config.projects.some((p) => p.name === event.project))
      throw new Error("项目不在允许列表中");
    const q = queue();
    try {
      q.add(event);
    } finally {
      q.close();
    }
    console.log("记录已进入上传队列");
  } else if (command === "run" || command === "sync") {
    const config = load(),
      q = queue();
    let stopped = false;
    for (const signal of ["SIGINT", "SIGTERM"])
      process.once(signal, () => {
        stopped = true;
      });
    do {
      try {
        const n = await flushQueue(q, config);
        if (n) console.log("已同步 " + n + " 条事件");
      } catch (e) {
        console.error(e.message);
        if (command === "sync") process.exitCode = 1;
      }
      if (command === "sync" || stopped) break;
      await new Promise((r) => setTimeout(r, 15000));
    } while (!stopped);
    q.close();
  } else if (command === "status") {
    const q = queue();
    try {
      console.log(JSON.stringify(q.status(), null, 2));
    } finally {
      q.close();
    }
  } else
    throw new Error(
      "支持：init / add-project / install-hooks / run / sync / status / record",
    );
} catch (e) {
  console.error(
    "工作台采集器：" +
      (command === "hook"
        ? "记录失败，请运行 status 检查本地环境。"
        : e.message),
  );
  if (command !== "hook") process.exitCode = 1;
}
