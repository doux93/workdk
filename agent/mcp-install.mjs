import {
  existsSync,
  readFileSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  renameSync,
  rmSync,
  constants,
} from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const basename = (value) =>
  typeof value === "string"
    ? value.replaceAll("\\", "/").split("/").at(-1)
    : "";
export function installWorkBuddyMcp({
  home,
  target = path.join(os.homedir(), ".workbuddy", "mcp.json"),
  executable = process.execPath,
  script = fileURLToPath(new URL("./mcp.mjs", import.meta.url)),
}) {
  const existed = existsSync(target);
  let doc;
  try {
    doc = existed ? JSON.parse(readFileSync(target, "utf8")) : {};
  } catch {
    throw new Error(
      "WorkBuddy mcp.json 无法读取或 JSON 无效；原配置未修改，请先修复后重试。",
    );
  }
  if (!object(doc) || (doc.mcpServers !== undefined && !object(doc.mcpServers)))
    throw new Error("WorkBuddy mcpServers 必须为对象；原配置未修改。");
  doc.mcpServers ??= {};
  const previous = doc.mcpServers["workdk-journal"];
  // Never replace an unrelated server that happens to use the same display name.
  if (
    previous !== undefined &&
    (!object(previous) ||
      !["node", "node.exe"].includes(
        basename(previous.command).toLowerCase(),
      ) ||
      !Array.isArray(previous.args) ||
      previous.args.length !== 1 ||
      basename(previous.args[0]) !== "mcp.mjs" ||
      (previous.env !== undefined && !object(previous.env)))
  )
    throw new Error(
      "workdk-journal 名称已被其他配置占用；请在 WorkBuddy 中检查或重命名后重试。原配置未修改。",
    );
  const entry = {
    ...previous,
    command: path.resolve(executable),
    args: [path.resolve(script)],
    env: { ...previous?.env, WORKDK_AGENT_HOME: path.resolve(home) },
  };
  if (JSON.stringify(previous) === JSON.stringify(entry))
    return { target, changed: false, backup: null };
  doc.mcpServers["workdk-journal"] = entry;
  mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const suffix = randomUUID();
  const temporary = target + ".workdk-" + suffix + ".tmp";
  const backup = existed ? target + ".workdk-backup-" + suffix : null;
  try {
    if (backup) copyFileSync(target, backup, constants.COPYFILE_EXCL);
    writeFileSync(temporary, JSON.stringify(doc, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    renameSync(temporary, target);
  } finally {
    rmSync(temporary, { force: true });
  }
  return { target, changed: true, backup };
}
