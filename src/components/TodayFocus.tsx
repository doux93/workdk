"use client";
import React, { useState } from "react";
import { Check, Plus } from "lucide-react";
import { modulePurpose, type Entry, type Module } from "../workspace";
import { focusItems } from "../workflow";
export default function TodayFocus({
  modules,
  today,
  navigate,
  setStatus,
  onCapture,
}: {
  modules: Module[];
  today: string;
  navigate: (path: string) => void;
  setStatus: (moduleId: string, id: string, status: Entry["status"]) => void;
  onCapture: () => void;
}) {
  const groups = focusItems(modules, today);
  const [tab, setTab] = useState<keyof typeof groups>("today");
  const [limit, setLimit] = useState(5);
  const names = {
    today: "今天",
    overdue: "逾期",
    unscheduled: "未安排",
    done: "已完成",
  };
  const items = groups[tab];
  return (
    <section className="panel tasks-panel daily-focus" aria-label="今日聚焦">
      <div className="panel-heading">
        <div>
          <h2>
            <span className="section-dot" />
            今日聚焦
          </h2>
          <p className="focus-caption">
            汇总所有待办模块 ·{" "}
            {tab === "done"
              ? "计划在今天的已完成事项"
              : "按优先级排列，体验示例不计入"}
          </p>
        </div>
        <button className="text-button" onClick={onCapture}>
          <Plus size={16} />
          记一条
        </button>
      </div>
      <div className="tabs small focus-tabs">
        {(Object.keys(names) as Array<keyof typeof names>).map((key) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            aria-pressed={tab === key}
            onClick={() => {
              setTab(key);
              setLimit(5);
            }}
          >
            {names[key]}
            <span>{groups[key].length}</span>
          </button>
        ))}
      </div>
      <div className="task-rows">
        {items.slice(0, limit).map(({ module, entry }) => (
          <div
            className={
              "focus-row " + (entry.status === "done" ? "completed" : "")
            }
            key={module.id + ":" + entry.id}
          >
            <button
              className="task-check"
              aria-label={`${entry.status === "done" ? "取消完成" : "完成"} ${entry.title}`}
              onClick={() =>
                setStatus(
                  module.id,
                  entry.id,
                  entry.status === "done" ? "todo" : "done",
                )
              }
            >
              {entry.status === "done" && <Check size={13} />}
            </button>
            <button
              className="focus-item"
              onClick={() => navigate(`modules/${module.id}/items/${entry.id}`)}
            >
              <b>{entry.title}</b>
              <small>
                {module.name}
                {tab === "overdue"
                  ? ` · ${entry.date} 已逾期`
                  : entry.time
                    ? ` · ${entry.time}`
                    : ""}
              </small>
            </button>
            {entry.priority !== "普通" && (
              <span
                className={
                  "priority " + (entry.priority === "紧急" ? "urgent" : "")
                }
              >
                {entry.priority}
              </span>
            )}
          </div>
        ))}
      </div>
      {!items.length && (
        <div className="focus-empty">
          <b>
            {tab === "today"
              ? "今天还没有待完成的安排"
              : tab === "overdue"
                ? "没有逾期事项"
                : tab === "done"
                  ? "完成今天的事项后，会显示在这里"
                  : "没有未安排的事项"}
          </b>
          <p>
            {tab === "today"
              ? "记下一件想推进的事，或到“逾期”“未安排”中安排下一步。"
              : "每条记录都会保留在原模块中。"}
          </p>
          {tab === "today" && (
            <button className="button" onClick={onCapture}>
              记下今天的一件事
            </button>
          )}
        </div>
      )}
      {!modules.some((m) => !m.hidden && modulePurpose(m) === "tasks") && (
        <p className="focus-caption">
          已有自建待办？可在模块设置中将用途设为“待办”。
        </p>
      )}
      {items.length > limit && (
        <button
          className="text-button focus-more"
          onClick={() => setLimit((n) => n + 5)}
        >
          再显示 5 条 · 共 {items.length} 条
        </button>
      )}
    </section>
  );
}
