import { createHash } from "node:crypto";
import path from "node:path";
import { normalizeEvent } from "./core.mjs";
export function adaptHook(source, input, config) {
  if (!["codex", "claude", "workbuddy"].includes(source))
    throw new Error("未知来源");
  const cwd = path.resolve(String(input.cwd || "."));
  const project = config.projects.find((p) => {
    const root = path.resolve(p.path);
    const relative = path.relative(root, cwd);
    return (
      relative === "" ||
      (!relative.startsWith(".." + path.sep) &&
        relative !== ".." &&
        !path.isAbsolute(relative))
    );
  });
  if (!project) return null;
  const mapping = {
    SessionStart: "start",
    UserPromptSubmit: "prompt",
    PostToolUse: "tool",
    PostToolUseFailure: "error",
    Stop: "stop",
    StopFailure: "error",
    Interrupt: "interrupt",
    SessionEnd: "end",
  };
  const kind = mapping[input.hook_event_name];
  if (!kind || !input.session_id) return null;
  let summary = kind === "prompt" ? input.prompt : input.last_assistant_message;
  let evidence = "";
  if (kind === "tool") {
    const tool = String(input.tool_name || "tool");
    const data = input.tool_input || {};
    const result = input.tool_response || {};
    // Only bounded metadata is collected, never file content, shell commands or complete tool output.
    const file = data.file_path || data.path || result.filePath;
    const exit = result.exit_code ?? result.exitCode;
    evidence =
      tool +
      (file ? " · " + path.basename(String(file)) : "") +
      (Number.isFinite(exit) ? " · exit " + exit : "");
    summary = "";
  }
  if (kind === "error")
    summary = summary || input.error || "工具或会话报告错误，请查看原会话";
  const at =
    input.timestamp && Number.isFinite(Date.parse(input.timestamp))
      ? new Date(input.timestamp).toISOString()
      : new Date().toISOString();
  const identity = [
    config.device,
    source,
    input.session_id,
    input.turn_id || input.prompt_id || "",
    input.hook_event_name,
    input.tool_use_id || "",
    summary || "",
    evidence,
  ];
  // Stable across retries of the same callback. A new prompt/turn/tool ID distinguishes subsequent work.
  if (!input.turn_id && !input.prompt_id && !input.tool_use_id)
    identity.push(input.timestamp || at);
  const id = createHash("sha256")
    .update(JSON.stringify(identity))
    .digest("hex");
  return normalizeEvent({
    id,
    device: config.device,
    session: String(input.session_id),
    source,
    project: project.name,
    kind,
    at,
    summary: String(summary || ""),
    evidence,
  });
}
