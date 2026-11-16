"use client";
import React, { useRef, useState } from "react";
import { dateKey, modulePurpose, type Module } from "../workspace";
import { type CaptureInput } from "../workflow";
import { useDraftGuard } from "../hooks/useDraftGuard";
import { Modal } from "./shared";
export default function QuickCapture({
  modules,
  onClose,
  onSave,
}: {
  modules: Module[];
  onClose: () => void;
  onSave: (input: CaptureInput) => void;
}) {
  const [purpose, setPurpose] = useState<CaptureInput["purpose"]>("tasks");
  const [destination, setDestination] = useState("");
  const [error, setError] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const close = useDraftGuard(form, purpose !== "tasks", onClose);
  const candidates = modules.filter(
    (m) => !m.hidden && modulePurpose(m) === purpose,
  );
  const moduleId = candidates.some((m) => m.id === destination)
    ? destination
    : candidates[0]?.id || "";
  return (
    <Modal
      title="快速记录"
      subtitle="先记下来，细节可以稍后补充。"
      onClose={close}
    >
      <form
        ref={form}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          try {
            onSave({
              purpose,
              moduleId,
              title: String(data.get("title") || ""),
              description: String(data.get("description") || ""),
              date: String(data.get("date") || ""),
              priority: String(
                data.get("priority") || "普通",
              ) as CaptureInput["priority"],
            });
          } catch (error) {
            setError((error as Error).message);
          }
        }}
      >
        <div className="form-body quick-capture">
          <div className="tabs small" aria-label="记录用途">
            <button
              type="button"
              aria-pressed={purpose === "tasks"}
              className={purpose === "tasks" ? "active" : ""}
              onClick={() => {
                setPurpose("tasks");
                setDestination("");
              }}
            >
              待办
            </button>
            <button
              type="button"
              aria-pressed={purpose === "notes"}
              className={purpose === "notes" ? "active" : ""}
              onClick={() => {
                setPurpose("notes");
                setDestination("");
              }}
            >
              随手记
            </button>
          </div>
          <label>
            记下什么？
            <input
              autoFocus
              name="title"
              required
              maxLength={140}
              placeholder={
                purpose === "tasks"
                  ? "例如：核对今天的发布结果"
                  : "一个想法、一段收获……"
              }
            />
          </label>
          {candidates.length > 1 ? (
            <label>
              保存到
              <select
                name="destination"
                value={moduleId}
                onChange={(e) => setDestination(e.target.value)}
              >
                {candidates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="capture-destination">
              {candidates.length
                ? `保存到「${candidates[0].name}」`
                : `保存时将创建${purpose === "tasks" ? "待办" : "笔记"}模块`}
            </p>
          )}
          <details>
            <summary>更多选项</summary>
            <div className="form-grid">
              <label>
                {purpose === "tasks" ? "计划日期" : "记录日期"}
                <input type="date" name="date" defaultValue={dateKey()} />
              </label>
              <label>
                优先级
                <select name="priority" defaultValue="普通">
                  {["普通", "重要", "紧急"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              补充说明
              <textarea name="description" rows={3} maxLength={20000} />
            </label>
            <p className="field-hint">
              清空计划日期可放入“未安排”；其他字段可在保存后编辑。
            </p>
          </details>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="button" onClick={close}>
            取消
          </button>
          <button className="button primary" type="submit">
            保存记录
          </button>
        </div>
      </form>
    </Modal>
  );
}
