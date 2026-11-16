"use client";
import React, { useEffect, useState } from "react";
import { Bot, ArrowRight } from "lucide-react";
import { dateKey } from "../../workspace";
import { requestJson } from "../../agent/api";
import type { SessionPage } from "../../agent/model";
export function AgentToday({ navigate }: { navigate: (p: string) => void }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    requestJson<SessionPage>(
      "/api/agent-sessions?day=" +
        dateKey() +
        "&offsetMinutes=" +
        -new Date().getTimezoneOffset(),
    )
      .then((d) => {
        if (active) setCount(d.sessions.length + (d.hasMore ? 1 : 0));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="panel agent-today">
      <span className="agent-logo">
        <Bot size={23} />
      </span>
      <div>
        <b>今日 Agent 工作</b>
        <p>
          {count === null
            ? "连接你的工具，让工作进展自动留下记录。"
            : count === 0
              ? "今天还没有工作记录，接入后会自动出现在这里。"
              : `已有 ${Math.min(count, 50)}${count > 50 ? "＋" : ""} 个工作会话，查看成果与后续事项。`}
        </p>
      </div>
      <button className="button" onClick={() => navigate("agents")}>
        查看工作日志 <ArrowRight size={15} />
      </button>
    </section>
  );
}
