"use client";
import {
  CheckCircle2,
  ChevronRight,
  Download,
  Menu,
  PanelsTopLeft,
  Plus,
  RotateCcw,
  Search,
  Sun,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { addAgentTask } from "./agent/links";
import AgentJournal, { AgentToday } from "./components/AgentJournal";
import HomeDashboard from "./components/HomeDashboard";
import ModuleEditor from "./components/ModuleEditor";
import ModuleManager from "./components/ModuleManager";
import ModulePage from "./components/ModulePage";
import QuickCapture from "./components/QuickCapture";
import RecordEditor from "./components/RecordEditor";
import SearchDialog from "./components/SearchDialog";
import SettingsPage from "./components/SettingsPage";
import { Empty, Modal } from "./components/shared";
import SnapshotPanel from "./components/SnapshotPanel";
import TemplateCenter from "./components/TemplateCenter";
import WorkspaceSidebar from "./components/WorkspaceSidebar";
import { useWorkspaceStorage } from "./hooks/useWorkspaceStorage";
import { downloadBackup } from "./storage/backup";
import { captureRecord } from "./workflow";
import {
  type Entry,
  type Module,
  type Workspace,
  blankEntry,
  dateKey,
  validateWorkspace,
} from "./workspace";
export default function App() {
  const {
    data,
    setData,
    recoveryRaw,
    saveError,
    storageConflict,
    saveState,
    reload,
    restore,
    retry,
    replaceUnreadable,
  } = useWorkspaceStorage();
  const [route, setRoute] = useState("home");
  const [toast, setToast] = useState("");
  const [sidebar, setSidebar] = useState(false);
  const [modal, setModal] = useState<
    "module" | "record" | "capture" | "search" | "manage" | "confirm" | null
  >(null);
  const [narrow, setNarrow] = useState(false);
  const [editModule, setEditModule] = useState<Module | null>(null);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [entryModule, setEntryModule] = useState("tasks");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(dateKey());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: () => void;
  } | null>(null);
  useEffect(() => {
    const onHash = () => {
      let hash = location.hash.slice(1);
      try {
        const separator = hash.indexOf("?");
        hash =
          separator < 0
            ? decodeURIComponent(hash)
            : decodeURIComponent(hash.slice(0, separator)) +
              hash.slice(separator);
      } catch {
        hash = "not-found";
      }
      setRoute(hash || "home");
      setSidebar(false);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (data) document.documentElement.dataset.theme = data.theme;
  }, [data?.theme]);
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
  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3600);
  };
  const navigate = (path: string) => {
    location.hash = path;
    setSidebar(false);
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
    if (recoveryRaw !== null) downloadBackup(recoveryRaw, "一隅原始数据");
  };
  const exportData = () => {
    if (!data) return;
    downloadBackup(JSON.stringify(data, null, 2));
    notify("备份已导出，包含本机模块与记录；Agent 日志需单独导出。");
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
        `将用备份中的 ${value.modules.length} 个模块替换当前工作台。替换前会保留一份本机恢复副本。`,
        () => {
          try {
            if (restore(value)) {
              navigate("home");
              notify(
                "备份已载入，替换前的副本可在设置中下载；保存状态见页面提示。",
              );
            } else notify("另一窗口更新了数据，请先处理版本冲突。");
          } catch (error) {
            notify((error as Error).message);
          }
        },
      );
    } catch {
      notify("无法读取此备份，请选择一隅工作台导出的 JSON 文件。");
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  };
  const loadLatest = () => {
    if (reload()) {
      navigate("home");
      notify("已载入浏览器中的最新内容。");
    }
  };
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
  const routePath = route.split("?")[0];
  const routeQuery = new URLSearchParams(
    route.includes("?") ? route.slice(route.indexOf("?") + 1) : "",
  );
  const parts = routePath.split("/");
  const current =
    parts[0] === "modules" ? data.modules.find((m) => m.id === parts[1]) : null;
  const pageTitle =
    current?.name ||
    {
      home: data.name,
      templates: "模板中心",
      settings: "偏好设置",
      agents: "Agent 工作日志",
    }[routePath] ||
    "页面未找到";
  const saveIndicator = (
    <div
      className={"local-status " + (saveState === "未保存" ? "unsaved" : "")}
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
      <WorkspaceSidebar
        narrow={narrow}
        sidebar={sidebar}
        data={data}
        routePath={routePath}
        currentId={current?.id}
        visible={visible}
        navigate={navigate}
        openModule={openModule}
        onManage={() => setModal("manage")}
        notify={notify}
        saveIndicator={saveIndicator}
      />
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
              className="button topbar-capture"
              aria-label="打开快速记录"
              onClick={() => setModal("capture")}
            >
              <Plus size={17} />
              <span>快速记录</span>
            </button>
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
        {narrow && !sidebar && (
          <div className="mobile-save-status">{saveIndicator}</div>
        )}
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
                            replaceUnreadable();
                            notify("已启用当前工作台的自动保存。");
                          },
                        )
                      }
                    >
                      重新开始
                    </button>
                  </>
                ) : (
                  <>
                    <button className="button primary" onClick={retry}>
                      <RotateCcw size={15} />
                      重试保存
                    </button>
                    <button className="button" onClick={exportData}>
                      <Download size={15} />
                      导出备份
                    </button>
                  </>
                )}
              </div>
            </section>
          )}

          {routePath === "home" ? (
            <>
              <HomeDashboard
                data={data}
                visible={visible}
                onQuickCapture={() => setModal("capture")}
                onHomeMode={(homeMode) => update((d) => ({ ...d, homeMode }))}
                agentSummary={<AgentToday navigate={navigate} />}
                navigate={navigate}
                openModule={openModule}
                openRecord={openRecord}
                setStatus={setStatus}
                onManageModules={() => setModal("manage")}
                setCalendarMonth={setCalendarMonth}
                setSelectedDate={setSelectedDate}
              />
            </>
          ) : routePath === "agents" ? (
            <AgentJournal
              modules={data.modules}
              navigate={navigate}
              sessionId={routeQuery.get("session") || ""}
              onAddTask={(mid, session) => {
                setData(addAgentTask(data, mid, session));
              }}
            />
          ) : routePath === "templates" ? (
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
          ) : routePath === "settings" ? (
            <SettingsPage
              data={data}
              update={update}
              notify={notify}
              exportData={exportData}
              onImport={() => importInput.current?.click()}
              onManage={() => setModal("manage")}
              askConfirm={askConfirm}
            >
              <SnapshotPanel
                workspace={data}
                canTransfer={saveState === "已保存"}
                onRestore={restore}
                onExport={exportData}
              />
            </SettingsPage>
          ) : current ? (
            <ModulePage
              current={current}
              recordId={parts[2] === "items" ? parts[3] || "" : undefined}
              navigate={navigate}
              openModule={openModule}
              openRecord={openRecord}
              changeModule={changeModule}
              setStatus={setStatus}
              notify={notify}
              askConfirm={askConfirm}
              saveState={saveState}
              calendarMonth={calendarMonth}
              setCalendarMonth={setCalendarMonth}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
            />
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
      {modal === "capture" && (
        <QuickCapture
          modules={data.modules}
          onClose={() => setModal(null)}
          onSave={(input) => {
            const captured = captureRecord(data, input);
            setData(captured.workspace);
            setModal(null);
            notify("已加入工作台，可继续编辑；保存状态见页面提示。");
          }}
        />
      )}
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
        <ModuleManager
          data={data}
          currentId={current?.id}
          navigate={navigate}
          update={update}
          changeModule={changeModule}
          openModule={openModule}
          askConfirm={askConfirm}
          notify={notify}
          onClose={() => setModal(null)}
        />
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
