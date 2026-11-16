"use client";
import React from "react";
import {
  ArrowLeft,
  Settings2,
  CalendarDays,
  Bot,
  Link,
  ExternalLink,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { type Module, type Entry, statusName, safeUrl } from "../workspace";
import { linkedSessionId, agentSessionPath } from "../agent/links";
import { FieldValue } from "./Fields";
import type { ConfirmAction } from "../ui-types";
export default function RecordDetail({
  current,
  detail,
  navigate,
  openRecord,
  setStatus,
  notify,
  askConfirm,
  changeModule,
}: {
  current: Module;
  detail: Entry;
  navigate: (path: string) => void;
  openRecord: (mid: string, entry?: Entry) => void;
  setStatus: (mid: string, id: string, status: Entry["status"]) => void;
  notify: (message: string) => void;
  askConfirm: ConfirmAction;
  changeModule: (id: string, f: (m: Module) => Module) => void;
}) {
  return (
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
      {linkedSessionId(detail) && (
        <div className="record-source">
          <div>
            <b>关联的 Agent 工作</b>
            <p>核对来源和执行依据；待办状态由你决定。</p>
          </div>
          <button
            className="button"
            onClick={() => navigate(agentSessionPath(linkedSessionId(detail)!))}
          >
            <Bot size={16} />
            查看来源会话
          </button>
        </div>
      )}
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
        {detail.description || "还没有正文，点击编辑补充更多内容。"}
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
            askConfirm("删除这条记录？", "删除后无法撤销。", () => {
              changeModule(current.id, (m) => ({
                ...m,
                entries: m.entries.filter((e) => e.id !== detail.id),
              }));
              navigate(`modules/${current.id}`);
              notify("记录已删除。");
            })
          }
        >
          <Trash2 size={15} />
          删除记录
        </button>
      </div>
    </section>
  );
}
