import React from "react";
import { ArrowUpRight } from "lucide-react";
import {
  type Module,
  getFieldDefinition,
  fieldValueError,
  safeUrl,
} from "../workspace";

export function CustomFieldInput({
  module,
  field,
  name,
  value,
}: {
  module: Module;
  field: string;
  name: string;
  value: string;
}) {
  const definition = getFieldDefinition(module, field);
  const legacy = !!value && fieldValueError(definition, value) !== null;
  if (definition.type === "select") {
    const options = definition.options || [];
    return (
      <>
        <select name={name} defaultValue={value}>
          <option value="">请选择</option>
          {legacy && <option value={value}>{value}（原有值）</option>}
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {legacy && (
          <small className="field-hint">
            已保留原来填写的内容，也可以选择新的选项。
          </small>
        )}
      </>
    );
  }
  if (legacy && definition.type !== "text")
    return (
      <>
        <input
          name={name}
          defaultValue={value}
          inputMode={definition.type === "number" ? "decimal" : undefined}
          maxLength={2048}
        />
        <small className="field-hint">
          原有文本会保留；修改后请填写
          {definition.type === "number" ? "数字" : "有效链接"}。
        </small>
      </>
    );
  return (
    <>
      <input
        name={name}
        type={
          definition.type === "number"
            ? "number"
            : definition.type === "url"
              ? "url"
              : "text"
        }
        inputMode={definition.type === "number" ? "decimal" : undefined}
        min={definition.min}
        max={definition.max}
        step={
          definition.type === "number" ? (definition.step ?? "any") : undefined
        }
        defaultValue={value}
        placeholder={
          definition.type === "url"
            ? "https://…"
            : definition.type === "number"
              ? "填写数字"
              : `填写${field}`
        }
        maxLength={definition.type === "url" ? 2048 : 1000}
      />
      {definition.type === "number" && definition.unit && (
        <small className="field-hint">单位：{definition.unit}</small>
      )}
    </>
  );
}

export function FieldValue({
  module,
  field,
  value,
}: {
  module: Module;
  field: string;
  value?: string;
}) {
  if (!value) return <>—</>;
  const definition = getFieldDefinition(module, field);
  if (definition.type === "url") {
    const href = safeUrl(value);
    return href ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="custom-field-link"
        title={value}
      >
        {value}
        <ArrowUpRight size={13} />
      </a>
    ) : (
      <span title={value}>{value}</span>
    );
  }
  if (definition.type === "select")
    return (
      <span className="custom-field-option" title={value}>
        {value}
      </span>
    );
  if (
    definition.type === "number" &&
    definition.unit &&
    !fieldValueError(definition, value)
  )
    return (
      <span title={value}>
        {value}
        <small className="field-unit">{definition.unit}</small>
      </span>
    );
  return <span title={value}>{value}</span>;
}
