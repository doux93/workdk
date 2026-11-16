import { type Workspace, validateWorkspace } from "../workspace";
export type Snapshot = {
  revision: number;
  updatedAt: string | null;
  workspace: Workspace | null;
  history: { revision: number; updatedAt: string }[];
};
export class SnapshotError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function request(path: string, options: RequestInit) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new SnapshotError(
      "当前环境尚未开启云端快照，请继续使用文件备份。",
      response.status,
    );
  const value = await response.json();
  if (!response.ok)
    throw new SnapshotError(
      response.status === 401 || response.status === 403
        ? "请以工作台所有者身份登录后重试。"
        : value.error || "云端快照服务暂时不可用。",
      response.status,
    );
  return value;
}
export async function readSnapshot(
  signal: AbortSignal,
  revision?: number,
): Promise<Snapshot> {
  const value = await request(
    "/api/workspace-snapshot" + (revision ? `?revision=${revision}` : ""),
    { signal },
  );
  if (
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    (value.revision === 0
      ? value.workspace !== null
      : !validateWorkspace(value.workspace)) ||
    !Array.isArray(value.history) ||
    !value.history.every(
      (h: { revision: number; updatedAt: string }) =>
        Number.isSafeInteger(h.revision) &&
        h.revision > 0 &&
        typeof h.updatedAt === "string",
    )
  )
    throw new Error("云端快照格式异常，本机内容未改变。");
  return value;
}
export async function writeSnapshot(
  workspace: Workspace,
  baseRevision: number,
  signal: AbortSignal,
): Promise<{ revision: number; updatedAt: string }> {
  const value = await request("/api/workspace-snapshot", {
    method: "PUT",
    body: JSON.stringify({ baseRevision, workspace }),
    signal,
  });
  if (
    !Number.isSafeInteger(value.revision) ||
    value.revision !== baseRevision + 1 ||
    typeof value.updatedAt !== "string"
  )
    throw new Error("未能确认云端保存结果，请重新查看云端版本。");
  return value;
}
