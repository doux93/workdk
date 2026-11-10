"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Feather,
} from "lucide-react";
import {
  type Entry,
  type Module,
  colors,
  statusName,
  dateKey,
  safeUrl,
} from "../workspace";
import { Icon, Empty } from "./shared";
import { FieldValue } from "./Fields";
import { filterEntries } from "../search";
export default function ModuleContent({
  module: m,
  entries: sourceEntries,
  query = "",
  filter = "all",
  open,
  edit,
  add,
  setStatus,
  month,
  setMonth,
  selected,
  setSelected,
}: {
  module: Module;
  entries: Entry[];
  query?: string;
  filter?: string;
  open: (e: Entry) => void;
  edit: (e: Entry) => void;
  add: (date?: string, status?: Entry["status"]) => void;
  setStatus: (id: string, status: Entry["status"]) => void;
  month: Date;
  setMonth: (date: Date) => void;
  selected: string;
  setSelected: (date: string) => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const entries = useMemo(
    () => filterEntries(sourceEntries, query, filter),
    [sourceEntries, query, filter],
  );
  const [page, setPage] = useState(1),
    [cardsLimit, setCardsLimit] = useState(30),
    [dayLimit, setDayLimit] = useState(50);
  const [boardLimits, setBoardLimits] = useState({
    todo: 30,
    doing: 30,
    done: 30,
  });
  const dateBuckets = useMemo(() => {
    const buckets = new Map<string, Entry[]>();
    for (const entry of entries) {
      const bucket = buckets.get(entry.date) || [];
      bucket.push(entry);
      buckets.set(entry.date, bucket);
    }
    return buckets;
  }, [entries]);
  const statusBuckets = useMemo(
    () => ({
      todo: entries.filter((entry) => entry.status === "todo"),
      doing: entries.filter((entry) => entry.status === "doing"),
      done: entries.filter((entry) => entry.status === "done"),
    }),
    [entries],
  );
  useEffect(() => {
    setPage(1);
    setCardsLimit(30);
    setBoardLimits({ todo: 30, doing: 30, done: 30 });
  }, [m.id, m.view, query, filter]);
  useEffect(() => setDayLimit(50), [selected, m.id, m.view, query, filter]);
  const pageCount = Math.max(1, Math.ceil(entries.length / 50));
  const currentPage = Math.min(page, pageCount);
  const pageEntries = entries.slice((currentPage - 1) * 50, currentPage * 50);

  if (m.view === "calendar") {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const cells = Array.from(
      { length: 42 },
      (_, i) => new Date(month.getFullYear(), month.getMonth(), i - offset + 1),
    );
    const selectedItems = dateBuckets.get(selected) || [];
    const undated = dateBuckets.get("") || [];
    return (
      <div className="calendar-layout">
        <section className="panel full-calendar">
          <div className="calendar-header">
            <h2>
              {month.getFullYear()}年 <span>{month.getMonth() + 1}月</span>
            </h2>
            <div className="button-row">
              <button
                className="button small"
                onClick={() => {
                  setMonth(new Date());
                  setSelected(dateKey());
                }}
              >
                今天
              </button>
              <button
                className="icon-button"
                aria-label="上一个月"
                onClick={() => {
                  const d = new Date(
                    month.getFullYear(),
                    month.getMonth() - 1,
                    1,
                  );
                  setMonth(d);
                  setSelected(dateKey(d));
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="下一个月"
                onClick={() => {
                  const d = new Date(
                    month.getFullYear(),
                    month.getMonth() + 1,
                    1,
                  );
                  setMonth(d);
                  setSelected(dateKey(d));
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="calendar-weekdays">
            {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map(
              (d) => (
                <span key={d}>{d}</span>
              ),
            )}
          </div>
          <div className="calendar-cells">
            {cells.map((d) => {
              const key = dateKey(d);
              const items = dateBuckets.get(key) || [];
              return (
                <button
                  key={key}
                  aria-label={`${key}，${items.length} 条内容`}
                  className={
                    (d.getMonth() !== month.getMonth() ? "outside " : "") +
                    (key === selected ? "selected " : "") +
                    (key === dateKey() ? "today" : "")
                  }
                  onClick={() => setSelected(key)}
                >
                  <b>{d.getDate()}</b>
                  <div>
                    {items.slice(0, 2).map((e) => (
                      <span key={e.id} className={"calendar-event " + e.status}>
                        {e.time && <small>{e.time}</small>}
                        {e.title}
                      </span>
                    ))}
                    {items.length > 2 && (
                      <small className="more-events">
                        +{items.length - 2} 条
                      </small>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
        <section className="panel day-details">
          <div className="panel-heading">
            <h2>{selected.slice(5).replace("-", "月")}日</h2>
            <button
              className="icon-button"
              aria-label="添加当天内容"
              onClick={() => add(selected)}
            >
              <Plus size={18} />
            </button>
          </div>
          {selectedItems.length ? (
            selectedItems
              .slice()
              .sort((a, b) => a.time.localeCompare(b.time))
              .slice(0, dayLimit)
              .map((e) => (
                <button
                  className="day-event"
                  key={e.id}
                  onClick={() => open(e)}
                >
                  <span>{e.time || "全天"}</span>
                  <b>{e.title}</b>
                  <p>{e.description.slice(0, 60)}</p>
                  <span className={"status-badge " + e.status}>
                    {statusName[e.status]}
                  </span>
                </button>
              ))
          ) : (
            <Empty
              title="留白的一天"
              detail="为这一天添加新的安排。"
              action={() => add(selected)}
            />
          )}{" "}
          {selectedItems.length > dayLimit && (
            <button
              className="batch-load"
              onClick={() => setDayLimit((value) => value + 50)}
            >
              再显示 50 条安排
            </button>
          )}
          {undated.length > 0 && (
            <div className="undated">
              <h3>未设日期 · {undated.length}</h3>
              {undated.length > dayLimit && (
                <button
                  className="batch-load"
                  onClick={() => setDayLimit((value) => value + 50)}
                >
                  再显示 50 条未设日期内容
                </button>
              )}
              {undated.slice(0, dayLimit).map((e) => (
                <button onClick={() => edit(e)} key={e.id}>
                  {e.title}
                  <Plus size={13} />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }
  if (!entries.length)
    return (
      <section className="panel">
        <Empty
          title={m.entries.length ? "没有匹配的内容" : "让这个空间开始生长"}
          detail={
            m.entries.length
              ? "试着调整关键词或状态筛选。"
              : "添加第一条记录，开始建立自己的秩序。"
          }
          action={m.entries.length ? undefined : () => add()}
        />
      </section>
    );
  if (m.view === "board")
    return (
      <div className="board">
        {(["todo", "doing", "done"] as const).map((status) => (
          <section
            className={"board-column " + (dragging ? "droppable" : "")}
            key={status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (entries.some((x) => x.id === id)) setStatus(id, status);
              setDragging(null);
            }}
          >
            <div className="board-heading">
              <h3>
                <span className={"status-dot " + status} />
                {statusName[status]}
                <span>{statusBuckets[status].length}</span>
              </h3>
              <Icon name="board" size={15} />
            </div>
            <div className="board-items">
              {statusBuckets[status].slice(0, boardLimits[status]).map((e) => (
                <article
                  className={
                    "board-card " + (dragging === e.id ? "dragging" : "")
                  }
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", e.id);
                    setDragging(e.id);
                  }}
                  onDragEnd={() => setDragging(null)}
                  key={e.id}
                >
                  <div className="board-card-top">
                    <span
                      className={
                        "priority " + (e.priority === "紧急" ? "urgent" : "")
                      }
                    >
                      {e.priority}
                    </span>
                    <button
                      className="icon-button"
                      aria-label={`编辑 ${e.title}`}
                      onClick={() => edit(e)}
                    >
                      <MoreHorizontal size={17} />
                    </button>
                  </div>
                  <button className="board-content" onClick={() => open(e)}>
                    <h3>{e.title}</h3>
                    <p>{e.description || "点击查看或补充更多内容"}</p>
                  </button>
                  <div className="board-card-footer">
                    <span>
                      <CalendarDays size={13} />
                      {e.date ? e.date.slice(5) : "未设日期"}
                    </span>
                    <select
                      aria-label={`${e.title}的状态`}
                      value={e.status}
                      onChange={(ev) =>
                        setStatus(e.id, ev.target.value as Entry["status"])
                      }
                    >
                      {Object.entries(statusName).map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}
            </div>
            {statusBuckets[status].length > boardLimits[status] && (
              <button
                className="batch-load"
                onClick={() =>
                  setBoardLimits((limits) => ({
                    ...limits,
                    [status]: limits[status] + 30,
                  }))
                }
              >
                再显示 30 条{statusName[status]}内容
              </button>
            )}
            <button
              className="board-add"
              onClick={() => add(undefined, status)}
            >
              <Plus size={16} />
              新增内容
            </button>
          </section>
        ))}
      </div>
    );
  if (m.view === "notes")
    return (
      <div className="notes-grid">
        {entries.slice(0, cardsLimit).map((e, i) => (
          <button
            key={e.id}
            className={"note-card note-color-" + (i % 4)}
            onClick={() => open(e)}
          >
            <div className="note-card-top">
              <Feather size={19} />
              <ArrowUpRight size={17} />
            </div>
            <h2>{e.title}</h2>
            <p>{e.description || "还没有正文，点击写下更多想法。"}</p>
            <div className="note-card-footer">
              <span>{e.date || "未设日期"}</span>
              <span>{e.description.length} 字</span>
            </div>
          </button>
        ))}
        {entries.length > cardsLimit && (
          <button
            className="batch-load wide-load"
            onClick={() => setCardsLimit((value) => value + 30)}
          >
            再显示 30 条笔记（还有 {entries.length - cardsLimit} 条）
          </button>
        )}
        <button className="note-card new-note" onClick={() => add()}>
          <Plus size={30} />
          <h3>新的想法</h3>
          <p>从这里，写下第一句话。</p>
        </button>
      </div>
    );
  if (m.view === "links")
    return (
      <div className="link-card-grid">
        {entries.slice(0, cardsLimit).map((e, i) => (
          <article className="link-card" key={e.id}>
            <div className="link-card-header">
              <span
                className={"shortcut-icon tone-" + colors[i % colors.length]}
              >
                {e.title.charAt(0)}
              </span>
              <button
                className="icon-button"
                aria-label={`编辑 ${e.title}`}
                onClick={() => edit(e)}
              >
                <MoreHorizontal size={18} />
              </button>
            </div>
            <h3>{e.title}</h3>
            <p>{e.description || "添加说明，方便下次找到。"}</p>
            <div className="link-card-bottom">
              <span>
                {safeUrl(e.url) ? new URL(e.url).hostname : "尚未设置链接"}
              </span>
              {safeUrl(e.url) ? (
                <a
                  href={safeUrl(e.url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-open"
                  aria-label={`打开 ${e.title}`}
                >
                  <ArrowUpRight size={19} />
                </a>
              ) : (
                <button
                  className="link-open"
                  aria-label={`查看 ${e.title}`}
                  onClick={() => open(e)}
                >
                  <ArrowRight size={19} />
                </button>
              )}
            </div>
          </article>
        ))}
        {entries.length > cardsLimit && (
          <button
            className="batch-load wide-load"
            onClick={() => setCardsLimit((value) => value + 30)}
          >
            再显示 30 个入口（还有 {entries.length - cardsLimit} 个）
          </button>
        )}
        <button className="link-card add-link" onClick={() => add()}>
          <Plus size={25} />
          <h3>添加一个入口</h3>
        </button>
      </div>
    );
  return (
    <section className="panel list-panel">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th className="check-cell" />
              <th>标题</th>
              <th>状态</th>
              <th>优先级</th>
              <th>日期</th>
              {m.fields.map((f) => (
                <th key={f}>{f}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {pageEntries.map((e) => (
              <tr key={e.id} className={e.status === "done" ? "completed" : ""}>
                <td>
                  <button
                    className="task-check"
                    aria-label={`${e.status === "done" ? "取消完成" : "完成"} ${e.title}`}
                    onClick={() =>
                      setStatus(e.id, e.status === "done" ? "todo" : "done")
                    }
                  >
                    {e.status === "done" && <Check size={13} />}
                  </button>
                </td>
                <td>
                  <button className="table-title" onClick={() => open(e)}>
                    {e.title}
                  </button>
                </td>
                <td>
                  <select
                    className={"status-select " + e.status}
                    aria-label={`${e.title}的状态`}
                    value={e.status}
                    onChange={(ev) =>
                      setStatus(e.id, ev.target.value as Entry["status"])
                    }
                  >
                    {Object.entries(statusName).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <span
                    className={
                      "priority " + (e.priority === "紧急" ? "urgent" : "")
                    }
                  >
                    {e.priority}
                  </span>
                </td>
                <td className="date-cell">
                  {e.date || "—"} {e.time}
                </td>
                {m.fields.map((f) => (
                  <td className="field-cell" key={f}>
                    <FieldValue module={m} field={f} value={e.values[f]} />
                  </td>
                ))}
                <td>
                  <button
                    className="icon-button"
                    aria-label={`编辑 ${e.title}`}
                    onClick={() => edit(e)}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {entries.length > 50 && (
        <nav className="record-pagination" aria-label="记录分页">
          <span>共 {entries.length} 条 · 每页 50 条</span>
          <div>
            <button
              className="button small"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              上一页
            </button>
            <span>
              第 {currentPage} / {pageCount} 页
            </span>
            <button
              className="button small"
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              下一页
            </button>
          </div>
        </nav>
      )}
      <button className="add-task" onClick={() => add()}>
        <Plus size={17} />
        新增内容
      </button>
    </section>
  );
}
