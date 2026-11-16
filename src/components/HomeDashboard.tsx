"use client";
import React from "react";
import TodayFocus from "./TodayFocus";
import { useToday } from "../hooks/useToday";
import {
  ArrowUpRight,
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
  modulePurpose,
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
  onQuickCapture,
  agentSummary,
}: {
  onQuickCapture: () => void;
  agentSummary?: React.ReactNode;
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
  const today = useToday();
  const itemLink = (module: Module, entry: Entry) =>
    navigate(`modules/${module.id}/items/${entry.id}`);
  const notes = visible.find((m) => modulePurpose(m) === "notes");
  const links = visible.find((m) => modulePurpose(m) === "links");
  const schedule = visible.find((m) => modulePurpose(m) === "schedule");
  const todayEvents = (schedule?.entries || [])
    .filter((e) => e.date === today && !e.sample)
    .sort((a, b) => a.time.localeCompare(b.time));
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
          <p>先推进今天的事，再把想法和进展留下来。</p>
        </div>
        <div className="heading-actions">
          <button className="button" onClick={onManageModules}>
            <SlidersHorizontal size={16} />
            整理模块
          </button>
          <button className="button primary" onClick={onQuickCapture}>
            <Plus size={17} />
            快速记录
          </button>
        </div>
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-primary">
          <TodayFocus
            modules={visible}
            today={today}
            navigate={navigate}
            setStatus={setStatus}
            onCapture={onQuickCapture}
          />
          {agentSummary}
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
        </div>
      </div>
    </>
  );
}
