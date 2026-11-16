"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FileText, PencilLine } from "lucide-react";
import { Modal } from "../shared";
import { type Module, modulePurpose, statusName } from "../../workspace";
import { linkedTasks } from "../../agent/links";
import { getEvents, saveSession } from "../../agent/api";
import {
  kinds,
  labels,
  sourceName,
  summaryOf,
  titleOf,
  type AgentEvent,
  type AgentSession,
} from "../../agent/model";

type Props = {
  session: AgentSession | { id: string };
  modules: Module[];
  onClose: () => void;
  onSaved: () => void;
  onAddTask: (moduleId: string, session: AgentSession) => void;
  navigate: (path: string) => void;
};
export default function AgentSessionDetail({
  session,
  modules,
  onClose,
  onSaved,
  onAddTask,
  navigate,
}: Props) {
  const [selected, setSelected] = useState<AgentSession | null>(
    "source" in session ? session : null,
  );
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true),
    [eventError, setEventError] = useState("");
  const [editing, setEditing] = useState(false),
    [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [taskModule, setTaskModule] = useState(""),
    [taskMessage, setTaskMessage] = useState("");
  const readController = useRef<AbortController | null>(null);
  const saveController = useRef<AbortController | null>(null);
  const loadEvents = useCallback(
    async (before: string | null = null) => {
      readController.current?.abort();
      const controller = new AbortController();
      readController.current = controller;
      setLoading(true);
      setEventError("");
      try {
        const data = await getEvents(session.id, before, controller.signal);
        if (controller.signal.aborted) return;
        if (!before && data.session) setSelected(data.session);
        else if (!before && !("source" in session))
          throw new Error("服务尚未提供会话详情，请更新服务后重试。");
        setEvents((old) => [
          ...new Map(
            [...(before ? old : []), ...data.events].map((e) => [e.id, e]),
          ).values(),
        ]);
        setNext(data.next);
      } catch (error) {
        if (!controller.signal.aborted) setEventError((error as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [session.id],
  );
  useEffect(() => {
    void loadEvents();
    return () => {
      readController.current?.abort();
      saveController.current?.abort();
    };
  }, [loadEvents]);
  useEffect(() => {
    if (!editing) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [editing]);
  const close = () => {
    if (saving) return;
    if (!editing || window.confirm("放弃尚未保存的修改？")) onClose();
  };
  const tasks = modules.filter(
    (m) => !m.hidden && modulePurpose(m) === "tasks",
  );
  const related = linkedTasks(modules, session.id);
  return (
    <Modal
      title="工作记录详情"
      subtitle="核对执行依据，再决定下一步。"
      onClose={close}
    >
      <div className="agent-detail" aria-busy={saving}>
        {selected && (
          <>
            <div className="agent-card-meta">
              <span className="agent-source">
                {sourceName(selected.source)}
              </span>
              <span>{selected.project_override || selected.project}</span>
              <span className={`agent-state ${selected.state}`}>
                {labels[selected.state] || "待验证"}
              </span>
            </div>
            {editing ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (saving) return;
                  const form = new FormData(e.currentTarget);
                  const patch = {
                    id: selected.id,
                    title: String(form.get("title")),
                    summary: String(form.get("summary")),
                    project: String(form.get("project")),
                  };
                  const controller = new AbortController();
                  saveController.current = controller;
                  setSaving(true);
                  setSaveError("");
                  try {
                    await saveSession(patch, controller.signal);
                    if (controller.signal.aborted) return;
                    setSelected((old) =>
                      old
                        ? {
                            ...old,
                            title_override: patch.title,
                            summary_override: patch.summary,
                            project_override: patch.project,
                          }
                        : old,
                    );
                    setEditing(false);
                    onSaved();
                  } catch (error) {
                    if (!controller.signal.aborted)
                      setSaveError((error as Error).message);
                  } finally {
                    if (!controller.signal.aborted) setSaving(false);
                  }
                }}
              >
                <label>
                  标题
                  <input
                    name="title"
                    defaultValue={titleOf(selected)}
                    maxLength={200}
                    required
                    disabled={saving}
                  />
                </label>
                <label>
                  项目
                  <input
                    name="project"
                    defaultValue={selected.project_override || selected.project}
                    maxLength={200}
                    required
                    disabled={saving}
                  />
                </label>
                <label>
                  工作摘要
                  <textarea
                    name="summary"
                    defaultValue={summaryOf(selected)}
                    maxLength={12000}
                    rows={8}
                    disabled={saving}
                  />
                </label>
                {saveError && (
                  <p role="alert" className="agent-error-text">
                    {saveError} 修改仍保留在表单中。
                  </p>
                )}
                <div className="button-row">
                  <button className="button primary" disabled={saving}>
                    {saving ? "正在保存…" : "保存修正"}
                  </button>
                  <button
                    type="button"
                    className="button"
                    disabled={saving}
                    onClick={() => {
                      if (window.confirm("放弃尚未保存的修改？")) {
                        setEditing(false);
                        setSaveError("");
                      }
                    }}
                  >
                    取消
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h2>{titleOf(selected)}</h2>
                <p className="agent-summary">{summaryOf(selected)}</p>
                <button className="button" onClick={() => setEditing(true)}>
                  <PencilLine size={15} />
                  修正摘要
                </button>
                <section className="agent-task-link" aria-label="关联待办">
                  <h3>关联待办</h3>
                  {related.length ? (
                    <ul className="agent-linked-tasks">
                      {related.map(({ module, entry }) => (
                        <li key={module.id + ":" + entry.id}>
                          <button
                            className="text-button"
                            onClick={() => {
                              onClose();
                              navigate(
                                `modules/${module.id}/items/${entry.id}`,
                              );
                            }}
                          >
                            {entry.title}
                          </button>
                          <small>
                            {module.name}
                            {module.hidden ? " · 已隐藏模块" : ""} ·{" "}
                            {statusName[entry.status]}
                          </small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <>
                      {tasks.length ? (
                        <label>
                          添加到待办模块
                          <select
                            value={taskModule}
                            onChange={(e) => setTaskModule(e.target.value)}
                          >
                            <option value="">选择模块</option>
                            {tasks.map((m) => (
                              <option value={m.id} key={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <p>添加时将创建一个待办模块。</p>
                      )}
                      <button
                        className="button"
                        disabled={tasks.length > 0 && !taskModule}
                        onClick={() => {
                          try {
                            onAddTask(taskModule, selected);
                            setTaskMessage(
                              "已加入工作台；待办状态由你决定，不会改写原始会话。",
                            );
                          } catch (error) {
                            setTaskMessage((error as Error).message);
                          }
                        }}
                      >
                        添加待办
                      </button>
                    </>
                  )}
                  {taskMessage && <p role="status">{taskMessage}</p>}
                  <p className="agent-note">
                    关联待办保存在当前浏览器，可随工作台备份恢复；Agent
                    来源记录通过服务读取。
                  </p>
                </section>
              </>
            )}
          </>
        )}
        <div className="agent-evidence-heading">
          <h3>
            <FileText size={17} />
            来源记录
          </h3>
          <span>
            {events.length}
            {next ? "＋" : ""} 条
          </span>
        </div>
        <p className="agent-note">
          摘要由 Agent 提供。工具退出结果只代表该次执行，成果仍需核对。
        </p>
        {eventError && (
          <div className="agent-inline-error" role="alert">
            {eventError}
            <button
              className="text-button"
              onClick={() => void loadEvents(events.length ? next : null)}
            >
              重试来源记录
            </button>
          </div>
        )}
        {loading && <p role="status">正在读取来源记录…</p>}
        {!loading && !eventError && !events.length && (
          <p className="agent-note">暂时没有来源记录。</p>
        )}
        <ol className="agent-events">
          {events.map((e) => (
            <li key={e.id}>
              <div>
                <b>{kinds[e.kind] || e.kind}</b>
                <time dateTime={e.at}>{new Date(e.at).toLocaleString()}</time>
              </div>
              {e.summary && <p>{e.summary}</p>}
              {e.evidence && <code>{e.evidence}</code>}
            </li>
          ))}
        </ol>
        {next && (
          <button
            className="button"
            disabled={loading}
            onClick={() => void loadEvents(next)}
          >
            加载更早记录
          </button>
        )}
      </div>
    </Modal>
  );
}
