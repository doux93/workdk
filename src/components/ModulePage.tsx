"use client";
import React, { useEffect, useState } from "react";
import { ArrowLeft, Settings2, Plus, Search, CheckCheck } from "lucide-react";
import { type Module, type Entry, type View, views } from "../workspace";
import { Icon, Empty } from "./shared";
import ModuleContent from "./ModuleContent";
import RecordDetail from "./RecordDetail";
import type { ConfirmAction } from "../ui-types";
export default function ModulePage({
  current,
  recordId,
  navigate,
  openModule,
  openRecord,
  changeModule,
  setStatus,
  notify,
  askConfirm,
  saveState,
  calendarMonth,
  setCalendarMonth,
  selectedDate,
  setSelectedDate,
}: {
  current: Module;
  recordId?: string;
  navigate: (path: string) => void;
  openModule: (m?: Module) => void;
  openRecord: (
    mid: string,
    entry?: Entry,
    date?: string,
    status?: Entry["status"],
  ) => void;
  changeModule: (id: string, f: (m: Module) => Module) => void;
  setStatus: (mid: string, id: string, status: Entry["status"]) => void;
  notify: (message: string) => void;
  askConfirm: ConfirmAction;
  saveState: string;
  calendarMonth: Date;
  setCalendarMonth: (date: Date) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}) {
  const detail = current.entries.find((e) => e.id === recordId);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    setQuery("");
    setFilter("all");
  }, [current.id, recordId]);
  const itemLink = (m: Module, e: Entry) =>
    navigate(`modules/${m.id}/items/${e.id}`);
  const templateChange = (view: View) => {
    changeModule(current.id, (m) => ({ ...m, view }));
    notify(`已切换为${views.find((v) => v.id === view)?.name}，内容已保留。`);
  };
  return (
    <>
      <div className="page-heading module-page-heading">
        <div>
          <button className="back-link" onClick={() => navigate("home")}>
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
          <button className="button" onClick={() => openModule(current)}>
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
      {recordId !== undefined ? (
        detail ? (
          <RecordDetail
            current={current}
            detail={detail}
            navigate={navigate}
            openRecord={openRecord}
            setStatus={setStatus}
            notify={notify}
            askConfirm={askConfirm}
            changeModule={changeModule}
          />
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
            setStatus={(id, status) => setStatus(current.id, id, status)}
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
  );
}
