import { labels, summaryOf, titleOf, type AgentSession } from "./model";
export function downloadFile(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
export function exportSessions(sessions: AgentSession[], day: string) {
  const body = sessions
    .map(
      (s) =>
        `## ${titleOf(s)}\n项目：${s.project_override || s.project} · ${s.source}\n状态：${labels[s.state] || "待验证"}\n${summaryOf(s)}\n`,
    )
    .join("\n");
  downloadFile(
    new Blob([`# ${day || "全部日期"} 工作记录\n\n${body}`], {
      type: "text/markdown",
    }),
    `workdk-daily-${day || "all"}.md`,
  );
}
