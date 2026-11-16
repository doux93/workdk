"use client";
import {
  downloadBackup,
  readRecovery,
  summarizeWorkspace,
} from "../storage/backup";
import React from "react";
import {
  Check,
  Download,
  Upload,
  Folder,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import { type Workspace, removeExampleEntries } from "../workspace";
import type { ConfirmAction } from "../ui-types";
export default function SettingsPage({
  data,
  update,
  notify,
  exportData,
  onImport,
  onManage,
  askConfirm,
  children,
}: {
  data: Workspace;
  update: (f: (old: Workspace) => Workspace) => void;
  notify: (message: string) => void;
  exportData: () => void;
  onImport: () => void;
  onManage: () => void;
  askConfirm: ConfirmAction;
  children?: React.ReactNode;
}) {
  const recovery = readRecovery();
  const summary = summarizeWorkspace(data);
  return (
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
                  "theme-option " + (data.theme === t.id ? "selected" : "")
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
            当前工作台约 {(summary.bytes / 1024).toFixed(0)}{" "}
            KB；文件备份可离线保存。
          </p>
          <p>
            日常编辑自动保存在当前浏览器。换设备可使用下方云端快照或导入文件。备份保留任务关联编号；Agent
            来源记录不在此备份中，需在工作日志页单独导出。
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
            <button className="button" onClick={onImport}>
              <Upload size={16} />
              恢复备份
            </button>
            {recovery && (
              <button
                className="button"
                onClick={() => downloadBackup(recovery.raw, "一隅替换前副本")}
              >
                下载替换前副本
              </button>
            )}
          </div>
        </section>
        {children}
        <section className="panel setting-panel">
          <h2>模块管理</h2>
          <p>调整模块顺序、编辑配置，或隐藏暂时用不到的模块。</p>
          <button className="button" onClick={onManage}>
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
  );
}
