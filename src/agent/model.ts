export type AgentSession = {
  id: string;
  device: string;
  source: string;
  project: string;
  session: string;
  started: string;
  updated: string;
  count: number;
  state: string;
  summary: string;
  title_override?: string;
  summary_override?: string;
  project_override?: string;
};
export type AgentEvent = {
  id: string;
  kind: string;
  at: string;
  summary: string;
  evidence: string;
  received_at: string;
};
export const labels: Record<string, string> = {
  start: "执行中",
  prompt: "执行中",
  stop: "本轮结束 · 待验证",
  error: "发生错误",
  interrupt: "已中断",
  end: "会话关闭 · 待验证",
};
export const kinds: Record<string, string> = {
  start: "开始会话",
  prompt: "新一轮工作",
  tool: "工具执行",
  stop: "本轮总结",
  error: "错误报告",
  interrupt: "工作中断",
  end: "会话关闭",
};
export const titleOf = (s: AgentSession) =>
  s.title_override ||
  s.summary
    .split("\n")
    .find((x) => x.trim())
    ?.replace(/^#+\s*/, "")
    .slice(0, 100) ||
  "等待工作摘要";
export const summaryOf = (s: AgentSession) => s.summary_override || s.summary;

export type AgentDevice = { device: string; lastSync: string; count: number };
export type SessionPage = {
  sessions: AgentSession[];
  devices: AgentDevice[];
  hasMore: boolean;
};
export type EventPage = {
  events: AgentEvent[];
  next: string | null;
  hasMore: boolean;
};
export type SessionPatch = {
  id: string;
  title: string;
  summary: string;
  project: string;
};
export type JournalFilters = { day: string; source: string; project: string };
export const sourceName = (source: string) =>
  ({
    codex: "Codex",
    claude: "Claude Code",
    workbuddy: "WorkBuddy",
    manual: "手动记录",
  })[source] || source;
