"use client";
import React, { useMemo, useState } from "react";
import { Search, ArrowUpRight, FileText } from "lucide-react";
import type { Module } from "../workspace";
import { searchWorkspace } from "../search";
import { Modal, Icon, Empty } from "./shared";

export default function SearchDialog({
  modules,
  onClose,
  navigate,
}: {
  modules: Module[];
  onClose: () => void;
  navigate: (path: string) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => searchWorkspace(modules, query),
    [modules, query],
  );
  const open = (path: string) => {
    onClose();
    navigate(path);
  };
  return (
    <Modal
      title="搜索工作空间"
      subtitle="模块、标题、正文和自定义字段，都能找到。"
      onClose={onClose}
      wide
    >
      <div className="search-modal-input">
        <Search size={20} />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="想找点什么？"
          aria-label="全局搜索"
        />
        <kbd>ESC</kbd>
      </div>
      <div className="search-results">
        {results.modules.map((module) => (
          <button key={module.id} onClick={() => open(`modules/${module.id}`)}>
            <span className={"module-icon tone-" + module.color}>
              <Icon name={module.icon} />
            </span>
            <span>
              <b>{module.name}</b>
              <small>模块 · {module.entries.length} 条内容</small>
            </span>
            <ArrowUpRight size={16} />
          </button>
        ))}
        {results.entries.map(({ module, entry }) => (
          <button
            key={`${module.id}-${entry.id}`}
            onClick={() => open(`modules/${module.id}/items/${entry.id}`)}
          >
            <span className={"module-icon tone-" + module.color}>
              <FileText size={18} />
            </span>
            <span>
              <b>{entry.title}</b>
              <small>
                {module.name} · {entry.description.slice(0, 45) || "查看详情"}
              </small>
            </span>
            <ArrowUpRight size={16} />
          </button>
        ))}
        {query && !results.modules.length && !results.entries.length && (
          <Empty title="暂时没有找到" detail="换一个关键词试试。" />
        )}
        {results.hasMore && (
          <p className="search-limit-note">
            先显示 30 条匹配内容，请补充关键词缩小范围。
          </p>
        )}
      </div>
    </Modal>
  );
}
