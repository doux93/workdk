"use client";
import React, { useEffect, useState } from "react";
import {
  Bot,
  RefreshCw,
  ArrowRight,
  Download,
  FileText,
  Link2,
} from "lucide-react";
import { dateKey, type Module } from "../workspace";
import { Modal } from "./shared";
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
type AgentEvent = {
  id: string;
  kind: string;
  at: string;
  summary: string;
  evidence: string;
  received_at: string;
};
const labels: Record<string, string> = {
  start: "执行中",
  prompt: "执行中",
  stop: "本轮结束 · 待验证",
  error: "发生错误",
  interrupt: "已中断",
  end: "会话关闭 · 待验证",
};
const kinds: Record<string, string> = {
  start: "开始会话",
  prompt: "新一轮工作",
  tool: "工具执行",
  stop: "本轮总结",
  error: "错误报告",
  interrupt: "工作中断",
  end: "会话关闭",
};
const titleOf = (s: AgentSession) =>
  s.title_override ||
  s.summary
    .split("\n")
    .find((x) => x.trim())
    ?.replace(/^#+\s*/, "")
    .slice(0, 100) ||
  "等待工作摘要";
const summaryOf = (s: AgentSession) => s.summary_override || s.summary;
async function api(path: string, options?: RequestInit) {
  const r = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!r.ok)
    throw new Error(
      r.status === 401 || r.status === 403
        ? "请登录工作台后查看工作记录。"
        : r.status === 404
          ? "当前运行环境尚未配置 Agent 服务。"
          : "连接失败，请稍后重试。",
    );
  if (!r.headers.get("content-type")?.includes("application/json"))
    throw new Error("请登录工作台，或检查 Agent 服务是否已开启。");
  return (await r.json()) as {
    sessions: AgentSession[];
    hasMore: boolean;
    devices: { device: string; lastSync: string; count: number }[];
    events: AgentEvent[];
    next: string | null;
  };
}
export function AgentToday({ navigate }: { navigate: (p: string) => void }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    api(
      "/api/agent-sessions?day=" +
        dateKey() +
        "&offsetMinutes=" +
        -new Date().getTimezoneOffset(),
    )
      .then((d) => {
        if (active) setCount(d.sessions.length);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="panel agent-today">
      <span className="agent-logo">
        <Bot size={23} />
      </span>
      <div>
        <b>今日 Agent 工作</b>
        <p>
          {count === null
            ? "连接你的工具，让工作进展自动留下记录。"
            : count === 0
              ? "今天还没有工作记录，接入后会自动出现在这里。"
              : `已有 ${count}${count === 50 ? "＋" : ""} 个工作会话，查看成果与后续事项。`}
        </p>
      </div>
      <button className="button" onClick={() => navigate("agents")}>
        查看工作日志 <ArrowRight size={15} />
      </button>
    </section>
  );
}
export default function AgentJournal({
  modules,
  onAddTask,
  navigate,
}: {
  modules: Module[];
  onAddTask: (moduleId: string, s: AgentSession) => void;
  navigate: (p: string) => void;
}) {
  const [sessions, setSessions] = useState<AgentSession[]>([]),
    [day, setDay] = useState(dateKey()),
    [source, setSource] = useState(""),
    [project, setProject] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [more, setMore] = useState(false),
    [devices, setDevices] = useState<
      { device: string; lastSync: string; count: number }[]
    >([]);
  const [selected, setSelected] = useState<AgentSession | null>(null),
    [events, setEvents] = useState<AgentEvent[]>([]),
    [eventError, setEventError] = useState(""),
    [next, setNext] = useState<string | null>(null);
  const [editing, setEditing] = useState(false),
    [connection, setConnection] = useState(false),
    [taskModule, setTaskModule] = useState(""),
    [taskMessage, setTaskMessage] = useState("");
  const [configError, setConfigError] = useState("");
  const [configBusy, setConfigBusy] = useState(false);
  useEffect(() => {
    if (!editing) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [editing]);
  const [refresh, setRefresh] = useState(0),
    [detailBusy, setDetailBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    const params = new URLSearchParams({
      day,
      source,
      project,
      offsetMinutes: String(-new Date().getTimezoneOffset()),
    });
    api("/api/agent-sessions?" + params)
      .then((d) => {
        if (active) {
          setSessions(d.sessions);
          setMore(d.hasMore);
          setDevices(d.devices);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setSessions([]);
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [day, source, project, refresh]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!selected && !connection && !editing) setRefresh((n) => n + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, [selected, connection, editing]);
  useEffect(() => {
    let active = true;
    setEvents([]);
    setNext(null);
    setEventError("");
    setTaskMessage("");
    if (selected) {
      setDetailBusy(true);
      api("/api/agent-session?id=" + encodeURIComponent(selected.id))
        .then((d) => {
          if (active) {
            setEvents(d.events);
            setNext(d.next);
          }
        })
        .catch((e) => {
          if (active) setEventError(e.message);
        })
        .finally(() => {
          if (active) setDetailBusy(false);
        });
    }
    return () => {
      active = false;
    };
  }, [selected?.id]);
  async function downloadConfig() {
    setConfigError("");
    setConfigBusy(true);
    try {
      const r = await fetch("/api/agent-setup", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const isJson = r.headers
        .get("content-type")
        ?.includes("application/json");
      if (!r.ok) {
        let message = "";
        if (isJson) {
          const body = (await r.json()) as { error?: unknown; code?: unknown };
          if (typeof body.error === "string") message = body.error;
        }
        if (!message)
          message =
            r.status === 404
              ? "当前地址没有采集服务；如果使用本机版，请同时启动采集 API 服务。"
              : r.status === 401
                ? "下载接口未识别到登录状态，请在新窗口登录后重试。"
                : r.status === 403
                  ? "下载请求被拒绝，请在新窗口查看具体原因。"
                  : r.status >= 500
                    ? "连接配置服务暂时不可用，请稍后重试。"
                    : "下载失败，请重试。";
        throw new Error(`HTTP ${r.status} · ${message}`);
      }
      if (!isJson)
        throw new Error(
          "下载请求跳转到了登录页面，请点击“在新窗口下载”完成正常登录后重试。",
        );
      const blob = await r.blob();
      const href = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = href;
      a.download = "workdk-agent.config.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (e) {
      setConfigError(
        e instanceof TypeError
          ? "下载请求未完成，请点击“在新窗口下载”检查登录状态或连接。"
          : (e as Error).message,
      );
    } finally {
      setConfigBusy(false);
    }
  }
  async function loadMore() {
    setBusy(true);
    try {
      const params = new URLSearchParams({
        day,
        source,
        project,
        offset: String(sessions.length),
        offsetMinutes: String(-new Date().getTimezoneOffset()),
      });
      const d = await api("/api/agent-sessions?" + params);
      setSessions((old) => [...old, ...d.sessions]);
      setMore(d.hasMore);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const tasks = modules.filter(
    (m) => !m.hidden && (m.view === "list" || m.view === "board"),
  );
  function exportDay() {
    const body = sessions
      .map(
        (s) =>
          `## ${titleOf(s)}\n项目：${s.project_override || s.project} · ${s.source}\n状态：${labels[s.state] || "待验证"}\n${summaryOf(s)}\n`,
      )
      .join("\n");
    const href = URL.createObjectURL(
      new Blob([`# ${day || "全部日期"} 工作记录\n\n${body}`], {
        type: "text/markdown",
      }),
    );
    const a = document.createElement("a");
    a.href = href;
    a.download = `workdk-daily-${day || "all"}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">WORK, CAPTURED</div>
          <h1>
            Agent 工作日志<span className="title-dot">.</span>
          </h1>
          <p>每次推进，都有迹可循。工作摘要自动记录，执行依据随时可查。</p>
        </div>
        <button className="button primary" onClick={() => setConnection(true)}>
          <Link2 size={16} />
          连接电脑
        </button>
      </div>
      <div className="agent-overview">
        <div className="panel">
          <Bot size={21} />
          <span>当前显示的会话</span>
          <b>
            {sessions.length}
            {more ? "＋" : ""}
          </b>
        </div>
        <div className="panel">
          <RefreshCw size={21} />
          <span>已上报设备</span>
          <b>{devices.length}</b>
        </div>
        <div className="panel">
          <FileText size={21} />
          <span>最近收到记录</span>
          <b className="agent-small">
            {devices[0]
              ? new Date(devices[0].lastSync).toLocaleString()
              : "等待首次连接"}
          </b>
        </div>
      </div>
      <div className="panel agent-toolbar">
        <label>
          日期
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        <label>
          来源
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">所有工具</option>
            <option value="codex">Codex</option>
            <option value="claude">Claude Code</option>
            <option value="workbuddy">WorkBuddy</option>
            <option value="manual">其他记录</option>
          </select>
        </label>
        <label>
          项目
          <input
            placeholder="输入完整项目名"
            value={project}
            onChange={(e) => setProject(e.target.value)}
          />
        </label>
        <button
          className="button"
          onClick={() => setRefresh((n) => n + 1)}
          disabled={busy}
        >
          <RefreshCw size={15} />
          刷新
        </button>
        <button
          className="button"
          disabled={!sessions.length || more}
          onClick={exportDay}
        >
          <Download size={15} />
          导出当前记录
        </button>
      </div>
      {error && (
        <div className="storage-warning" role="alert">
          {error}
        </div>
      )}
      {busy && <p role="status">正在读取工作记录…</p>}
      {!busy && !error && !sessions.length && (
        <section className="panel agent-empty">
          <span className="agent-logo">
            <Bot size={32} />
          </span>
          <h2>让工作进展，自动留下来</h2>
          <p>
            连接电脑上的 Codex 或 Claude
            Code，完成一轮工作后，摘要和执行记录会自动同步到这里。
          </p>
          <button
            className="button primary"
            onClick={() => setConnection(true)}
          >
            开始连接
          </button>
        </section>
      )}
      <div className="agent-journal">
        {sessions.map((s) => (
          <button
            key={s.id}
            className="panel agent-card"
            onClick={() => {
              setSelected(s);
              setEditing(false);
            }}
          >
            <div className="agent-card-meta">
              <span className={"agent-source " + s.source}>
                {s.source === "claude" ? "Claude Code" : s.source}
              </span>
              <span>{s.project_override || s.project}</span>
              <time>
                {new Date(s.updated).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
            <h2>{titleOf(s)}</h2>
            <p>{summaryOf(s).slice(0, 260)}</p>
            <div className="agent-card-footer">
              <span className={"agent-state " + s.state}>
                {labels[s.state] || "待验证"}
              </span>
              <span>
                {s.count} 条来源事件 <ArrowRight size={14} />
              </span>
            </div>
          </button>
        ))}
      </div>
      {more && (
        <button className="button" onClick={loadMore} disabled={busy}>
          加载更多会话
        </button>
      )}
      {connection && (
        <Modal title="连接你的电脑" onClose={() => setConnection(false)}>
          <div className="agent-connect">
            {error && <p role="alert">{error}</p>}
            <p>
              配置一次，之后照常使用
              Agent。电脑端采集器会在后台上传记录，网页关闭时也能同步。
            </p>
            <ol>
              <li>
                <b>下载采集器与连接配置</b>
                <p>连接配置含私有访问凭据，请只保存在自己的电脑上。</p>
                <div className="button-row">
                  <a className="button" href="/workdk-agent.zip" download>
                    下载采集器
                  </a>
                  <button
                    className="button primary"
                    onClick={downloadConfig}
                    disabled={configBusy}
                  >
                    {configBusy ? "正在下载…" : "下载连接配置"}
                  </button>
                </div>
                {configError && (
                  <div>
                    <p role="alert">{configError}</p>
                    <a
                      className="text-button"
                      href="/api/agent-setup"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      在新窗口下载
                    </a>
                    <span> · </span>
                    <a
                      className="text-button"
                      href="/signin-with-chatgpt?return_to=%2F%23agents"
                      target="_top"
                    >
                      重新登录工作台
                    </a>
                  </div>
                )}
              </li>
              <li>
                <b>解压并运行 setup-agent.cmd</b>
                <p>
                  需要 Node.js 22.13
                  或更新版本。按提示选择连接配置和允许采集的项目目录。Windows、WSL
                  应分别配置各自的 Agent 环境。
                </p>
              </li>
              <li>
                <b>检查回调并启动上传</b>
                <p>
                  在 Codex / Claude Code 中检查新回调，运行
                  start-agent.cmd。双击 status-agent.cmd
                  可查看本地待上传数量和错误。
                </p>
              </li>
            </ol>
            <p>
              WorkBuddy 可通过包内 MCP 工具接入，详见
              README。采集器仅上报选定项目的摘要和工具元数据，不读取完整历史对话或文件正文；任务描述和最终回复会经过过滤后上报。
            </p>
            <h3>已上报设备</h3>
            {devices.length ? (
              devices.map((d) => (
                <p key={d.device}>
                  <code>{d.device.slice(0, 8)}</code> · {d.count} 条事件 ·
                  最近同步 {new Date(d.lastSync).toLocaleString()}
                </p>
              ))
            ) : (
              <p>尚未收到设备数据，首次上传后会显示在这里。</p>
            )}
          </div>
        </Modal>
      )}
      {selected && (
        <Modal
          title="工作记录详情"
          onClose={() => {
            if (editing && !window.confirm("放弃尚未保存的修改？")) return;
            setSelected(null);
            setEditing(false);
          }}
        >
          <div className="agent-detail">
            <div className="agent-card-meta">
              <span>
                {selected.source} ·{" "}
                {selected.project_override || selected.project}
              </span>
              <span>{labels[selected.state] || "待验证"}</span>
            </div>
            {editing ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  setDetailBusy(true);
                  try {
                    const patch = {
                      id: selected.id,
                      title: String(f.get("title")),
                      summary: String(f.get("summary")),
                      project: String(f.get("project")),
                    };
                    await api("/api/agent-session", {
                      method: "PATCH",
                      body: JSON.stringify(patch),
                    });
                    const updated = {
                      ...selected,
                      title_override: patch.title,
                      summary_override: patch.summary,
                      project_override: patch.project,
                    };
                    setSelected(updated);
                    setSessions((old) =>
                      old.map((s) => (s.id === updated.id ? updated : s)),
                    );
                    setEditing(false);
                  } catch (e) {
                    setEventError((e as Error).message);
                  } finally {
                    setDetailBusy(false);
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
                  />
                </label>
                <label>
                  项目
                  <input
                    name="project"
                    defaultValue={selected.project_override || selected.project}
                    maxLength={200}
                    required
                  />
                </label>
                <label>
                  工作摘要
                  <textarea
                    name="summary"
                    defaultValue={summaryOf(selected)}
                    maxLength={12000}
                    rows={8}
                  />
                </label>
                <div className="button-row">
                  <button className="button primary" disabled={detailBusy}>
                    保存修正
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      if (window.confirm("放弃尚未保存的修改？"))
                        setEditing(false);
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
                  修正摘要
                </button>
                <div className="agent-task-link">
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
                  <button
                    className="button"
                    disabled={!taskModule}
                    onClick={() => {
                      onAddTask(taskModule, selected);
                      setTaskMessage(
                        "已添加或定位到关联待办，可前往模块继续管理。",
                      );
                    }}
                  >
                    添加待办
                  </button>
                  {taskMessage && (
                    <p role="status">
                      {taskMessage}{" "}
                      <button
                        className="text-button"
                        onClick={() => {
                          setSelected(null);
                          navigate("modules/" + taskModule);
                        }}
                      >
                        前往模块
                      </button>
                    </p>
                  )}
                </div>
              </>
            )}
            <h3>来源记录</h3>
            <p className="agent-note">
              以下为采集到的事件依据。摘要中的成果描述由 Agent
              提供，工具退出结果仅代表该次执行。
            </p>
            {eventError && <p role="alert">{eventError}</p>}
            {detailBusy && <p role="status">正在处理…</p>}
            <ol className="agent-events">
              {events.map((e) => (
                <li key={e.id}>
                  <div>
                    <b>{kinds[e.kind] || e.kind}</b>
                    <time>{new Date(e.at).toLocaleString()}</time>
                  </div>
                  {e.summary && <p>{e.summary}</p>}
                  {e.evidence && <code>{e.evidence}</code>}
                </li>
              ))}
            </ol>
            {next && (
              <button
                className="button"
                disabled={detailBusy}
                onClick={async () => {
                  setDetailBusy(true);
                  try {
                    const d = await api(
                      "/api/agent-session?id=" +
                        encodeURIComponent(selected.id) +
                        "&before=" +
                        encodeURIComponent(next),
                    );
                    setEvents((old) => [...old, ...d.events]);
                    setNext(d.next);
                  } catch (e) {
                    setEventError((e as Error).message);
                  } finally {
                    setDetailBusy(false);
                  }
                }}
              >
                加载更早记录
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
