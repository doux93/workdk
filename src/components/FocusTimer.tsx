"use client";
import React, { useEffect, useRef, useState } from "react";
import { RotateCcw, Pause, Play } from "lucide-react";
export default function FocusTimer({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const [seconds, setSeconds] = useState(1500);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerEnd = useRef(0);
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil((timerEnd.current - Date.now()) / 1000),
      );
      setSeconds(left);
      if (left === 0) {
        setTimerRunning(false);
        notify("专注完成，起身休息一下吧。");
      }
    }, 250);
    return () => clearInterval(interval);
  }, [timerRunning]);
  return (
    <div className="focus-widget">
      <div>
        <span>
          <span className={"pulse " + (timerRunning ? "running" : "")} />
          专注时刻
        </span>
        <button
          className="icon-button"
          aria-label="重置专注计时"
          onClick={() => {
            setTimerRunning(false);
            setSeconds(1500);
          }}
        >
          <RotateCcw size={13} />
        </button>
      </div>
      <div className="focus-controls">
        <b>
          {Math.floor(seconds / 60)
            .toString()
            .padStart(2, "0")}
          <em>:</em>
          {(seconds % 60).toString().padStart(2, "0")}
        </b>
        <button
          className="focus-play"
          aria-label={timerRunning ? "暂停专注" : "开始专注"}
          onClick={() => {
            if (timerRunning) setTimerRunning(false);
            else {
              const s = seconds || 1500;
              setSeconds(s);
              timerEnd.current = Date.now() + s * 1000;
              setTimerRunning(true);
            }
          }}
        >
          {timerRunning ? <Pause size={15} /> : <Play size={15} />}
        </button>
      </div>
      <p>让注意力，回到眼前</p>
    </div>
  );
}
