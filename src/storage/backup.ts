import { dateKey, type Workspace } from "../workspace";
export const recoveryKey = "yiyu-workspace-recovery-v1";
export function summarizeWorkspace(workspace: Workspace) {
  return {
    modules: workspace.modules.length,
    records: workspace.modules.reduce((sum, m) => sum + m.entries.length, 0),
    bytes: new TextEncoder().encode(JSON.stringify(workspace)).length,
  };
}
export function saveRecovery(raw: string) {
  localStorage.setItem(
    recoveryKey,
    JSON.stringify({ savedAt: new Date().toISOString(), raw }),
  );
}
export function readRecovery(): { savedAt: string; raw: string } | null {
  try {
    const value = JSON.parse(localStorage.getItem(recoveryKey) || "null");
    return value &&
      typeof value.raw === "string" &&
      typeof value.savedAt === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}
export function downloadBackup(raw: string, prefix = "一隅工作台") {
  const url = URL.createObjectURL(
    new Blob([raw], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${prefix}-${dateKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
