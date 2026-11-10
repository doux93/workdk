"use client";
import React, { useRef, useState } from "react";
import { Check } from "lucide-react";
import {
  type Entry,
  type Module,
  statusName,
  safeUrl,
  isValidDateValue,
  isValidTimeValue,
  validateCustomFieldValues,
} from "../workspace";
import { Modal } from "./shared";
import { useDraftGuard } from "../hooks/useDraftGuard";
import { CustomFieldInput } from "./Fields";
export default function RecordEditor({
  entry,
  module: m,
  onClose,
  onSave,
}: {
  entry: Entry;
  module: Module;
  onClose: () => void;
  onSave: (e: Entry) => void;
}) {
  const existing = m.entries.some((e) => e.id === entry.id);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const requestClose = useDraftGuard(formRef, false, onClose);
  return (
    <Modal
      title={existing ? "编辑内容" : "记录一件新的事"}
      subtitle={m.name + " · 自动关联到当前模块"}
      onClose={requestClose}
      wide
    >
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          const f = new FormData(event.currentTarget);
          const title = String(f.get("title") || "").trim();
          const url = String(f.get("url") || "").trim();
          if (!title) {
            setError("请填写标题。");
            return;
          }
          if (url && !safeUrl(url)) {
            setError("请输入以 https:// 或 http:// 开头的有效网址。");
            return;
          }
          if (
            !isValidDateValue(String(f.get("date") || "")) ||
            !isValidTimeValue(String(f.get("time") || ""))
          ) {
            setError("请填写有效的日期与时间。");
            return;
          }
          const values = { ...entry.values };
          m.fields.forEach(
            (field, i) => (values[field] = String(f.get(`field-${i}`) || "")),
          );
          const fieldError = validateCustomFieldValues(m, values, entry.values);
          if (fieldError) {
            setError(fieldError);
            return;
          }
          onSave({
            ...entry,
            sample: false,
            title,
            description: String(f.get("description") || ""),
            status: f.get("status") as Entry["status"],
            priority: f.get("priority") as Entry["priority"],
            date: String(f.get("date") || ""),
            time: String(f.get("time") || ""),
            url,
            values,
          });
        }}
      >
        <div className="form-body">
          <label>
            标题 <span>*</span>
            <input
              name="title"
              autoFocus
              defaultValue={entry.title}
              required
              maxLength={140}
              placeholder="为这条内容起个名字"
            />
          </label>
          <label>
            正文 / 说明
            <textarea
              name="description"
              defaultValue={entry.description}
              rows={5}
              placeholder="补充细节，记录思路，或写下下一步……"
              maxLength={20000}
            />
          </label>
          <div className="form-grid four">
            <label>
              状态
              <select name="status" defaultValue={entry.status}>
                {Object.entries(statusName).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              优先级
              <select name="priority" defaultValue={entry.priority}>
                {["普通", "重要", "紧急"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              日期
              <input type="date" name="date" defaultValue={entry.date} />
            </label>
            <label>
              时间
              <input type="time" name="time" defaultValue={entry.time} />
            </label>
          </div>
          <label>
            关联网址 <small>可选</small>
            <input
              name="url"
              defaultValue={entry.url}
              placeholder="https://…"
              maxLength={2048}
            />
          </label>
          {m.fields.length > 0 && (
            <>
              <div className="form-divider">
                <span>自定义字段</span>
              </div>
              <div className="form-grid">
                {m.fields.map((f, i) => (
                  <label key={f}>
                    {f}
                    <CustomFieldInput
                      module={m}
                      field={f}
                      name={`field-${i}`}
                      value={entry.values[f] || ""}
                    />
                  </label>
                ))}
              </div>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button className="button" type="button" onClick={requestClose}>
            取消
          </button>
          <button className="button primary" type="submit">
            <Check size={16} />
            保存内容
          </button>
        </div>
      </form>
    </Modal>
  );
}
