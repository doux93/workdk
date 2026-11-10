"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Folder,
  LayoutDashboard,
  LayoutTemplate,
  Link,
  Menu,
  PanelsTopLeft,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  Sun,
  Trash2,
  Upload,
  CheckCircle2,
} from "lucide-react";
import {
  type Entry,
  type Module,
  type View,
  type Workspace,
  views,
  statusName,
  dateKey,
  blankEntry,
  initialWorkspace,
  validateWorkspace,
  safeUrl,
  loadWorkspace,
  removeExampleEntries,
  persistWorkspace,
} from "./workspace";
import { Icon, Empty, Modal } from "./components/shared";
import HomeDashboard from "./components/HomeDashboard";
import TemplateCenter from "./components/TemplateCenter";
import ModuleContent from "./components/ModuleContent";
import ModuleEditor from "./components/ModuleEditor";
import RecordEditor from "./components/RecordEditor";
import SearchDialog from "./components/SearchDialog";
import { FieldValue } from "./components/Fields";
const STORE = "yiyu-workspace-v1";
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
            aria-label="数据保存状态"
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
            <HomeDashboard
              data={data}
              visible={visible}
              navigate={navigate}
              openModule={openModule}
              openRecord={openRecord}
              setStatus={setStatus}
              onManageModules={() => setModal("manage")}
              setCalendarMonth={setCalendarMonth}
              setSelectedDate={setSelectedDate}
            />
          ) : route === "templates" ? (
            <TemplateCenter
              data={data}
              navigate={navigate}
              onLayoutChange={(layout, name) => {
                update((d) => ({ ...d, layout }));
                notify(`已应用「${name}」，返回首页即可查看。`);
              }}
              onCreate={(module) => {
                setEditModule(module);
                setModal("module");
              }}
            />
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
                            <dd>
                              <FieldValue
                                module={current}
                                field={f}
                                value={detail.values[f]}
                              />
                            </dd>
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
                    entries={current.entries}
                    query={query}
                    filter={filter}
                    open={(e) => itemLink(current, e)}
                    edit={(e) => openRecord(current.id, e)}
                    add={(date, status) =>
                      openRecord(current.id, undefined, date, status)
                    }
                    setStatus={(id, status) =>
                      setStatus(current.id, id, status)
                    }
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
        <SearchDialog
          modules={data.modules}
          onClose={() => setModal(null)}
          navigate={navigate}
        />
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
