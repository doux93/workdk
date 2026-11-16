"use client";
import React, { useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  CalendarDays,
  Download,
  FileText,
  Filter,
  Link2,
  Monitor,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { dateKey, type Module } from "../workspace";
import { useAgentSessions } from "../hooks/useAgentSessions";
import { exportSessions } from "../agent/download";
import {
  labels,
  sourceName,
  summaryOf,
  titleOf,
  type AgentSession,
  type JournalFilters,
} from "../agent/model";
import { agentSessionPath } from "../agent/links";
import AgentConnection from "./agents/AgentConnection";
import AgentSessionDetail from "./agents/AgentSessionDetail";
import "./agents/agent-journal.css";
export { AgentToday } from "./agents/AgentToday";
export type { AgentSession } from "../agent/model";

export default function AgentJournal({
  modules,
  onAddTask,
  navigate,
  sessionId,
}: {
  sessionId?: string;
  modules: Module[];
  onAddTask: (moduleId: string, session: AgentSession) => void;
  navigate: (path: string) => void;
}) {
  const [filters, setFilters] = useState<JournalFilters>({
    day: dateKey(),
    source: "",
    project: "",
  });
  const [projectDraft, setProjectDraft] = useState("");
  const [selected, setSelected] = useState<AgentSession | null>(null);
  const [connection, setConnection] = useState(false);
  const journal = useAgentSessions(
    filters,
    !!selected || !!sessionId || connection,
  );
  const { sessions, devices, busy, more, error } = journal;
  const change = (patch: Partial<JournalFilters>) =>
    setFilters((old) => ({ ...old, ...patch }));
  const reset = () => {
    setFilters({ day: dateKey(), source: "", project: "" });
    setProjectDraft("");
  };
  const filtered =
    !!filters.source || !!filters.project || filters.day !== dateKey();
  const canExport = sessions.length > 0 && !more && !busy && !error;
  const empty = !busy && !error && !sessions.length;
  const scopedEmpty = empty && (filtered || devices.length > 0);
  return (
    <section className="agent-page" aria-label="Agent 工作日志">
      <div className="page-heading agent-heading">
        <div>
          <div className="eyebrow">WORK, CAPTURED</div>
          <h1>
            Agent 工作日志<span className="title-dot">.</span>
          </h1>
          <p>把每次推进留下来，让下一步更清楚。</p>
        </div>
        <button className="button primary" onClick={() => setConnection(true)}>
          <Link2 size={16} />
          连接电脑
        </button>
      </div>
      <div className="agent-overview">
        <div className="panel agent-overview-main">
          <span className="agent-metric-icon">
            <FileText size={20} />
          </span>
          <span>当前显示的会话</span>
          <b>
            {busy && !sessions.length ? "—" : sessions.length}
            {more ? "＋" : ""}
            <small>
              {filters.day === dateKey()
                ? "今天的工作"
                : filters.day || "全部日期"}
            </small>
          </b>
        </div>
        <div className="panel">
          <span className="agent-metric-icon">
            <Monitor size={20} />
          </span>
          <span>最近上报设备</span>
          <b>
            {devices.length}
            <small>
              这些设备共{" "}
              {devices.reduce((n, d) => n + d.count, 0).toLocaleString()} 条事件
            </small>
          </b>
        </div>
        <div className="panel">
          <span className="agent-metric-icon">
            <Activity size={20} />
          </span>
          <span>最近收到记录</span>
          <b className="agent-small">
            {devices[0]
              ? new Date(devices[0].lastSync).toLocaleString()
              : "等待首次连接"}
            <small>以上传记录为准</small>
          </b>
        </div>
      </div>
      <form
        className="panel agent-filters"
        onSubmit={(e) => {
          e.preventDefault();
          change({ project: projectDraft.trim() });
        }}
      >
        <div className="agent-filter-heading">
          <span>
            <Filter size={15} />
            筛选工作记录
          </span>
          <div className="agent-date-shortcuts">
            <button
              type="button"
              aria-pressed={filters.day === dateKey()}
              onClick={() => change({ day: dateKey() })}
            >
              今天
            </button>
            <button
              type="button"
              aria-pressed={!filters.day}
              onClick={() => change({ day: "" })}
            >
              全部日期
            </button>
          </div>
        </div>
        <div className="agent-toolbar">
          <label>
            日期
            <input
              type="date"
              value={filters.day}
              onChange={(e) => change({ day: e.target.value })}
            />
          </label>
          <label>
            来源
            <select
              value={filters.source}
              onChange={(e) => change({ source: e.target.value })}
            >
              <option value="">所有工具</option>
              <option value="codex">Codex</option>
              <option value="claude">Claude Code</option>
              <option value="workbuddy">WorkBuddy</option>
              <option value="manual">其他记录</option>
            </select>
          </label>
          <label className="agent-project-filter">
            项目
            <input
              placeholder="输入完整项目名"
              value={projectDraft}
              onChange={(e) => setProjectDraft(e.target.value)}
            />
          </label>
          <button className="button" type="submit">
            <Search size={15} />
            筛选
          </button>
          {filtered && (
            <button
              className="text-button agent-reset"
              type="button"
              onClick={reset}
            >
              <X size={14} />
              重置筛选
            </button>
          )}
        </div>
      </form>
      <div className="agent-results-heading">
        <div>
          <h2>
            <CalendarDays size={18} />
            {filters.day === dateKey()
              ? "今天的工作记录"
              : filters.day || "全部工作记录"}
          </h2>
          <p>
            {busy
              ? "正在读取工作记录…"
              : error
                ? "更新未完成"
                : journal.offset > 50
                  ? "已加载多页，可手动刷新最新记录"
                  : "每 30 秒自动刷新"}
            {!busy &&
              journal.updatedAt &&
              ` · 上次更新 ${journal.updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
          </p>
        </div>
        <div className="button-row">
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={journal.refresh}
          >
            <RefreshCw size={15} className={busy ? "agent-spin" : ""} />
            刷新
          </button>
          <button
            className="button"
            disabled={!canExport}
            onClick={() => exportSessions(sessions, filters.day)}
            title={more ? "加载全部会话后即可导出" : undefined}
          >
            <Download size={15} />
            导出当前记录
          </button>
        </div>
      </div>
      {error && (
        <div className="agent-inline-error" role="alert">
          <div>
            <b>暂时无法更新工作记录</b>
            <p>
              {error}
              {sessions.length ? " 当前保留上次读取的内容。" : ""}
            </p>
          </div>
          <button className="button" onClick={journal.refresh}>
            重试
          </button>
        </div>
      )}
      <div className="agent-results" aria-busy={busy}>
        {busy && !sessions.length && (
          <div role="status" className="agent-loading">
            <div className="agent-skeleton" aria-hidden="true" />
            <div className="agent-skeleton" aria-hidden="true" />
            <span>正在读取工作记录…</span>
          </div>
        )}
        {empty && (
          <section className="panel agent-empty">
            <span className="agent-logo">
              {scopedEmpty ? <Search size={30} /> : <Bot size={32} />}
            </span>
            <h2>
              {scopedEmpty ? "这里暂时没有工作记录" : "让工作进展，自动留下来"}
            </h2>
            <p>
              {scopedEmpty
                ? "试试其他日期、工具或项目，已收到的记录会保留。"
                : "连接电脑上的 Codex 或 Claude Code，工作摘要与执行依据会自动汇集到这里。"}
            </p>
            {scopedEmpty ? (
              <button
                className="button"
                onClick={() => {
                  setFilters({ day: "", source: "", project: "" });
                  setProjectDraft("");
                }}
              >
                查看全部记录
              </button>
            ) : (
              <button
                className="button primary"
                onClick={() => setConnection(true)}
              >
                开始连接 <ArrowRight size={15} />
              </button>
            )}
          </section>
        )}
        <div className="agent-journal">
          {sessions.map((s) => (
            <button
              key={s.id}
              className="panel agent-card"
              onClick={() =>
                sessionId === undefined
                  ? setSelected(s)
                  : navigate(agentSessionPath(s.id))
              }
            >
              <div className="agent-card-meta">
                <span className={`agent-source ${s.source}`}>
                  {sourceName(s.source)}
                </span>
                <span className="agent-project-name">
                  {s.project_override || s.project}
                </span>
                <time dateTime={s.updated}>
                  {new Date(s.updated).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <h2>{titleOf(s)}</h2>
              <p>{summaryOf(s).slice(0, 260)}</p>
              <div className="agent-card-footer">
                <span className={`agent-state ${s.state}`}>
                  {labels[s.state] || "待验证"}
                </span>
                <span>
                  {s.count} 条来源事件 <ArrowRight size={14} />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
      {more && (
        <div className="agent-load-more">
          <button className="button" onClick={journal.loadMore} disabled={busy}>
            {journal.loading === "append" ? "正在加载…" : "加载更多会话"}
          </button>
          <p>已显示 {sessions.length} 个会话 · 加载全部后可导出</p>
        </div>
      )}
      {connection && (
        <AgentConnection
          devices={devices}
          onClose={() => setConnection(false)}
        />
      )}
      {(sessionId || selected) && (
        <AgentSessionDetail
          key={sessionId || selected!.id}
          session={sessionId ? { id: sessionId } : selected!}
          modules={modules}
          onClose={() => {
            setSelected(null);
            if (sessionId) navigate("agents");
          }}
          onSaved={journal.refresh}
          onAddTask={onAddTask}
          navigate={navigate}
        />
      )}
    </section>
  );
}
