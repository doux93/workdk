"use client";
import React, { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  LayoutTemplate,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Feather,
} from "lucide-react";
import {
  type Entry,
  type Module,
  type Workspace,
  views,
  colors,
  dateKey,
  safeUrl,
} from "../workspace";
import { Icon, Empty } from "./shared";
export default function HomeDashboard({
  data,
  visible,
  navigate,
  openModule,
  openRecord,
  setStatus,
  onManageModules,
  setCalendarMonth,
  setSelectedDate,
}: {
  data: Workspace;
  visible: Module[];
  navigate: (path: string) => void;
  openModule: (module?: Module) => void;
  openRecord: (
    mid: string,
    entry?: Entry,
    date?: string,
    status?: Entry["status"],
  ) => void;
  setStatus: (mid: string, id: string, status: Entry["status"]) => void;
  onManageModules: () => void;
  setCalendarMonth: (date: Date) => void;
  setSelectedDate: (date: string) => void;
}) {
  const [taskTab, setTaskTab] = useState("active");
  const itemLink = (module: Module, entry: Entry) =>
    navigate(`modules/${module.id}/items/${entry.id}`);
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
          <button className="button" onClick={() => navigate("templates")}>
            <LayoutTemplate size={16} />
            更换模板
          </button>
          <button className="button primary" onClick={() => openModule()}>
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
            当前有 <b>{active.length}</b> 件待办。一步一步，也能走得很远。
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
              <button className="text-button" onClick={() => onManageModules()}>
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
                      {views.find((v) => v.id === m.view)?.name.slice(2)}
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
  );
}
