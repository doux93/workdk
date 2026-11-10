"use client";
import React, { useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import {
  type Module,
  type View,
  views,
  colors,
  uid,
  type FieldConfig,
  type FieldType,
  getFieldDefinition,
  fieldTypeLabels,
  validateFieldConfig,
} from "../workspace";
import { Icon, Modal } from "./shared";
import { useDraftGuard } from "../hooks/useDraftGuard";
export default function ModuleEditor({
  module: m,
  onClose,
  onSave,
}: {
  module: Module | null;
  onClose: () => void;
  onSave: (m: Module) => void;
}) {
  const [view, setView] = useState<View>(m?.view || "list");
  const [color, setColor] = useState(m?.color || "green");
  const [icon, setIcon] = useState(m?.icon || "check");
  const [includeSamples, setIncludeSamples] = useState(true);
  const hasPresetSamples = !m?.id && !!m?.entries.length;
  const [fieldsText, setFieldsText] = useState(m?.fields.join("，") || "");
  const [fieldConfig, setFieldConfig] = useState<FieldConfig>(
    m?.fieldConfig || {},
  );
  const [optionTexts, setOptionTexts] = useState<Record<string, string>>({});
  const currentFields = [
    ...new Set(
      fieldsText
        .split(/[,，、\n]/)
        .map((field) => field.trim())
        .filter(Boolean),
    ),
  ].slice(0, 12);
  const updateField = (field: string, type: FieldType) => {
    const previous = getFieldDefinition({ fieldConfig }, field);
    const next =
      type === previous.type
        ? previous
        : type === "select"
          ? { type, options: ["选项一", "选项二"] }
          : { type };
    setOptionTexts((values) => {
      const next = { ...values };
      delete next[field];
      return next;
    });
    setFieldConfig((config) => ({ ...config, [field]: next }));
  };
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const requestClose = useDraftGuard(
    formRef,
    view !== (m?.view || "list") ||
      color !== (m?.color || "green") ||
      icon !== (m?.icon || "check") ||
      !includeSamples ||
      JSON.stringify(fieldConfig) !== JSON.stringify(m?.fieldConfig || {}),
    onClose,
  );
  return (
    <Modal
      title={m?.id ? "编辑模块" : "为日常，新增一个空间"}
      subtitle={
        m?.id
          ? "更换模板、调整字段，已有内容会继续保留。"
          : m?.name
            ? `已预设「${m.name}」的字段与视图，可自由修改。`
            : "选一个模板，剩下的交给工作台。"
      }
      onClose={requestClose}
      wide
    >
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const name = String(f.get("name") || "").trim();
          if (!name) {
            setError("请填写模块名称，不能只包含空格。");
            return;
          }
          const fields = [
            ...new Set(
              String(f.get("fields") || "")
                .split(/[,，、\n]/)
                .map((s) => s.trim())
                .filter(Boolean),
            ),
          ].slice(0, 12);
          const definitions = Object.fromEntries(
            fields.map((field) => [
              field,
              structuredClone(getFieldDefinition({ fieldConfig }, field)),
            ]),
          );
          if (!validateFieldConfig(definitions)) {
            setError("请为选项字段填写至少一个不重复的选项。");
            return;
          }
          onSave({
            id: m?.id || uid(),
            name,
            description: String(f.get("description") || "").trim(),
            icon,
            color,
            view,
            fields,
            fieldConfig: definitions,
            hidden: m?.hidden || false,
            entries:
              hasPresetSamples && !includeSamples ? [] : m?.entries || [],
          });
        }}
      >
        <div className="form-body">
          {hasPresetSamples && (
            <label className="include-samples">
              <input
                type="checkbox"
                checked={includeSamples}
                onChange={(e) => setIncludeSamples(e.target.checked)}
              />
              <span>
                <b>附带 {m!.entries.length} 条学习示例</b>
                <small>帮助你了解怎么记录；取消勾选即可从空白开始。</small>
              </span>
            </label>
          )}
          <div className="form-grid">
            <label>
              模块名称 <span>*</span>
              <input
                autoFocus
                name="name"
                defaultValue={m?.name || ""}
                placeholder="例如：会议记录、阅读清单"
                required
                maxLength={24}
              />
            </label>
            <label>
              一句话描述
              <input
                name="description"
                defaultValue={m?.description || ""}
                placeholder="这个空间，用来做什么？"
                maxLength={70}
              />
            </label>
          </div>
          <label className="form-label">选择页面模板</label>
          <div className="view-choice-grid">
            {views.map((v) => (
              <button
                type="button"
                key={v.id}
                className={"view-choice " + (view === v.id ? "selected" : "")}
                onClick={() => setView(v.id)}
              >
                <Icon name={v.icon} size={23} />
                <b>{v.name.slice(2)}</b>
                {view === v.id && <Check size={12} className="choice-check" />}
              </button>
            ))}
          </div>
          <div className="form-grid">
            <div>
              <label className="form-label">模块图标</label>
              <div className="icon-choices">
                {[
                  "check",
                  "folder",
                  "note",
                  "link",
                  "calendar",
                  "bookmark",
                  "sparkles",
                  "grid",
                  "book",
                  "headphones",
                  "mic",
                  "languages",
                ].map((i) => (
                  <button
                    type="button"
                    className={icon === i ? "selected" : ""}
                    key={i}
                    aria-label={`图标 ${i}`}
                    onClick={() => setIcon(i)}
                  >
                    <Icon name={i} size={19} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="form-label">强调色</label>
              <div className="color-choices">
                {colors.map((c) => (
                  <button
                    type="button"
                    aria-label={`颜色 ${c}`}
                    className={
                      "tone-" + c + " " + (color === c ? "selected" : "")
                    }
                    key={c}
                    onClick={() => setColor(c)}
                  >
                    {color === c && <Check size={17} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label>
            自定义字段 <small>可选</small>
            <input
              name="fields"
              value={fieldsText}
              onChange={(event) => setFieldsText(event.target.value)}
              placeholder="例如：负责人，客户名称，地点"
              maxLength={240}
            />
            <span className="field-hint">
              用逗号分隔，最多 12 个字段。将显示在记录编辑和详情页中。
            </span>
          </label>
          {currentFields.length > 0 && (
            <section className="field-config-list" aria-label="字段类型设置">
              <p className="field-config-caption">
                为字段选择合适的输入方式，记录时就能少填一点。
              </p>
              {currentFields.map((field) => {
                const definition = getFieldDefinition({ fieldConfig }, field);
                return (
                  <div className="field-config-row" key={field}>
                    <b>{field}</b>
                    <select
                      aria-label={`${field}的字段类型`}
                      value={definition.type}
                      onChange={(event) =>
                        updateField(field, event.target.value as FieldType)
                      }
                    >
                      {Object.entries(fieldTypeLabels).map(([type, label]) => (
                        <option key={type} value={type}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {definition.type === "select" && (
                      <label>
                        选项（用分号分隔）
                        <input
                          aria-label={`${field}的选项`}
                          value={
                            optionTexts[field] ??
                            (definition.options || []).join("；")
                          }
                          onChange={(event) => {
                            const value = event.target.value;
                            setOptionTexts((values) => ({
                              ...values,
                              [field]: value,
                            }));
                            setFieldConfig((config) => ({
                              ...config,
                              [field]: {
                                ...definition,
                                options: value
                                  .split(/[;；\n]/)
                                  .map((option) => option.trim())
                                  .filter(Boolean),
                              },
                            }));
                          }}
                          placeholder="例如：新词；正在练习；已掌握"
                        />
                        <small className="field-hint">
                          已有记录中的其他值也会保留。
                        </small>
                      </label>
                    )}
                    {definition.type === "number" && (
                      <label>
                        单位（可选）
                        <input
                          aria-label={`${field}的单位`}
                          value={definition.unit || ""}
                          onChange={(event) =>
                            setFieldConfig((config) => ({
                              ...config,
                              [field]: {
                                ...definition,
                                unit: event.target.value,
                              },
                            }))
                          }
                          placeholder="例如：分钟"
                          maxLength={32}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </section>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="module-preview">
            <span className={"module-icon tone-" + color}>
              <Icon name={icon} />
            </span>
            <div>
              <b>
                {m?.id
                  ? "更改会同步应用到导航和模块页面"
                  : "保存后，自动创建模块页面与导航入口"}
              </b>
              <small>之后随时可以修改，不影响已有记录。</small>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="button" onClick={requestClose}>
            取消
          </button>
          <button className="button primary" type="submit">
            {m?.id ? "保存更改" : "创建模块"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
