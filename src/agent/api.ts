import type {
  EventPage,
  JournalFilters,
  SessionPage,
  SessionPatch,
} from "./model";

export async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  notFoundMessage = "当前运行环境尚未配置 Agent 服务。",
): Promise<T> {
  const r = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!r.ok)
    throw new Error(
      r.status === 401 || r.status === 403
        ? "请登录工作台后查看工作记录。"
        : r.status === 404
          ? notFoundMessage
          : "连接失败，请稍后重试。",
    );
  if (!r.headers.get("content-type")?.includes("application/json"))
    throw new Error("请登录工作台，或检查 Agent 服务是否已开启。");
  return r.json() as Promise<T>;
}
export function sessionQuery(filters: JournalFilters) {
  return new URLSearchParams({
    ...filters,
    project: filters.project.trim(),
    offsetMinutes: String(-new Date().getTimezoneOffset()),
  }).toString();
}
export const getSessions = (
  query: string,
  offset: number,
  signal: AbortSignal,
) =>
  requestJson<SessionPage>(
    `/api/agent-sessions?${query}${offset ? `&offset=${offset}` : ""}`,
    { signal },
  );
export const getEvents = (
  id: string,
  before: string | null,
  signal: AbortSignal,
) =>
  requestJson<EventPage>(
    "/api/agent-session?" +
      new URLSearchParams({ id, ...(before ? { before } : {}) }),
    { signal },
    "无法找到此会话，请检查服务是否已更新，或返回工作日志查看其他记录。",
  );
export const saveSession = (patch: SessionPatch, signal: AbortSignal) =>
  requestJson<{ ok: true }>("/api/agent-session", {
    method: "PATCH",
    body: JSON.stringify(patch),
    signal,
  });
