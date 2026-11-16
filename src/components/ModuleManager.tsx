"use client";
import React from "react";
import {
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Settings2,
  Trash2,
  Plus,
} from "lucide-react";
import { type Workspace, type Module, views } from "../workspace";
import { Icon, Modal } from "./shared";
import type { ConfirmAction } from "../ui-types";
export default function ModuleManager({
  data,
  currentId,
  navigate,
  update,
  changeModule,
  openModule,
  askConfirm,
  notify,
  onClose,
}: {
  data: Workspace;
  currentId?: string;
  navigate: (path: string) => void;
  update: (f: (old: Workspace) => Workspace) => void;
  changeModule: (id: string, f: (m: Module) => Module) => void;
  openModule: (m?: Module) => void;
  askConfirm: ConfirmAction;
  notify: (message: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title="管理我的模块"
      subtitle="按自己的习惯排序，暂时不用的模块可以隐藏。"
      onClose={onClose}
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
                {m.hidden ? "已隐藏" : views.find((v) => v.id === m.view)?.name}
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
                    if (currentId === m.id) navigate("home");
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
        <button className="button primary" onClick={onClose}>
          完成
        </button>
      </div>
    </Modal>
  );
}
