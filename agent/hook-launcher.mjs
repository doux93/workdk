import {
  existsSync,
  readFileSync,
  writeFileSync,
  linkSync,
  copyFileSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
const unsafeCmdPath = /[\s"'&|<>^()%!]/;
const digest = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
export function isWorkdkHook(command, source) {
  const text = String(command || "");
  if (
    /(?:^|[\\/\s"'])collector\.mjs["']?\s+hook\s+["']?(?:codex|claude)["']?(?:\s|$)/i.test(
      text,
    ) ||
    /(?:^|[\\/\s"'])workdk-hook\.cmd["']?\s+["']?(?:codex|claude)["']?(?:\s|$)/i.test(
      text,
    )
  )
    return true;
  const encoded = text.match(
    /^powershell(?:\.exe)?\s+-NoLogo\s+-NoProfile\s+-NonInteractive\s+-EncodedCommand\s+([A-Za-z0-9+/=]+)$/i,
  );
  if (!encoded) return false;
  const script = Buffer.from(encoded[1], "base64").toString("utf16le");
  return (
    /workdk-hook\.cmd'\s+'(?:codex|claude)'/.test(script) &&
    script.startsWith("$workdkHookBridge='v1';")
  );
}
export function mergeHooks(doc, event, handler, source) {
  const groups = doc.hooks?.[event] || [];
  return [
    ...groups
      .map((group) => ({
        ...group,
        hooks: (group.hooks || []).filter(
          (h) => !isWorkdkHook(h.command, source),
        ),
      }))
      .filter((g) => g.hooks.length),
    { hooks: [handler] },
  ];
}
export function prepareWindowsNode(dir, executable = process.execPath) {
  const local = path.join(dir, "node.exe"),
    marker = path.join(dir, ".workdk-node-runtime.json"),
    expected = digest(executable);
  if (existsSync(local) && digest(local) !== expected) {
    if (!existsSync(marker))
      throw new Error(
        "采集器目录已有其他 node.exe，未覆盖；请移走该文件后重试。",
      );
    const previous = JSON.parse(readFileSync(marker, "utf8"));
    if (previous.sha256 !== digest(local))
      throw new Error("目录中的 node.exe 已被其他程序修改，未覆盖。");
  }
  if (!existsSync(local) || digest(local) !== expected) {
    const temp = local + "." + randomUUID() + ".tmp";
    try {
      try {
        linkSync(executable, temp);
      } catch {
        copyFileSync(executable, temp);
      }
      renameSync(temp, local);
    } finally {
      if (existsSync(temp)) unlinkSync(temp);
    }
  }
  writeFileSync(
    marker,
    JSON.stringify({ sha256: expected, nodeVersion: process.versions.node }) +
      "\n",
    { mode: 0o600 },
  );
  return local;
}
export function windowsHookCommand(self, source, localNode) {
  if (!["codex", "claude"].includes(source)) throw new Error("未知来源");
  const dir = path.win32.dirname(self);
  if (!unsafeCmdPath.test(dir))
    return `${localNode} --no-warnings ${self} hook ${source}`;
  // A wrapper path containing spaces cannot itself be used as an unquoted command.
  // Encode only the path/stdio bridge, with no credentials or execution-policy changes.
  const wrapper = path.win32.join(dir, "workdk-hook.cmd").replaceAll("'", "''");
  const script = `$workdkHookBridge='v1';$ErrorActionPreference='Stop';$OutputEncoding=New-Object System.Text.UTF8Encoding($false);try{$reader=[System.IO.StreamReader]::new([Console]::OpenStandardInput(),[System.Text.Encoding]::UTF8);$payload=$reader.ReadToEnd();$payload | & '${wrapper}' '${source}'}catch{try{$d=$env:WORKDK_AGENT_HOME;if(!$d){$d=Join-Path $env:USERPROFILE '.workdk-agent'};[IO.Directory]::CreateDirectory($d)|Out-Null;[IO.File]::AppendAllText((Join-Path $d 'hook-error.log'),([DateTime]::UtcNow.ToString('o')+' Windows hook launcher failed'+[Environment]::NewLine))}catch{}};exit 0`;

  return `powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand ${Buffer.from(script, "utf16le").toString("base64")}`;
}
export function hookCommand(
  self,
  source,
  { platform = process.platform, executable = process.execPath } = {},
) {
  if (platform === "win32") {
    const local = prepareWindowsNode(path.dirname(self), executable);
    return windowsHookCommand(self, source, local);
  }
  return `${JSON.stringify(executable)} ${JSON.stringify(self)} hook ${source}`;
}
