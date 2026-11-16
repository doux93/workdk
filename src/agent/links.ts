import {
  type Entry,
  type Module,
  type Workspace,
  dateKey,
} from "../workspace.ts";
import { captureRecord } from "../workflow.ts";
import { type AgentSession, titleOf, summaryOf } from "./model.ts";

export const agentSessionPath = (id: string) =>
  "agents?" + new URLSearchParams({ session: id });
export function linkedSessionId(entry: Entry): string | null {
  if (entry.agentSessionId) return entry.agentSessionId;
  // Old releases appended this exact suffix. Keep existing backups usable.
  return (
    entry.description.match(/\n\nAgent 来源编号：([^\r\n]+)$/)?.[1] || null
  );
}
export const linkedTasks = (modules: Module[], sessionId: string) =>
  modules.flatMap((module) =>
    module.entries
      .filter((entry) => linkedSessionId(entry) === sessionId)
      .map((entry) => ({ module, entry })),
  );
export function addAgentTask(
  workspace: Workspace,
  moduleId: string,
  session: AgentSession,
): Workspace {
  if (linkedTasks(workspace.modules, session.id).length) return workspace;
  const captured = captureRecord(workspace, {
    moduleId,
    purpose: "tasks",
    title: titleOf(session).slice(0, 140),
    description: summaryOf(session),
    date: dateKey(),
    priority: "普通",
  });
  return {
    ...captured.workspace,
    modules: captured.workspace.modules.map((module) =>
      module.id !== captured.moduleId
        ? module
        : {
            ...module,
            entries: module.entries.map((entry) =>
              entry.id === captured.entryId
                ? { ...entry, agentSessionId: session.id }
                : entry,
            ),
          },
    ),
  };
}
