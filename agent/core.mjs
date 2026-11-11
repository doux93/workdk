export const KINDS = [
  "start",
  "prompt",
  "tool",
  "stop",
  "error",
  "interrupt",
  "end",
];
export function redact(value) {
  return String(value ?? "")
    .replace(/\b(?:sk-[\w-]{12,}|gh[pousr]_[\w]{20,})\b/g, "[已隐藏凭据]")
    .replace(
      /(["']?(?:api[_-]?key|password|passwd|secret|access[_-]?token|authorization)["']?\s*[=:]\s*["']?)(?:Bearer\s+)?[^\s,;"'}]+/gi,
      "$1[已隐藏]",
    )
    .replace(/(https?:\/\/[^\s?#]+)\?[^\s]+/g, "$1?[参数已隐藏]");
}
export function normalizeEvent(input) {
  if (!input || typeof input !== "object") throw new Error("事件必须为对象");
  const out = {};
  for (const name of [
    "id",
    "device",
    "session",
    "source",
    "project",
    "kind",
    "at",
  ]) {
    if (
      typeof input[name] !== "string" ||
      !input[name].trim() ||
      input[name].length > 200
    )
      throw new Error(`无效字段：${name}`);
    out[name] = input[name].trim();
  }
  if (
    !["codex", "claude", "workbuddy", "manual"].includes(out.source) ||
    !KINDS.includes(out.kind)
  )
    throw new Error("不支持的事件类型");
  const date = new Date(out.at);
  if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now() + 300000)
    throw new Error("无效事件时间");
  out.at = date.toISOString();
  for (const key of ["summary", "evidence"]) {
    if (input[key] != null && typeof input[key] !== "string")
      throw new Error(`无效字段：${key}`);
    out[key] = redact(input[key]).slice(0, key === "summary" ? 12000 : 8000);
  }
  return out;
}
export function sessionKey(e) {
  return JSON.stringify([e.device, e.source, e.session, e.project]);
}
export const stateLabels = {
  start: "执行中",
  prompt: "执行中",
  stop: "本轮已结束 · 待验证",
  error: "发生错误",
  interrupt: "已中断",
  end: "会话已关闭 · 待验证",
};
export function safeConfig(config) {
  const url = new URL(config.url);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(url.hostname)
    )
  )
    throw new Error("仅允许 HTTPS 或本机 HTTP");
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("服务地址必须是站点根地址");
  if (
    !config.token ||
    typeof config.token !== "string" ||
    !Array.isArray(config.projects)
  )
    throw new Error("采集配置不完整");
  if (
    config.projects.some(
      (p) =>
        !p ||
        typeof p.path !== "string" ||
        !p.path.trim() ||
        typeof p.name !== "string" ||
        !p.name.trim() ||
        p.name.length > 200,
    )
  )
    throw new Error("项目配置无效");
  return { ...config, url: url.origin };
}
