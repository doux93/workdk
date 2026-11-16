"use client";
import React from "react";
import {
  Bot,
  LayoutDashboard,
  LayoutTemplate,
  PanelsTopLeft,
  Plus,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import { type Workspace, type Module } from "../workspace";
import { Icon } from "./shared";
import FocusTimer from "./FocusTimer";
export default function WorkspaceSidebar({
  narrow,
  sidebar,
  data,
  routePath,
  currentId,
  visible,
  navigate,
  openModule,
  onManage,
  notify,
  saveIndicator,
}: {
  narrow: boolean;
  sidebar: boolean;
  data: Workspace;
  routePath: string;
  currentId?: string;
  visible: Module[];
  navigate: (path: string) => void;
  openModule: (module?: Module) => void;
  onManage: () => void;
  notify: (message: string) => void;
  saveIndicator: React.ReactNode;
}) {
  return (
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
          className={"nav-item " + (routePath === "home" ? "active" : "")}
          onClick={() => navigate("home")}
        >
          <LayoutDashboard size={19} />
          我的工作台
          <span className="nav-active-dot" />
        </button>
        <button
          className={"nav-item " + (routePath === "templates" ? "active" : "")}
          onClick={() => navigate("templates")}
        >
          <LayoutTemplate size={19} />
          模板中心<span className="new-tag">NEW</span>
        </button>
        <button
          className={"nav-item " + (routePath === "agents" ? "active" : "")}
          onClick={() => navigate("agents")}
        >
          <Bot size={19} />
          Agent 工作日志
        </button>
        <div className="nav-caption">
          <span>我的模块</span>
          <button
            className="icon-button"
            aria-label="管理模块"
            onClick={onManage}
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>
        {visible.map((m) => (
          <button
            className={"nav-item " + (currentId === m.id ? "active" : "")}
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
        <FocusTimer notify={notify} />
        <button
          className={"nav-item " + (routePath === "settings" ? "active" : "")}
          onClick={() => navigate("settings")}
        >
          <Settings2 size={18} />
          偏好设置
        </button>
        {(!narrow || sidebar) && saveIndicator}
      </div>
    </aside>
  );
}
