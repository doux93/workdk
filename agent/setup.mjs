import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
export function supportedNode(version) {
  const [major, minor] = version.replace(/^v/, "").split(".").map(Number);
  return major > 22 || (major === 22 && minor >= 13);
}
export function unquotePath(value) {
  const text = String(value).trim();
  return (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
    ? text.slice(1, -1)
    : text;
}
export function validateInputs(configFile, projectDir) {
  const config = path.resolve(unquotePath(configFile)),
    project = path.resolve(unquotePath(projectDir));
  if (
    !unquotePath(configFile) ||
    !existsSync(config) ||
    !statSync(config).isFile()
  )
    throw new Error("连接配置文件不存在，请从工作台下载后填写完整路径。");
  if (
    !unquotePath(projectDir) ||
    !existsSync(project) ||
    !statSync(project).isDirectory()
  )
    throw new Error("项目目录不存在，请填写允许采集的项目文件夹。");
  return { config, project };
}
export function configure(
  { config, project, name },
  run = (args) =>
    spawnSync(process.execPath, args, { stdio: "inherit", shell: false }),
) {
  const collector = fileURLToPath(new URL("./collector.mjs", import.meta.url));
  for (const args of [
    ["init", config],
    ["add-project", project, name || path.basename(project)],
    ["install-hooks"],
  ]) {
    const result = run([collector, ...args]);
    if (result.error)
      throw new Error("无法启动采集器：" + result.error.message);
    if (result.status !== 0)
      throw new Error("配置未完成（" + args[0] + "），请检查上方错误后重试。");
  }
}
export async function main() {
  if (!supportedNode(process.versions.node))
    throw new Error(
      "需要 Node.js 22.13 或更新版本，当前为 " +
        process.version +
        "。请从 https://nodejs.org/ 安装。",
    );
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(
      "工作台采集器安装 · 1.4.1\n先从工作台“Agent 工作日志 → 连接电脑”下载连接配置。路径可以带引号。",
    );
    const configFile = await rl.question("连接配置文件路径：");
    const projectDir = await rl.question("允许采集的项目目录：");
    const name = (
      await rl.question("工作台中的项目名称（留空使用文件夹名称）：")
    ).trim();
    const inputs = validateInputs(configFile, projectDir);
    configure({ ...inputs, name });
    console.log(
      "\n配置完成。请检查 Codex / Claude Code 的新回调，再运行 start-agent.cmd。\n使用期间保留上传窗口。可选开机启动见 README.md。",
    );
  } finally {
    rl.close();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error("\n" + error.message);
    process.exitCode = 1;
  });
}
