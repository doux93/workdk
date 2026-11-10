"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Folder,
  Grid2X2,
  GripVertical,
  LayoutDashboard,
  LayoutTemplate,
  Link,
  List,
  Menu,
  MoreHorizontal,
  PanelsTopLeft,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  X,
  CheckSquare2,
  Columns3,
  Feather,
  Palette,
  Maximize2,
  CheckCircle2,
  BookOpen,
  Headphones,
  Mic,
  Languages,
} from "lucide-react";
import {
  type Entry,
  type Module,
  type View,
  type Workspace,
  views,
  colors,
  statusName,
  uid,
  dateKey,
  blankEntry,
  initialWorkspace,
  validateWorkspace,
  safeUrl,
  loadWorkspace,
  removeExampleEntries,
  learningPresets,
  createModuleFromLearningPreset,
  persistWorkspace,
  isValidDateValue,
  isValidTimeValue,
} from "./workspace";
const ICONS: Record<string, typeof Plus> = {
  check: CheckSquare2,
  folder: Folder,
  note: FileText,
  link: Link,
  calendar: CalendarDays,
  list: List,
  board: Columns3,
  grid: Grid2X2,
  bookmark: Bookmark,
  sparkles: Sparkles,
  book: BookOpen,
  headphones: Headphones,
  mic: Mic,
  languages: Languages,
};
function Icon({
  name,
  size = 19,
  ...rest
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const C = ICONS[name] || Grid2X2;
  return <C size={size} strokeWidth={1.7} {...rest} />;
}
const STORE = "yiyu-workspace-v1";
function MiniLayout({ type }: { type: string }) {
  return (
    <div className={"mini-layout " + type}>
      <div className="mini-side">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="mini-main">
        <div className="mini-title" />
        <div className="mini-hero" />
        <div className="mini-blocks">
          <i />
          <i />
          <i />
        </div>
        <div className="mini-lines">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}
function Empty({
  title = "这里还是一张白纸",
  detail = "添加第一条内容，让你的工作从这里开始。",
  action,
}: {
  title?: string;
  detail?: string;
  action?: () => void;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Feather size={27} />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action && (
        <button className="button primary" onClick={action}>
          <Plus size={16} />
          添加内容
        </button>
      )}
    </div>
  );
}
function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    ref.current?.showModal();
    ref.current
      ?.querySelector<HTMLInputElement>(
        'input:not([type="checkbox"]):not([type="hidden"]),textarea',
      )
      ?.focus();
    return () => {
      if (prev?.isConnected) prev.focus();
    };
  }, []);
  return (
    <dialog
      aria-label={title}
      ref={ref}
      className={"dialog " + (wide ? "wide" : "")}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button className="icon-button" aria-label="关闭弹窗" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function useDraftGuard(
  formRef: React.RefObject<HTMLFormElement | null>,
  configurationChanged: boolean,
  onClose: () => void,
) {
  const initialValues = useRef<string | null>(null);
  const snapshot = () =>
    formRef.current
      ? JSON.stringify(Array.from(new FormData(formRef.current).entries()))
      : null;
  useEffect(() => {
    initialValues.current = snapshot();
  }, []);
  const dirty = () =>
    configurationChanged ||
    (initialValues.current !== null && snapshot() !== initialValues.current);
  useEffect(() => {
    const handle = (event: BeforeUnloadEvent) => {
      if (dirty()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handle);
    return () => window.removeEventListener("beforeunload", handle);
  }, [configurationChanged]);
  return () => {
    if (!dirty() || window.confirm("有尚未保存的更改，确定放弃这些更改吗？"))
      onClose();
  };
}

export default function App() {
  const [data, setData] = useState<Workspace | null>(null);
  const [route, setRoute] = useState("home");
  const [toast, setToast] = useState("");
  const [sidebar, setSidebar] = useState(false);
  const [modal, setModal] = useState<
    "module" | "record" | "search" | "manage" | "confirm" | null
  >(null);
  const [narrow, setNarrow] = useState(false);
  const [recoveryRaw, setRecoveryRaw] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const [editModule, setEditModule] = useState<Module | null>(null);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [entryModule, setEntryModule] = useState("tasks");
  const [query, setQuery] = useState("");
  const [globalQuery, setGlobalQuery] = useState("");
  const [storageConflict, setStorageConflict] = useState<{
    raw: string | null;
  } | null>(null);
  const expectedRaw = useRef<string | null>(null);
  const [lastSavedRaw, setLastSavedRaw] = useState<string | null>(null);
  const serializedData = useMemo(
    () => (data ? JSON.stringify(data) : null),
    [data],
  );
  const [filter, setFilter] = useState("all");
  const [taskTab, setTaskTab] = useState("active");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(dateKey());
  const [seconds, setSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerEnd = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: () => void;
  } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      expectedRaw.current = raw;
      const loaded = loadWorkspace(raw);
      setData(loaded.workspace);
      setRecoveryRaw(loaded.recoveryRaw);
    } catch {
      setData(initialWorkspace());
      setSaveError(
        "浏览器存储不可用，当前更改仅保留在本次页面中。请导出备份。",
      );
    }
    const onHash = () => {
      let hash = location.hash.slice(1);
      try {
        hash = decodeURIComponent(hash);
      } catch {
        hash = "not-found";
      }
      setRoute(hash || "home");
      setSidebar(false);
      setFilter("all");
      setQuery("");
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (!data) return;
    document.documentElement.dataset.theme = data.theme;
    if (recoveryRaw !== null || storageConflict !== null) return;
    const result = persistWorkspace(
      {
        getItem: (key) => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value),
      },
      STORE,
      data,
      expectedRaw.current,
    );
    if (result.status === "saved") {
      expectedRaw.current = result.raw;
      setLastSavedRaw(result.raw);
      setSaveError("");
    } else if (result.status === "conflict") {
      setStorageConflict({ raw: result.raw });
    } else {
      setSaveError(
        "自动保存失败，当前更改尚未保存。请导出备份并检查浏览器存储空间。",
      );
    }
  }, [data, recoveryRaw, storageConflict]);
  useEffect(() => {
    const handle = (event: StorageEvent) => {
      if (
        event.storageArea === localStorage &&
        (event.key === STORE || event.key === null) &&
        event.newValue !== expectedRaw.current
      ) {
        setStorageConflict({ raw: event.newValue });
      }
    };
    window.addEventListener("storage", handle);
    return () => window.removeEventListener("storage", handle);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const sync = () => setNarrow(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebar(false);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (document.querySelector("dialog[open]")) return;
        setGlobalQuery("");
        setModal("search");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil((timerEnd.current - Date.now()) / 1000),
      );
      setSeconds(left);
      if (left === 0) {
        setTimerRunning(false);
        notify("专注完成，起身休息一下吧。");
      }
    }, 250);
    return () => clearInterval(interval);
  }, [timerRunning]);
  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3600);
  };
  const navigate = (path: string) => {
    location.hash = path;
    setSidebar(false);
    setQuery("");
    setFilter("all");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const update = (f: (old: Workspace) => Workspace) =>
    setData((old) => (old ? f(old) : old));
  const changeModule = (id: string, f: (m: Module) => Module) =>
    update((d) => ({
      ...d,
      modules: d.modules.map((m) => (m.id === id ? f(m) : m)),
    }));
  const setStatus = (mid: string, id: string, status: Entry["status"]) =>
    changeModule(mid, (m) => ({
      ...m,
      entries: m.entries.map((e) =>
        e.id === id ? { ...e, status, sample: false } : e,
      ),
    }));
  const askConfirm = (
    title: string,
    description: string,
    action: () => void,
  ) => {
    setConfirm({ title, description, action });
    setModal("confirm");
  };
  const openRecord = (
    mid: string,
    entry?: Entry,
    date?: string,
    status: Entry["status"] = "todo",
  ) => {
    setEntryModule(mid);
    setEditEntry(entry || { ...blankEntry(), date: date || dateKey(), status });
    setModal("record");
  };
  const openModule = (module?: Module) => {
    setEditModule(module || null);
    setModal("module");
  };
  const exportRecovery = () => {
    if (recoveryRaw === null) return;
    const url = URL.createObjectURL(
      new Blob([recoveryRaw], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `一隅原始数据-${dateKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportData = () => {
    if (!data) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `一隅工作台-${dateKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("备份已导出，包含模块、模板设置和全部记录。");
  };
  const importData = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      notify("请选择小于 5 MB 的备份文件。");
      return;
    }
    try {
      const value = JSON.parse(await file.text());
      if (!validateWorkspace(value)) throw new Error();
      askConfirm(
        "恢复工作台备份？",
        `将用备份中的 ${value.modules.length} 个模块替换当前工作台。建议先导出当前数据。`,
        () => {
          try {
            expectedRaw.current = localStorage.getItem(STORE);
          } catch {
            expectedRaw.current = null;
          }
          setStorageConflict(null);
          setRecoveryRaw(null);
          setSaveError("");
          setData(value);
          navigate("home");
          notify("备份已恢复。");
        },
      );
    } catch {
      notify("无法读取此备份，请选择一隅工作台导出的 JSON 文件。");
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  };
  const loadLatest = () => {
    try {
      const raw = localStorage.getItem(STORE),
        loaded = loadWorkspace(raw);
      expectedRaw.current = raw;
      setStorageConflict(null);
      setRecoveryRaw(loaded.recoveryRaw);
      setSaveError("");
      setData(loaded.workspace);
      navigate("home");
      notify("已载入浏览器中的最新内容。");
    } catch {
      setSaveError("暂时无法读取浏览器数据，请先导出当前内容。");
    }
  };
  const saveState =
    recoveryRaw !== null || storageConflict !== null || saveError
      ? "未保存"
      : serializedData === lastSavedRaw
        ? "已保存"
        : "保存中";
  if (!data)
    return (
      <div className="loading">
        <div className="brand-mark">
          <PanelsTopLeft size={28} />
        </div>
        <p>正在打开你的一隅…</p>
      </div>
    );
  const visible = data.modules.filter((m) => !m.hidden);
  const parts = route.split("/");
  const current =
    parts[0] === "modules" ? data.modules.find((m) => m.id === parts[1]) : null;
  const detail =
    current && parts[2] === "items"
      ? current.entries.find((e) => e.id === parts[3])
      : null;
  const taskModule =
    visible.find((m) => m.id === "tasks") ||
    visible.find((m) => m.view === "list");
  const taskEntries = taskModule?.entries || [];
  const done = taskEntries.filter((e) => e.status === "done").length;
  const active = taskEntries.filter((e) => e.status !== "done");
  const notes =
    visible.find((m) => m.id === "notes") ||
    visible.find((m) => m.view === "notes");
  const links =
    visible.find((m) => m.id === "links") ||
    visible.find((m) => m.view === "links");
  const schedule =
    visible.find((m) => m.id === "schedule") ||
    visible.find((m) => m.view === "calendar");
  const todayEvents = (schedule?.entries || [])
    .filter((e) => e.date === dateKey())
    .sort((a, b) => a.time.localeCompare(b.time));
  const pageTitle =
    current?.name ||
    { home: data.name, templates: "模板中心", settings: "偏好设置" }[route] ||
    "页面未找到";
  const itemLink = (m: Module, e: Entry) =>
    navigate(`modules/${m.id}/items/${e.id}`);
  const templateChange = (view: View) => {
    if (current) {
      changeModule(current.id, (m) => ({ ...m, view }));
      notify(`已切换为${views.find((v) => v.id === view)?.name}，内容已保留。`);
    }
  };
  const taskRow = (e: Entry, mid: string) => (
    <div
      className={"task-row " + (e.status === "done" ? "completed" : "")}
      key={e.id}
    >
      <button
        className="task-check"
        aria-label={
          e.status === "done" ? `取消完成 ${e.title}` : `完成 ${e.title}`
        }
        onClick={() =>
          setStatus(mid, e.id, e.status === "done" ? "todo" : "done")
        }
      >
        {e.status === "done" && <Check size={13} />}
      </button>
      <button
        className="task-title"
        onClick={() => navigate(`modules/${mid}/items/${e.id}`)}
      >
        {e.title}
      </button>
      {e.priority !== "普通" && (
        <span className={"priority " + (e.priority === "紧急" ? "urgent" : "")}>
          {e.priority}
        </span>
      )}
      <span className={"task-date " + (e.date === dateKey() ? "today" : "")}>
        {e.date === dateKey()
          ? "今天"
          : e.date
            ? e.date.slice(5).replace("-", "月") + "日"
            : ""}
      </span>
      <button
        className="icon-button row-more"
        aria-label={`编辑 ${e.title}`}
        onClick={() => openRecord(mid, e)}
      >
        <MoreHorizontal size={18} />
      </button>
    </div>
  );
  const renderTasks = () => (
    <section className="panel tasks-panel">
      <div className="panel-heading">
        <h2>
          <span className="section-dot" />
          今日聚焦 <span className="count">{active.length}</span>
        </h2>
        <button
          className="text-button"
          onClick={() =>
            taskModule ? navigate(`modules/${taskModule.id}`) : openModule()
          }
        >
          查看全部 <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="tabs small">
        <button
          className={taskTab === "active" ? "active" : ""}
          onClick={() => setTaskTab("active")}
        >
          待完成 <span>{active.length}</span>
        </button>
        <button
          className={taskTab === "done" ? "active" : ""}
          onClick={() => setTaskTab("done")}
        >
          已完成 <span>{done}</span>
        </button>
      </div>
      <div className="task-rows">
        {taskEntries
          .filter((e) =>
            taskTab === "done" ? e.status === "done" : e.status !== "done",
          )
          .slice(0, 5)
          .map((e) => taskRow(e, taskModule!.id))}
        {!taskEntries.some((e) =>
          taskTab === "done" ? e.status === "done" : e.status !== "done",
        ) && (
          <div className="inline-empty">
            {taskTab === "active"
              ? "都完成了，给自己一点休息时间。"
              : "完成的任务会出现在这里。"}
          </div>
        )}
      </div>
      <button
        className="add-task"
        onClick={() => (taskModule ? openRecord(taskModule.id) : openModule())}
      >
        <Plus size={17} />
        添加一件要做的事<span>＋</span>
      </button>
      <div className="task-progress">
        <span>一点点完成，也是一种前进</span>
        <div className="progress-track">
          <i
            style={{
              width: `${taskEntries.length ? (done / taskEntries.length) * 100 : 0}%`,
            }}
          />
        </div>
        <b>
          {done}/{taskEntries.length}
        </b>
      </div>
    </section>
  );
  const renderSchedule = () => (
    <section className="panel agenda-panel">
      <div className="panel-heading">
        <h2>今天的安排</h2>
        <button
          className="icon-button"
          aria-label="打开日程"
          onClick={() =>
            schedule ? navigate(`modules/${schedule.id}`) : openModule()
          }
        >
          <ArrowUpRight size={18} />
        </button>
      </div>
      <div className="week-strip">
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + i);
          return (
            <button
              key={i}
              className={dateKey(d) === dateKey() ? "selected" : ""}
              onClick={() => {
                setCalendarMonth(d);
                setSelectedDate(dateKey(d));
                if (schedule) navigate(`modules/${schedule.id}`);
              }}
            >
              <span>{["一", "二", "三", "四", "五", "六", "日"][i]}</span>
              <b>{d.getDate()}</b>
              <i />
            </button>
          );
        })}
      </div>
      <div className="timeline">
        {todayEvents.slice(0, 3).map((e, i) => (
          <button
            className={"timeline-item " + (e.status === "done" ? "past" : "")}
            key={e.id}
            onClick={() => itemLink(schedule!, e)}
          >
            <span className="timeline-time">{e.time || "全天"}</span>
            <span
              className={
                "timeline-dot tone-" + ["green", "orange", "blue"][i % 3]
              }
            />
            <span>
              <b>{e.title}</b>
              <small>
                {e.status === "done" ? "已完成" : e.description.slice(0, 19)}
              </small>
            </span>
          </button>
        ))}
        {!todayEvents.length && (
          <div className="inline-empty">今天还没有安排，留一点时间给自己。</div>
        )}
      </div>
      <button
        className="schedule-add"
        onClick={() => (schedule ? openRecord(schedule.id) : openModule())}
      >
        <Plus size={15} />
        添加日程
      </button>
    </section>
  );
  const renderLinks = () => (
    <section className="panel links-panel">
      <div className="panel-heading">
        <h2>常用入口</h2>
        <button
          className="icon-button"
          aria-label="管理常用链接"
          onClick={() =>
            links ? navigate(`modules/${links.id}`) : openModule()
          }
        >
          <MoreHorizontal size={19} />
        </button>
      </div>
      <div className="quick-links">
        {links?.entries.slice(0, 4).map((e, i) => (
          <a
            key={e.id}
            href={safeUrl(e.url) || undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(ev) => {
              if (!safeUrl(e.url)) {
                ev.preventDefault();
                itemLink(links, e);
              }
            }}
          >
            <span className={"shortcut-icon tone-" + colors[i % colors.length]}>
              {e.title === "ChatGPT" ? (
                <Sparkles size={20} />
              ) : (
                e.title.charAt(0)
              )}
            </span>
            <span>{e.title}</span>
            <ArrowUpRight size={13} />
          </a>
        ))}
        {!links?.entries.length && (
          <button
            className="text-button"
            onClick={() => (links ? openRecord(links.id) : openModule())}
          >
            添加常用链接 <Plus size={15} />
          </button>
        )}
      </div>
    </section>
  );
  const renderNote = () => (
    <section className="panel note-panel">
      <div className="panel-heading">
        <h2>
          <Feather size={18} />
          随手记
        </h2>
        <button
          className="icon-button"
          aria-label="新增笔记"
          onClick={() => (notes ? openRecord(notes.id) : openModule())}
        >
          <Plus size={18} />
        </button>
      </div>
      {notes?.entries[0] ? (
        <button
          className="note-preview"
          onClick={() => itemLink(notes, notes.entries[0])}
        >
          <span className="tiny-label">留住一个好想法</span>
          <h3>{notes.entries[0].title}</h3>
          <p>{notes.entries[0].description}</p>
          <span className="note-meta">
            {notes.entries[0].date || "未设日期"}
            <ArrowUpRight size={16} />
          </span>
        </button>
      ) : (
        <Empty
          title="灵感，值得被记住"
          detail="写下此刻的想法。"
          action={() => (notes ? openRecord(notes.id) : openModule())}
        />
      )}
    </section>
  );
  return (
    <div className={"app-shell layout-" + data.layout}>
      {sidebar && (
        <button
          className="sidebar-scrim"
          aria-label="关闭侧边栏"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside
        inert={narrow && !sidebar}
        aria-hidden={narrow && !sidebar}
        className={"sidebar " + (sidebar ? "open" : "")}
      >
        <button className="brand" onClick={() => navigate("home")}>
          <span className="brand-mark">
            <PanelsTopLeft size={24} />
          </span>
          <span>
            一隅<small>YOUR EVERYDAY SPACE</small>
          </span>
        </button>
        <div className="workspace-switch">
          <span className="workspace-avatar">我</span>
          <div>
            <b>个人工作空间</b>
            <small>按自己的节奏，开始工作</small>
          </div>
        </div>
        <nav>
          <button
            className={"nav-item " + (route === "home" ? "active" : "")}
            onClick={() => navigate("home")}
          >
            <LayoutDashboard size={19} />
            我的工作台
            <span className="nav-active-dot" />
          </button>
          <button
            className={"nav-item " + (route === "templates" ? "active" : "")}
            onClick={() => navigate("templates")}
          >
            <LayoutTemplate size={19} />
            模板中心<span className="new-tag">NEW</span>
          </button>
          <div className="nav-caption">
            <span>我的模块</span>
            <button
              className="icon-button"
              aria-label="管理模块"
              onClick={() => setModal("manage")}
            >
              <SlidersHorizontal size={14} />
            </button>
          </div>
          {visible.map((m) => (
            <button
              className={"nav-item " + (current?.id === m.id ? "active" : "")}
              key={m.id}
              onClick={() => navigate(`modules/${m.id}`)}
            >
              <Icon name={m.icon} />
              {m.name}
              <span className="nav-count">{m.entries.length}</span>
            </button>
          ))}
          <button className="new-module" onClick={() => openModule()}>
            <Plus size={17} />
            新增模块
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="focus-widget">
            <div>
              <span>
                <span className={"pulse " + (timerRunning ? "running" : "")} />
                专注时刻
              </span>
              <button
                className="icon-button"
                aria-label="重置专注计时"
                onClick={() => {
                  setTimerRunning(false);
                  setSeconds(1500);
                }}
              >
                <RotateCcw size={13} />
              </button>
            </div>
            <div className="focus-controls">
              <b>
                {Math.floor(seconds / 60)
                  .toString()
                  .padStart(2, "0")}
                <em>:</em>
                {(seconds % 60).toString().padStart(2, "0")}
              </b>
              <button
                className="focus-play"
                aria-label={timerRunning ? "暂停专注" : "开始专注"}
                onClick={() => {
                  if (timerRunning) setTimerRunning(false);
                  else {
                    const s = seconds || 1500;
                    setSeconds(s);
                    timerEnd.current = Date.now() + s * 1000;
                    setTimerRunning(true);
                  }
                }}
              >
                {timerRunning ? <Pause size={15} /> : <Play size={15} />}
              </button>
            </div>
            <p>让注意力，回到眼前</p>
          </div>
          <button
            className={"nav-item " + (route === "settings" ? "active" : "")}
            onClick={() => navigate("settings")}
          >
            <Settings2 size={18} />
            偏好设置
          </button>
          <div
            className={
              "local-status " + (saveState === "未保存" ? "unsaved" : "")
            }
            role="status"
          >
            <span />
            {saveState === "已保存"
              ? "已保存到当前浏览器"
              : saveState === "保存中"
                ? "正在保存更改…"
                : "当前更改未保存"}
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={narrow && sidebar}>
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="打开导航"
              aria-expanded={sidebar}
              onClick={() => setSidebar(true)}
            >
              <Menu size={21} />
            </button>
            <span>个人空间</span>
            <ChevronRight size={13} />
            <b>{pageTitle}</b>
          </div>
          <div className="topbar-actions">
            <button
              aria-label="搜索工作空间"
              className="search-trigger"
              onClick={() => {
                setGlobalQuery("");
                setModal("search");
              }}
            >
              <Search size={16} />
              <span>搜索你的工作空间</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="topbar-divider" />
            <button
              className="icon-button"
              aria-label="切换明暗主题"
              onClick={() =>
                update((d) => ({
                  ...d,
                  theme: d.theme === "dark" ? "light" : "dark",
                }))
              }
            >
              <Sun size={19} />
            </button>
            <button
              className="profile-avatar"
              aria-label="打开个人偏好"
              onClick={() => navigate("settings")}
            >
              我
            </button>
          </div>
        </header>
        <main className="main-content">
          {(recoveryRaw !== null || storageConflict !== null || saveError) && (
            <section className="storage-warning" role="alert">
              <div>
                <b>
                  {storageConflict
                    ? "另一个窗口更新了工作台，当前窗口已暂停保存"
                    : recoveryRaw !== null
                      ? "检测到无法读取的数据，自动保存已暂停"
                      : "当前内容尚未保存"}
                </b>
                <p>
                  {storageConflict
                    ? "当前窗口的内容仍然保留。可以先导出当前内容，再载入另一个窗口保存的最新版本。"
                    : recoveryRaw !== null
                      ? "原始数据仍保留在浏览器中。请先下载原始数据，再恢复有效备份；当前显示的体验内容不会覆盖它。"
                      : saveError}
                </p>
              </div>
              <div className="button-row">
                {storageConflict ? (
                  <>
                    <button className="button" onClick={exportData}>
                      <Download size={15} />
                      导出当前内容
                    </button>
                    <button
                      className="button"
                      onClick={() =>
                        askConfirm(
                          "载入最新内容？",
                          "当前窗口中尚未保存的更改将被替换。如需保留，请先导出当前内容。",
                          loadLatest,
                        )
                      }
                    >
                      载入最新内容
                    </button>
                  </>
                ) : recoveryRaw !== null ? (
                  <>
                    <button className="button" onClick={exportRecovery}>
                      <Download size={15} />
                      下载原始数据
                    </button>
                    <button
                      className="button"
                      onClick={() => importInput.current?.click()}
                    >
                      <Upload size={15} />
                      恢复备份
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        askConfirm(
                          "使用当前工作台替换旧数据？",
                          "此操作会覆盖浏览器中无法读取的旧数据。请确认已经下载原始数据以便恢复。",
                          () => {
                            setRecoveryRaw(null);
                            notify("已启用当前工作台的自动保存。");
                          },
                        )
                      }
                    >
                      重新开始
                    </button>
                  </>
                ) : (
                  <button className="button" onClick={exportData}>
                    <Download size={15} />
                    导出备份
                  </button>
                )}
              </div>
            </section>
          )}

          {route === "home" ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span />
                    {new Date().toLocaleDateString("zh-CN", {
                      month: "long",
                      day: "numeric",
                      weekday: "long",
                    })}
                    <span className="eyebrow-divider">/</span>新的日常，新的可能
                  </div>
                  <h1>
                    {data.name}
                    <span className="title-dot">.</span>
                  </h1>
                  <p>收拢工作的碎片，找回自己的节奏。</p>
                </div>
                <div className="heading-actions">
                  <button
                    className="button"
                    onClick={() => navigate("templates")}
                  >
                    <LayoutTemplate size={16} />
                    更换模板
                  </button>
                  <button
                    className="button primary"
                    onClick={() => openModule()}
                  >
                    <Plus size={17} />
                    新增模块
                  </button>
                </div>
              </div>
              <section className="welcome-banner">
                <div className="welcome-content">
                  <span className="tiny-label">
                    A LITTLE SPACE, A LOT OF POSSIBILITIES
                  </span>
                  <h2>把时间，留给重要的事。</h2>
                  <p>
                    当前有 <b>{active.length}</b>{" "}
                    件待办。一步一步，也能走得很远。
                  </p>
                  <button
                    onClick={() => {
                      if (taskModule) {
                        navigate(`modules/${taskModule.id}`);
                      } else openModule();
                    }}
                  >
                    开始今天的工作 <ArrowRight size={16} />
                  </button>
                </div>
                <div className="banner-art" aria-hidden="true">
                  <div className="art-orbit orbit-one" />
                  <div className="art-orbit orbit-two" />
                  <div className="art-orbit orbit-three" />
                  <div className="art-sun" />
                  <div className="art-leaf leaf-one" />
                  <div className="art-leaf leaf-two" />
                  <div className="art-line" />
                  <span className="art-caption">
                    MAKE ROOM
                    <br />
                    FOR WHAT MATTERS.
                  </span>
                </div>
                <div className="banner-stats">
                  <div>
                    <span>待完成</span>
                    <b>
                      {String(active.length).padStart(2, "0")}
                      <small>件</small>
                    </b>
                  </div>
                  <div>
                    <span>我的模块</span>
                    <b>
                      {String(visible.length).padStart(2, "0")}
                      <small>个</small>
                    </b>
                  </div>
                  <div>
                    <span>今日安排</span>
                    <b>
                      {String(todayEvents.length).padStart(2, "0")}
                      <small>项</small>
                    </b>
                  </div>
                </div>
              </section>
              <div className="dashboard-grid">
                <div className="dashboard-primary">
                  {taskModule && renderTasks()}
                  <section className="module-section">
                    <div className="section-heading">
                      <h2>
                        我的模块<span>让工作台，成为你的样子</span>
                      </h2>
                      <button
                        className="text-button"
                        onClick={() => setModal("manage")}
                      >
                        管理模块 <SlidersHorizontal size={14} />
                      </button>
                    </div>
                    <div className="module-grid">
                      {visible.map((m) => (
                        <button
                          className="module-card"
                          key={m.id}
                          onClick={() => navigate(`modules/${m.id}`)}
                        >
                          <div className="module-card-top">
                            <span className={"module-icon tone-" + m.color}>
                              <Icon name={m.icon} size={21} />
                            </span>
                            <ArrowUpRight size={17} />
                          </div>
                          <h3>{m.name}</h3>
                          <p>{m.description}</p>
                          <div className="module-card-bottom">
                            <span>{m.entries.length} 条内容</span>
                            <span>
                              {views
                                .find((v) => v.id === m.view)
                                ?.name.slice(2)}
                            </span>
                          </div>
                        </button>
                      ))}
                      <button
                        className="module-card add-module-card"
                        onClick={() => openModule()}
                      >
                        <span className="add-module-icon">
                          <Plus size={24} />
                        </span>
                        <h3>新的可能</h3>
                        <p>创建一个属于你的模块</p>
                      </button>
                    </div>
                  </section>
                  {links && renderLinks()}
                </div>
                <div className="dashboard-secondary">
                  {schedule && renderSchedule()}
                  {notes && renderNote()}
                  <div className="quiet-quote">
                    <span>“</span>
                    <p>
                      不必把每一分钟填满，
                      <br />
                      专注，也需要留白。
                    </p>
                    <small>A MOMENT FOR YOURSELF</small>
                  </div>
                </div>
              </div>
            </>
          ) : route === "templates" ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">MAKE IT YOURS</div>
                  <h1>
                    换个样子，继续热爱<span className="title-dot">.</span>
                  </h1>
                  <p>布局可以改变，你的内容始终保留。</p>
                </div>
                <div className="button-row">
                  <button
                    className="button"
                    onClick={() =>
                      document
                        .getElementById("english-learning-templates")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                  >
                    <Languages size={16} />
                    英语学习<span className="template-count">4</span>
                  </button>
                  <button className="button" onClick={() => navigate("home")}>
                    <ArrowLeft size={16} />
                    返回工作台
                  </button>
                </div>
              </div>
              <div className="section-heading">
                <h2>
                  首页布局<span>选择适合当下工作节奏的空间</span>
                </h2>
                <span className="subtle-label">3 款可替换模板</span>
              </div>
              <div className="template-grid">
                {[
                  {
                    id: "balanced",
                    name: "从容日常",
                    tag: "均衡 · 概览",
                    desc: "待办、日程与灵感各就其位，轻松掌握每一天。",
                  },
                  {
                    id: "focus",
                    name: "心流时刻",
                    tag: "专注 · 大留白",
                    desc: "让任务成为主角，减少干扰，留出更多思考空间。",
                  },
                  {
                    id: "compact",
                    name: "高效掌控",
                    tag: "紧凑 · 高密度",
                    desc: "在一屏中容纳更多信息，快速切换不同的工作。",
                  },
                ].map((t) => (
                  <article
                    className={
                      "template-card " +
                      (data.layout === t.id ? "selected" : "")
                    }
                    key={t.id}
                  >
                    <div className="template-preview">
                      <MiniLayout type={t.id} />
                      {data.layout === t.id && (
                        <span className="using-badge">
                          <Check size={12} />
                          正在使用
                        </span>
                      )}
                    </div>
                    <div className="template-info">
                      <span className="tiny-label">{t.tag}</span>
                      <h3>{t.name}</h3>
                      <p>{t.desc}</p>
                      <button
                        className={
                          "button " + (data.layout === t.id ? "" : "primary")
                        }
                        onClick={() => {
                          update((d) => ({
                            ...d,
                            layout: t.id as Workspace["layout"],
                          }));
                          notify(`已应用「${t.name}」，返回首页即可查看。`);
                        }}
                      >
                        {data.layout === t.id ? (
                          <>
                            <Check size={15} />
                            当前模板
                          </>
                        ) : (
                          <>
                            应用模板
                            <ArrowUpRight size={15} />
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <section
                id="english-learning-templates"
                className="learning-section"
              >
                <div className="section-heading">
                  <h2>
                    <Languages size={18} />
                    英语学习<span>每天一点，慢慢变成自己的表达</span>
                  </h2>
                  <span className="subtle-label">4 款学习模板</span>
                </div>
                <div className="learning-template-grid">
                  {learningPresets.map((preset) => (
                    <article
                      className={"learning-template-card learning-" + preset.id}
                      key={preset.id}
                    >
                      <div
                        className={"learning-art tone-" + preset.color}
                        aria-hidden="true"
                      >
                        <span className="learning-art-label">
                          {preset.english}
                        </span>
                        {preset.id === "vocabulary" ? (
                          <div className="word-preview">
                            <b>
                              clarify<span>v.</span>
                            </b>
                            <p>澄清 · 讲清楚</p>
                            <small>Could you clarify the deadline?</small>
                          </div>
                        ) : preset.id === "daily-english" ? (
                          <div className="habit-preview">
                            <div>
                              {["M", "T", "W", "T", "F", "S", "S"].map(
                                (day, index) => (
                                  <span key={index}>
                                    <small>{day}</small>
                                    <i
                                      className={
                                        index < 2
                                          ? "checked"
                                          : index === 2
                                            ? "current"
                                            : ""
                                      }
                                    >
                                      {index < 2 ? (
                                        <Check size={15} />
                                      ) : index === 2 ? (
                                        "15′"
                                      ) : (
                                        "·"
                                      )}
                                    </i>
                                  </span>
                                ),
                              )}
                            </div>
                            <p>A little progress, every day.</p>
                          </div>
                        ) : preset.id === "listening-reading" ? (
                          <div className="listening-preview">
                            <span className="listening-play">
                              <Headphones size={24} />
                            </span>
                            <div className="sound-wave">
                              {[
                                13, 25, 36, 20, 44, 32, 17, 29, 42, 23, 14, 31,
                                20, 37, 15,
                              ].map((height, index) => (
                                <i key={index} style={{ height }} />
                              ))}
                            </div>
                            <p>听见表达，也听懂语境。</p>
                          </div>
                        ) : (
                          <div className="speaking-preview">
                            <span>
                              <Mic size={17} />
                              Could you clarify…?
                            </span>
                            <p>Say it in your own words.</p>
                          </div>
                        )}
                      </div>
                      <div className="learning-card-content">
                        <div className="learning-card-title">
                          <h3>
                            <Icon name={preset.icon} size={18} />
                            {preset.name}
                          </h3>
                          <span>
                            {views
                              .find((v) => v.id === preset.view)
                              ?.name.slice(2)}
                            视图
                          </span>
                        </div>
                        <p>{preset.description}</p>
                        <div className="learning-field-tags">
                          {preset.fields.map((field) => (
                            <span key={field}>{field}</span>
                          ))}
                        </div>
                        <div className="learning-card-footer">
                          <small>
                            {preset.examples.length} 条可选示例 · 字段可修改
                          </small>
                          <button
                            className="button"
                            aria-label={"使用" + preset.name + "模板"}
                            onClick={() => {
                              setEditModule({
                                ...createModuleFromLearningPreset(preset.id),
                                id: "",
                              });
                              setModal("module");
                            }}
                          >
                            使用模板
                            <Plus size={15} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              <div className="section-heading spaced">
                <h2>
                  模块页面模板<span>同一份内容，用不同的方式看待</span>
                </h2>
              </div>
              <div className="view-template-grid">
                {views.map((v) => (
                  <button
                    key={v.id}
                    className="view-template-card"
                    onClick={() => {
                      setEditModule({
                        id: "",
                        name: "",
                        description: "",
                        view: v.id,
                        icon:
                          v.id === "list"
                            ? "check"
                            : v.id === "board"
                              ? "folder"
                              : v.id === "notes"
                                ? "note"
                                : v.id === "links"
                                  ? "link"
                                  : "calendar",
                        color: "green",
                        fields: [],
                        hidden: false,
                        entries: [],
                      });
                      setModal("module");
                    }}
                  >
                    <div className="view-demo">
                      <Icon name={v.icon} size={33} />
                      <div>
                        <i />
                        <i />
                        <i />
                      </div>
                    </div>
                    <h3>{v.name}</h3>
                    <p>{v.description}</p>
                    <span>
                      使用此模板创建模块 <Plus size={14} />
                    </span>
                  </button>
                ))}
              </div>
              <div className="info-banner">
                <CheckCheck size={21} />
                <div>
                  <b>自由换模板，内容不搬家</b>
                  <p>
                    已有模块可在页面右上方直接切换视图。标题、正文、自定义字段和状态都会保留。
                  </p>
                </div>
              </div>
            </>
          ) : route === "settings" ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR SPACE, YOUR RULES</div>
                  <h1>
                    舒服，才是好用<span className="title-dot">.</span>
                  </h1>
                  <p>一点小调整，让这里更像你。</p>
                </div>
              </div>
              <div className="settings-grid">
                <section className="panel setting-panel">
                  <h2>空间名称</h2>
                  <p>给每天打开的地方，起一个喜欢的名字。</p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = String(
                        new FormData(e.currentTarget).get("name") || "",
                      ).trim();
                      if (name) {
                        update((d) => ({ ...d, name }));
                        notify("空间名称已更新。");
                      }
                    }}
                  >
                    <div className="input-action">
                      <input
                        key={data.name}
                        name="name"
                        aria-label="空间名称"
                        defaultValue={data.name}
                        maxLength={30}
                        required
                      />
                      <button className="button primary" type="submit">
                        保存
                      </button>
                    </div>
                  </form>
                </section>
                <section className="panel setting-panel">
                  <h2>外观主题</h2>
                  <p>选择适合你心情的色彩。</p>
                  <div className="theme-options">
                    {[
                      { id: "light", name: "晨间青绿" },
                      { id: "sand", name: "午后暖沙" },
                      { id: "dark", name: "静谧深夜" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        aria-pressed={data.theme === t.id}
                        className={
                          "theme-option " +
                          (data.theme === t.id ? "selected" : "")
                        }
                        onClick={() =>
                          update((d) => ({
                            ...d,
                            theme: t.id as Workspace["theme"],
                          }))
                        }
                      >
                        <span className={"theme-swatch " + t.id}>
                          <i />
                          <i />
                          <i />
                          {data.theme === t.id && <Check size={17} />}
                        </span>
                        <b>{t.name}</b>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="panel setting-panel">
                  <h2>数据与备份</h2>
                  <p>
                    内容自动保存在当前浏览器，不会跨设备同步。定期导出备份，可以在其他浏览器中恢复。
                  </p>
                  <div className="backup-summary">
                    <span>
                      <Folder size={19} />
                      <b>{data.modules.length}</b> 个模块
                    </span>
                    <span>
                      <FileText size={19} />
                      <b>
                        {data.modules.reduce((s, m) => s + m.entries.length, 0)}
                      </b>{" "}
                      条记录
                    </span>
                  </div>
                  <div className="button-row">
                    <button className="button primary" onClick={exportData}>
                      <Download size={16} />
                      导出完整备份
                    </button>
                    <button
                      className="button"
                      onClick={() => importInput.current?.click()}
                    >
                      <Upload size={16} />
                      恢复备份
                    </button>
                  </div>
                </section>
                <section className="panel setting-panel">
                  <h2>模块管理</h2>
                  <p>调整模块顺序、编辑配置，或隐藏暂时用不到的模块。</p>
                  <button className="button" onClick={() => setModal("manage")}>
                    <SlidersHorizontal size={16} />
                    管理我的模块
                  </button>
                  <div className="setting-divider" />
                  <h2>示例内容</h2>
                  <p>
                    初次打开时提供了一些示例，方便体验不同模板。清理时会保留你新增或编辑过的内容。
                  </p>
                  <button
                    className="button danger-outline"
                    disabled={!data.example}
                    onClick={() =>
                      askConfirm(
                        "清理未修改的示例内容？",
                        "仅移除初始示例。你新增、编辑或更改过状态的记录，以及模块与主题设置都会保留。",
                        () => {
                          update(removeExampleEntries);
                          notify("未修改的示例已清理，你的内容已保留。");
                        },
                      )
                    }
                  >
                    {data.example ? "清理示例内容" : "示例内容已清理"}
                  </button>
                </section>
              </div>
            </>
          ) : current ? (
            <>
              <div className="page-heading module-page-heading">
                <div>
                  <button
                    className="back-link"
                    onClick={() => navigate("home")}
                  >
                    <ArrowLeft size={14} />
                    我的工作台
                  </button>
                  <h1>
                    <span className={"module-icon large tone-" + current.color}>
                      <Icon name={current.icon} size={27} />
                    </span>
                    {current.name}
                  </h1>
                  <p>{current.description || "你的内容，你的节奏。"}</p>
                </div>
                <div className="heading-actions">
                  <button
                    className="button"
                    onClick={() => openModule(current)}
                  >
                    <Settings2 size={16} />
                    模块设置
                  </button>
                  <button
                    className="button primary"
                    onClick={() => openRecord(current.id)}
                  >
                    <Plus size={17} />
                    新增内容
                  </button>
                </div>
              </div>
              {parts[2] === "items" ? (
                detail ? (
                  <section className="panel detail-panel">
                    <button
                      className="back-link"
                      onClick={() => navigate(`modules/${current.id}`)}
                    >
                      <ArrowLeft size={15} />
                      返回{current.name}
                    </button>
                    <div className="detail-heading">
                      <h2>{detail.title}</h2>
                      <button
                        className="button"
                        onClick={() => openRecord(current.id, detail)}
                      >
                        <Settings2 size={16} />
                        编辑
                      </button>
                    </div>
                    <div className="detail-meta">
                      <span className={"status-badge " + detail.status}>
                        {statusName[detail.status]}
                      </span>
                      <span>
                        <CalendarDays size={15} />
                        {detail.date || "未设日期"} {detail.time}
                      </span>
                      <span className="priority">{detail.priority}</span>
                    </div>
                    {detail.url && (
                      <a
                        className="detail-link"
                        href={safeUrl(detail.url) || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Link size={16} />
                        {detail.url}
                        <ExternalLink size={14} />
                      </a>
                    )}
                    <div className="detail-body">
                      {detail.description ||
                        "还没有正文，点击编辑补充更多内容。"}
                    </div>
                    {current.fields.length > 0 && (
                      <dl className="custom-values">
                        {current.fields.map((f) => (
                          <div key={f}>
                            <dt>{f}</dt>
                            <dd>{detail.values[f] || "—"}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <div className="detail-footer">
                      <button
                        className="button"
                        onClick={() => {
                          setStatus(
                            current.id,
                            detail.id,
                            detail.status === "done" ? "todo" : "done",
                          );
                          notify(
                            detail.status === "done"
                              ? "已标记为待开始。"
                              : "又完成了一件事。",
                          );
                        }}
                      >
                        <CheckCircle2 size={16} />
                        {detail.status === "done" ? "重新开启" : "标记完成"}
                      </button>
                      <button
                        className="text-button danger"
                        onClick={() =>
                          askConfirm(
                            "删除这条记录？",
                            "删除后无法撤销。",
                            () => {
                              changeModule(current.id, (m) => ({
                                ...m,
                                entries: m.entries.filter(
                                  (e) => e.id !== detail.id,
                                ),
                              }));
                              navigate(`modules/${current.id}`);
                              notify("记录已删除。");
                            },
                          )
                        }
                      >
                        <Trash2 size={15} />
                        删除记录
                      </button>
                    </div>
                  </section>
                ) : (
                  <Empty
                    title="这条记录不存在"
                    detail="可能已被删除，请返回模块查看其他内容。"
                  />
                )
              ) : (
                <>
                  <div className="module-toolbar">
                    <div className="view-tabs">
                      {views.map((v) => (
                        <button
                          aria-pressed={current.view === v.id}
                          title={v.description}
                          className={current.view === v.id ? "active" : ""}
                          key={v.id}
                          onClick={() => templateChange(v.id)}
                        >
                          <Icon name={v.icon} size={16} />
                          <span>{v.name.slice(2)}</span>
                        </button>
                      ))}
                    </div>
                    <div className="module-filters">
                      <div className="inline-search">
                        <Search size={15} />
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="搜索此模块…"
                          aria-label="搜索此模块"
                        />
                      </div>
                      <select
                        aria-label="筛选状态"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">全部状态</option>
                        <option value="todo">待开始</option>
                        <option value="doing">进行中</option>
                        <option value="done">已完成</option>
                      </select>
                    </div>
                  </div>
                  <ModuleContent
                    module={current}
                    entries={current.entries.filter(
                      (e) =>
                        (filter === "all" || e.status === filter) &&
                        [
                          e.title,
                          e.description,
                          ...Object.values(e.values),
                        ].some((s) =>
                          s.toLowerCase().includes(query.toLowerCase()),
                        ),
                    )}
                    open={(e) => itemLink(current, e)}
                    edit={(e) => openRecord(current.id, e)}
                    add={(date, status) =>
                      openRecord(current.id, undefined, date, status)
                    }
                    setStatus={(id, status) =>
                      setStatus(current.id, id, status)
                    }
                    taskRow={(e) => taskRow(e, current.id)}
                    month={calendarMonth}
                    setMonth={setCalendarMonth}
                    selected={selectedDate}
                    setSelected={setSelectedDate}
                  />
                  <div className="module-footer">
                    <span>
                      {current.entries.length} 条内容 · {saveState}
                    </span>
                    <span>
                      <CheckCheck size={14} />
                      切换模板不会丢失内容
                    </span>
                  </div>
                </>
              )}
            </>
          ) : (
            <Empty
              title="页面未找到"
              detail="从左侧选择一个模块，继续你的工作。"
            />
          )}
          <footer className="page-footer">
            <span>
              一隅 <span className="footer-separator">/</span>{" "}
              给工作一点秩序，给生活一点余白
            </span>
            {data.example && <span>当前包含体验示例 · 可在设置中清空</span>}
          </footer>
        </main>
      </div>
      <input
        ref={importInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => importData(e.target.files?.[0])}
      />
      {modal === "module" && (
        <ModuleEditor
          module={editModule}
          onClose={() => setModal(null)}
          onSave={(m) => {
            if (editModule?.id) {
              changeModule(m.id, () => m);
              notify("模块已更新，已有内容已保留。");
            } else {
              update((d) => ({
                ...d,
                example: d.example || m.entries.some((e) => e.sample === true),
                modules: [...d.modules, m],
              }));
              navigate(`modules/${m.id}`);
              notify("模块已创建，页面和导航入口已就绪。");
            }
            setModal(null);
          }}
        />
      )}
      {modal === "record" && editEntry && (
        <RecordEditor
          entry={editEntry}
          module={data.modules.find((m) => m.id === entryModule)!}
          onClose={() => setModal(null)}
          onSave={(entry) => {
            changeModule(entryModule, (m) => ({
              ...m,
              entries: m.entries.some((e) => e.id === entry.id)
                ? m.entries.map((e) => (e.id === entry.id ? entry : e))
                : [entry, ...m.entries],
            }));
            setModal(null);
            notify("内容已更新。");
          }}
        />
      )}
      {modal === "search" && (
        <Modal
          title="搜索工作空间"
          subtitle="模块、标题、正文和自定义字段，都能找到。"
          onClose={() => setModal(null)}
          wide
        >
          <div className="search-modal-input">
            <Search size={20} />
            <input
              autoFocus
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder="想找点什么？"
              aria-label="全局搜索"
            />
            <kbd>ESC</kbd>
          </div>
          <div className="search-results">
            {data.modules
              .filter(
                (m) =>
                  !globalQuery ||
                  m.name.toLowerCase().includes(globalQuery.toLowerCase()),
              )
              .map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setModal(null);
                    navigate(`modules/${m.id}`);
                  }}
                >
                  <span className={"module-icon tone-" + m.color}>
                    <Icon name={m.icon} />
                  </span>
                  <span>
                    <b>{m.name}</b>
                    <small>模块 · {m.entries.length} 条内容</small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            {globalQuery &&
              data.modules
                .flatMap((m) =>
                  m.entries
                    .filter((e) =>
                      [e.title, e.description, ...Object.values(e.values)].some(
                        (s) =>
                          s.toLowerCase().includes(globalQuery.toLowerCase()),
                      ),
                    )
                    .map((e) => (
                      <button
                        key={`${m.id}-${e.id}`}
                        onClick={() => {
                          setModal(null);
                          itemLink(m, e);
                        }}
                      >
                        <span className={"module-icon tone-" + m.color}>
                          <FileText size={18} />
                        </span>
                        <span>
                          <b>{e.title}</b>
                          <small>
                            {m.name} ·{" "}
                            {e.description.slice(0, 45) || "查看详情"}
                          </small>
                        </span>
                        <ArrowUpRight size={16} />
                      </button>
                    )),
                )
                .slice(0, 30)}
            {globalQuery &&
              !data.modules.some(
                (m) =>
                  m.name.toLowerCase().includes(globalQuery.toLowerCase()) ||
                  m.entries.some((e) =>
                    [e.title, e.description, ...Object.values(e.values)].some(
                      (s) =>
                        s.toLowerCase().includes(globalQuery.toLowerCase()),
                    ),
                  ),
              ) && <Empty title="暂时没有找到" detail="换一个关键词试试。" />}
          </div>
        </Modal>
      )}
      {modal === "manage" && (
        <Modal
          title="管理我的模块"
          subtitle="按自己的习惯排序，暂时不用的模块可以隐藏。"
          onClose={() => setModal(null)}
          wide
        >
          <div className="manage-list">
            {data.modules.map((m, i) => (
              <div
                className={"manage-row " + (m.hidden ? "is-hidden" : "")}
                key={m.id}
              >
                <span className={"module-icon tone-" + m.color}>
                  <Icon name={m.icon} />
                </span>
                <div className="manage-name">
                  <b>{m.name}</b>
                  <small>
                    {m.entries.length} 条内容 ·{" "}
                    {m.hidden
                      ? "已隐藏"
                      : views.find((v) => v.id === m.view)?.name}
                  </small>
                </div>
                <button
                  className="icon-button"
                  disabled={i === 0}
                  aria-label={`上移 ${m.name}`}
                  onClick={() =>
                    update((d) => {
                      const mods = [...d.modules];
                      [mods[i - 1], mods[i]] = [mods[i], mods[i - 1]];
                      return { ...d, modules: mods };
                    })
                  }
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="icon-button"
                  disabled={i === data.modules.length - 1}
                  aria-label={`下移 ${m.name}`}
                  onClick={() =>
                    update((d) => {
                      const mods = [...d.modules];
                      [mods[i], mods[i + 1]] = [mods[i + 1], mods[i]];
                      return { ...d, modules: mods };
                    })
                  }
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`${m.hidden ? "显示" : "隐藏"} ${m.name}`}
                  onClick={() =>
                    changeModule(m.id, (n) => ({ ...n, hidden: !n.hidden }))
                  }
                >
                  {m.hidden ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
                <button
                  className="icon-button"
                  aria-label={`设置 ${m.name}`}
                  onClick={() => openModule(m)}
                >
                  <Settings2 size={16} />
                </button>
                <button
                  className="icon-button danger"
                  aria-label={`删除模块 ${m.name}`}
                  onClick={() =>
                    askConfirm(
                      `删除「${m.name}」？`,
                      `此模块中的 ${m.entries.length} 条记录也将删除。此操作无法撤销，可先导出备份。`,
                      () => {
                        update((d) => ({
                          ...d,
                          modules: d.modules.filter((n) => n.id !== m.id),
                        }));
                        if (current?.id === m.id) navigate("home");
                        notify("模块已删除。");
                      },
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button className="button" onClick={() => openModule()}>
              <Plus size={16} />
              新增模块
            </button>
            <button className="button primary" onClick={() => setModal(null)}>
              完成
            </button>
          </div>
        </Modal>
      )}
      {modal === "confirm" && confirm && (
        <Modal title={confirm.title} onClose={() => setModal(null)}>
          <p className="confirm-copy">{confirm.description}</p>
          <div className="modal-footer">
            <button className="button" onClick={() => setModal(null)}>
              取消
            </button>
            <button
              className="button primary"
              onClick={() => {
                confirm.action();
                setModal(null);
                setConfirm(null);
              }}
            >
              确认操作
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
function ModuleContent({
  module: m,
  entries,
  open,
  edit,
  add,
  setStatus,
  taskRow,
  month,
  setMonth,
  selected,
  setSelected,
}: {
  module: Module;
  entries: Entry[];
  open: (e: Entry) => void;
  edit: (e: Entry) => void;
  add: (date?: string, status?: Entry["status"]) => void;
  setStatus: (id: string, status: Entry["status"]) => void;
  taskRow: (e: Entry) => React.ReactNode;
  month: Date;
  setMonth: (date: Date) => void;
  selected: string;
  setSelected: (date: string) => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  if (m.view === "calendar") {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const cells = Array.from(
      { length: 42 },
      (_, i) => new Date(month.getFullYear(), month.getMonth(), i - offset + 1),
    );
    const selectedItems = entries.filter((e) => e.date === selected);
    const undated = entries.filter((e) => !e.date);
    return (
      <div className="calendar-layout">
        <section className="panel full-calendar">
          <div className="calendar-header">
            <h2>
              {month.getFullYear()}年 <span>{month.getMonth() + 1}月</span>
            </h2>
            <div className="button-row">
              <button
                className="button small"
                onClick={() => {
                  setMonth(new Date());
                  setSelected(dateKey());
                }}
              >
                今天
              </button>
              <button
                className="icon-button"
                aria-label="上一个月"
                onClick={() => {
                  const d = new Date(
                    month.getFullYear(),
                    month.getMonth() - 1,
                    1,
                  );
                  setMonth(d);
                  setSelected(dateKey(d));
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="下一个月"
                onClick={() => {
                  const d = new Date(
                    month.getFullYear(),
                    month.getMonth() + 1,
                    1,
                  );
                  setMonth(d);
                  setSelected(dateKey(d));
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="calendar-weekdays">
            {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map(
              (d) => (
                <span key={d}>{d}</span>
              ),
            )}
          </div>
          <div className="calendar-cells">
            {cells.map((d) => {
              const key = dateKey(d);
              const items = entries.filter((e) => e.date === key);
              return (
                <button
                  key={key}
                  aria-label={`${key}，${items.length} 条内容`}
                  className={
                    (d.getMonth() !== month.getMonth() ? "outside " : "") +
                    (key === selected ? "selected " : "") +
                    (key === dateKey() ? "today" : "")
                  }
                  onClick={() => setSelected(key)}
                >
                  <b>{d.getDate()}</b>
                  <div>
                    {items.slice(0, 2).map((e) => (
                      <span key={e.id} className={"calendar-event " + e.status}>
                        {e.time && <small>{e.time}</small>}
                        {e.title}
                      </span>
                    ))}
                    {items.length > 2 && (
                      <small className="more-events">
                        +{items.length - 2} 条
                      </small>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
        <section className="panel day-details">
          <div className="panel-heading">
            <h2>{selected.slice(5).replace("-", "月")}日</h2>
            <button
              className="icon-button"
              aria-label="添加当天内容"
              onClick={() => add(selected)}
            >
              <Plus size={18} />
            </button>
          </div>
          {selectedItems.length ? (
            selectedItems
              .sort((a, b) => a.time.localeCompare(b.time))
              .map((e) => (
                <button
                  className="day-event"
                  key={e.id}
                  onClick={() => open(e)}
                >
                  <span>{e.time || "全天"}</span>
                  <b>{e.title}</b>
                  <p>{e.description.slice(0, 60)}</p>
                  <span className={"status-badge " + e.status}>
                    {statusName[e.status]}
                  </span>
                </button>
              ))
          ) : (
            <Empty
              title="留白的一天"
              detail="为这一天添加新的安排。"
              action={() => add(selected)}
            />
          )}{" "}
          {undated.length > 0 && (
            <div className="undated">
              <h3>未设日期 · {undated.length}</h3>
              {undated.map((e) => (
                <button onClick={() => edit(e)} key={e.id}>
                  {e.title}
                  <Plus size={13} />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }
  if (!entries.length)
    return (
      <section className="panel">
        <Empty
          title={m.entries.length ? "没有匹配的内容" : "让这个空间开始生长"}
          detail={
            m.entries.length
              ? "试着调整关键词或状态筛选。"
              : "添加第一条记录，开始建立自己的秩序。"
          }
          action={m.entries.length ? undefined : () => add()}
        />
      </section>
    );
  if (m.view === "board")
    return (
      <div className="board">
        {(["todo", "doing", "done"] as const).map((status) => (
          <section
            className={"board-column " + (dragging ? "droppable" : "")}
            key={status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (entries.some((x) => x.id === id)) setStatus(id, status);
              setDragging(null);
            }}
          >
            <div className="board-heading">
              <h3>
                <span className={"status-dot " + status} />
                {statusName[status]}
                <span>{entries.filter((e) => e.status === status).length}</span>
              </h3>
              <Icon name="board" size={15} />
            </div>
            <div className="board-items">
              {entries
                .filter((e) => e.status === status)
                .map((e) => (
                  <article
                    className={
                      "board-card " + (dragging === e.id ? "dragging" : "")
                    }
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", e.id);
                      setDragging(e.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    key={e.id}
                  >
                    <div className="board-card-top">
                      <span
                        className={
                          "priority " + (e.priority === "紧急" ? "urgent" : "")
                        }
                      >
                        {e.priority}
                      </span>
                      <button
                        className="icon-button"
                        aria-label={`编辑 ${e.title}`}
                        onClick={() => edit(e)}
                      >
                        <MoreHorizontal size={17} />
                      </button>
                    </div>
                    <button className="board-content" onClick={() => open(e)}>
                      <h3>{e.title}</h3>
                      <p>{e.description || "点击查看或补充更多内容"}</p>
                    </button>
                    <div className="board-card-footer">
                      <span>
                        <CalendarDays size={13} />
                        {e.date ? e.date.slice(5) : "未设日期"}
                      </span>
                      <select
                        aria-label={`${e.title}的状态`}
                        value={e.status}
                        onChange={(ev) =>
                          setStatus(e.id, ev.target.value as Entry["status"])
                        }
                      >
                        {Object.entries(statusName).map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}
            </div>
            <button
              className="board-add"
              onClick={() => add(undefined, status)}
            >
              <Plus size={16} />
              新增内容
            </button>
          </section>
        ))}
      </div>
    );
  if (m.view === "notes")
    return (
      <div className="notes-grid">
        {entries.map((e, i) => (
          <button
            key={e.id}
            className={"note-card note-color-" + (i % 4)}
            onClick={() => open(e)}
          >
            <div className="note-card-top">
              <Feather size={19} />
              <ArrowUpRight size={17} />
            </div>
            <h2>{e.title}</h2>
            <p>{e.description || "还没有正文，点击写下更多想法。"}</p>
            <div className="note-card-footer">
              <span>{e.date || "未设日期"}</span>
              <span>{e.description.length} 字</span>
            </div>
          </button>
        ))}
        <button className="note-card new-note" onClick={() => add()}>
          <Plus size={30} />
          <h3>新的想法</h3>
          <p>从这里，写下第一句话。</p>
        </button>
      </div>
    );
  if (m.view === "links")
    return (
      <div className="link-card-grid">
        {entries.map((e, i) => (
          <article className="link-card" key={e.id}>
            <div className="link-card-header">
              <span
                className={"shortcut-icon tone-" + colors[i % colors.length]}
              >
                {e.title.charAt(0)}
              </span>
              <button
                className="icon-button"
                aria-label={`编辑 ${e.title}`}
                onClick={() => edit(e)}
              >
                <MoreHorizontal size={18} />
              </button>
            </div>
            <h3>{e.title}</h3>
            <p>{e.description || "添加说明，方便下次找到。"}</p>
            <div className="link-card-bottom">
              <span>
                {safeUrl(e.url) ? new URL(e.url).hostname : "尚未设置链接"}
              </span>
              {safeUrl(e.url) ? (
                <a
                  href={safeUrl(e.url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-open"
                  aria-label={`打开 ${e.title}`}
                >
                  <ArrowUpRight size={19} />
                </a>
              ) : (
                <button
                  className="link-open"
                  aria-label={`查看 ${e.title}`}
                  onClick={() => open(e)}
                >
                  <ArrowRight size={19} />
                </button>
              )}
            </div>
          </article>
        ))}
        <button className="link-card add-link" onClick={() => add()}>
          <Plus size={25} />
          <h3>添加一个入口</h3>
        </button>
      </div>
    );
  return (
    <section className="panel list-panel">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th className="check-cell" />
              <th>标题</th>
              <th>状态</th>
              <th>优先级</th>
              <th>日期</th>
              {m.fields.map((f) => (
                <th key={f}>{f}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className={e.status === "done" ? "completed" : ""}>
                <td>
                  <button
                    className="task-check"
                    aria-label={`${e.status === "done" ? "取消完成" : "完成"} ${e.title}`}
                    onClick={() =>
                      setStatus(e.id, e.status === "done" ? "todo" : "done")
                    }
                  >
                    {e.status === "done" && <Check size={13} />}
                  </button>
                </td>
                <td>
                  <button className="table-title" onClick={() => open(e)}>
                    {e.title}
                  </button>
                </td>
                <td>
                  <select
                    className={"status-select " + e.status}
                    aria-label={`${e.title}的状态`}
                    value={e.status}
                    onChange={(ev) =>
                      setStatus(e.id, ev.target.value as Entry["status"])
                    }
                  >
                    {Object.entries(statusName).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <span
                    className={
                      "priority " + (e.priority === "紧急" ? "urgent" : "")
                    }
                  >
                    {e.priority}
                  </span>
                </td>
                <td className="date-cell">
                  {e.date || "—"} {e.time}
                </td>
                {m.fields.map((f) => (
                  <td className="field-cell" key={f}>
                    {e.values[f] || "—"}
                  </td>
                ))}
                <td>
                  <button
                    className="icon-button"
                    aria-label={`编辑 ${e.title}`}
                    onClick={() => edit(e)}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="add-task" onClick={() => add()}>
        <Plus size={17} />
        新增内容
      </button>
    </section>
  );
}
function ModuleEditor({
  module: m,
  onClose,
  onSave,
}: {
  module: Module | null;
  onClose: () => void;
  onSave: (m: Module) => void;
}) {
  const [view, setView] = useState<View>(m?.view || "list");
  const [color, setColor] = useState(m?.color || "green");
  const [icon, setIcon] = useState(m?.icon || "check");
  const [includeSamples, setIncludeSamples] = useState(true);
  const hasPresetSamples = !m?.id && !!m?.entries.length;
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const requestClose = useDraftGuard(
    formRef,
    view !== (m?.view || "list") ||
      color !== (m?.color || "green") ||
      icon !== (m?.icon || "check") ||
      !includeSamples,
    onClose,
  );
  return (
    <Modal
      title={m?.id ? "编辑模块" : "为日常，新增一个空间"}
      subtitle={
        m?.id
          ? "更换模板、调整字段，已有内容会继续保留。"
          : m?.name
            ? `已预设「${m.name}」的字段与视图，可自由修改。`
            : "选一个模板，剩下的交给工作台。"
      }
      onClose={requestClose}
      wide
    >
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const name = String(f.get("name") || "").trim();
          if (!name) {
            setError("请填写模块名称，不能只包含空格。");
            return;
          }
          const fields = [
            ...new Set(
              String(f.get("fields") || "")
                .split(/[,，、\n]/)
                .map((s) => s.trim())
                .filter(Boolean),
            ),
          ].slice(0, 12);
          onSave({
            id: m?.id || uid(),
            name,
            description: String(f.get("description") || "").trim(),
            icon,
            color,
            view,
            fields,
            hidden: m?.hidden || false,
            entries:
              hasPresetSamples && !includeSamples ? [] : m?.entries || [],
          });
        }}
      >
        <div className="form-body">
          {hasPresetSamples && (
            <label className="include-samples">
              <input
                type="checkbox"
                checked={includeSamples}
                onChange={(e) => setIncludeSamples(e.target.checked)}
              />
              <span>
                <b>附带 {m!.entries.length} 条学习示例</b>
                <small>帮助你了解怎么记录；取消勾选即可从空白开始。</small>
              </span>
            </label>
          )}
          <div className="form-grid">
            <label>
              模块名称 <span>*</span>
              <input
                autoFocus
                name="name"
                defaultValue={m?.name || ""}
                placeholder="例如：会议记录、阅读清单"
                required
                maxLength={24}
              />
            </label>
            <label>
              一句话描述
              <input
                name="description"
                defaultValue={m?.description || ""}
                placeholder="这个空间，用来做什么？"
                maxLength={70}
              />
            </label>
          </div>
          <label className="form-label">选择页面模板</label>
          <div className="view-choice-grid">
            {views.map((v) => (
              <button
                type="button"
                key={v.id}
                className={"view-choice " + (view === v.id ? "selected" : "")}
                onClick={() => setView(v.id)}
              >
                <Icon name={v.icon} size={23} />
                <b>{v.name.slice(2)}</b>
                {view === v.id && <Check size={12} className="choice-check" />}
              </button>
            ))}
          </div>
          <div className="form-grid">
            <div>
              <label className="form-label">模块图标</label>
              <div className="icon-choices">
                {[
                  "check",
                  "folder",
                  "note",
                  "link",
                  "calendar",
                  "bookmark",
                  "sparkles",
                  "grid",
                  "book",
                  "headphones",
                  "mic",
                  "languages",
                ].map((i) => (
                  <button
                    type="button"
                    className={icon === i ? "selected" : ""}
                    key={i}
                    aria-label={`图标 ${i}`}
                    onClick={() => setIcon(i)}
                  >
                    <Icon name={i} size={19} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="form-label">强调色</label>
              <div className="color-choices">
                {colors.map((c) => (
                  <button
                    type="button"
                    aria-label={`颜色 ${c}`}
                    className={
                      "tone-" + c + " " + (color === c ? "selected" : "")
                    }
                    key={c}
                    onClick={() => setColor(c)}
                  >
                    {color === c && <Check size={17} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label>
            自定义字段 <small>可选</small>
            <input
              name="fields"
              defaultValue={m?.fields.join("，") || ""}
              placeholder="例如：负责人，客户名称，地点"
              maxLength={240}
            />
            <span className="field-hint">
              用逗号分隔，最多 12 个字段。将显示在记录编辑和详情页中。
            </span>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="module-preview">
            <span className={"module-icon tone-" + color}>
              <Icon name={icon} />
            </span>
            <div>
              <b>
                {m?.id
                  ? "更改会同步应用到导航和模块页面"
                  : "保存后，自动创建模块页面与导航入口"}
              </b>
              <small>之后随时可以修改，不影响已有记录。</small>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="button" onClick={requestClose}>
            取消
          </button>
          <button className="button primary" type="submit">
            {m?.id ? "保存更改" : "创建模块"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function RecordEditor({
  entry,
  module: m,
  onClose,
  onSave,
}: {
  entry: Entry;
  module: Module;
  onClose: () => void;
  onSave: (e: Entry) => void;
}) {
  const existing = m.entries.some((e) => e.id === entry.id);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const requestClose = useDraftGuard(formRef, false, onClose);
  return (
    <Modal
      title={existing ? "编辑内容" : "记录一件新的事"}
      subtitle={m.name + " · 自动关联到当前模块"}
      onClose={requestClose}
      wide
    >
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          const f = new FormData(event.currentTarget);
          const title = String(f.get("title") || "").trim();
          const url = String(f.get("url") || "").trim();
          if (!title) {
            setError("请填写标题。");
            return;
          }
          if (url && !safeUrl(url)) {
            setError("请输入以 https:// 或 http:// 开头的有效网址。");
            return;
          }
          if (
            !isValidDateValue(String(f.get("date") || "")) ||
            !isValidTimeValue(String(f.get("time") || ""))
          ) {
            setError("请填写有效的日期与时间。");
            return;
          }
          const values = { ...entry.values };
          m.fields.forEach(
            (field, i) => (values[field] = String(f.get(`field-${i}`) || "")),
          );
          onSave({
            ...entry,
            sample: false,
            title,
            description: String(f.get("description") || ""),
            status: f.get("status") as Entry["status"],
            priority: f.get("priority") as Entry["priority"],
            date: String(f.get("date") || ""),
            time: String(f.get("time") || ""),
            url,
            values,
          });
        }}
      >
        <div className="form-body">
          <label>
            标题 <span>*</span>
            <input
              name="title"
              autoFocus
              defaultValue={entry.title}
              required
              maxLength={140}
              placeholder="为这条内容起个名字"
            />
          </label>
          <label>
            正文 / 说明
            <textarea
              name="description"
              defaultValue={entry.description}
              rows={5}
              placeholder="补充细节，记录思路，或写下下一步……"
              maxLength={20000}
            />
          </label>
          <div className="form-grid four">
            <label>
              状态
              <select name="status" defaultValue={entry.status}>
                {Object.entries(statusName).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              优先级
              <select name="priority" defaultValue={entry.priority}>
                {["普通", "重要", "紧急"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              日期
              <input type="date" name="date" defaultValue={entry.date} />
            </label>
            <label>
              时间
              <input type="time" name="time" defaultValue={entry.time} />
            </label>
          </div>
          <label>
            关联网址 <small>可选</small>
            <input
              name="url"
              defaultValue={entry.url}
              placeholder="https://…"
              maxLength={2048}
            />
          </label>
          {m.fields.length > 0 && (
            <>
              <div className="form-divider">
                <span>自定义字段</span>
              </div>
              <div className="form-grid">
                {m.fields.map((f, i) => (
                  <label key={f}>
                    {f}
                    <input
                      name={`field-${i}`}
                      defaultValue={entry.values[f] || ""}
                      placeholder={`填写${f}`}
                      maxLength={1000}
                    />
                  </label>
                ))}
              </div>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button className="button" type="button" onClick={requestClose}>
            取消
          </button>
          <button className="button primary" type="submit">
            <Check size={16} />
            保存内容
          </button>
        </div>
      </form>
    </Modal>
  );
}
