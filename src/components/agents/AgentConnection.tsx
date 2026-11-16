"use client";
import React, { useEffect, useRef, useState } from "react";
import { downloadFile } from "../../agent/download";
import { Modal } from "../shared";
import type { AgentDevice } from "../../agent/model";
export default function AgentConnection({
  devices,
  onClose,
}: {
  devices: AgentDevice[];
  onClose: () => void;
}) {
  const [configError, setConfigError] = useState("");
  const [configBusy, setConfigBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function downloadConfig() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setConfigError("");
    setConfigBusy(true);
    try {
      const r = await fetch("/api/agent-setup", {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      const isJson = r.headers
        .get("content-type")
        ?.includes("application/json");
      if (!r.ok) {
        let message = "";
        if (isJson) {
          const body = (await r.json()) as { error?: unknown; code?: unknown };
          if (typeof body.error === "string") message = body.error;
        }
        if (!message)
          message =
            r.status === 404
              ? "当前地址没有采集服务；如果使用本机版，请同时启动采集 API 服务。"
              : r.status === 401
                ? "下载接口未识别到登录状态，请在新窗口登录后重试。"
                : r.status === 403
                  ? "下载请求被拒绝，请在新窗口查看具体原因。"
                  : r.status >= 500
                    ? "连接配置服务暂时不可用，请稍后重试。"
                    : "下载失败，请重试。";
        throw new Error(`HTTP ${r.status} · ${message}`);
      }
      if (!isJson)
        throw new Error(
          "下载请求跳转到了登录页面，请点击“在新窗口下载”完成正常登录后重试。",
        );
      const blob = await r.blob();
      if (!controller.signal.aborted)
        downloadFile(blob, "workdk-agent.config.json");
    } catch (e) {
      if (!controller.signal.aborted)
        setConfigError(
          e instanceof TypeError
            ? "下载请求未完成，请点击“在新窗口下载”检查登录状态或连接。"
            : (e as Error).message,
        );
    } finally {
      if (active.current === controller) active.current = null;
      if (!controller.signal.aborted) setConfigBusy(false);
    }
  }
  return (
    <Modal title="连接你的电脑" onClose={() => onClose()}>
      <div className="agent-connect">
        <p>
          配置一次，之后照常使用
          Agent。电脑端采集器会在后台上传记录，网页关闭时也能同步。
        </p>
        <ol>
          <li>
            <b>下载采集器与连接配置</b>
            <p>连接配置含私有访问凭据，请只保存在自己的电脑上。</p>
            <div className="button-row">
              <a className="button" href="/workdk-agent.zip" download>
                下载采集器
              </a>
              <button
                className="button primary"
                onClick={downloadConfig}
                disabled={configBusy}
              >
                {configBusy ? "正在下载…" : "下载连接配置"}
              </button>
            </div>
            {configError && (
              <div>
                <p role="alert">{configError}</p>
                <a
                  className="text-button"
                  href="/api/agent-setup"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  在新窗口下载
                </a>
                <span> · </span>
                <a
                  className="text-button"
                  href="/signin-with-chatgpt?return_to=%2F%23agents"
                  target="_top"
                >
                  重新登录工作台
                </a>
              </div>
            )}
          </li>
          <li>
            <b>解压并运行 setup-agent.cmd</b>
            <p>
              需要 Node.js 22.13
              或更新版本。按提示选择连接配置和允许采集的项目目录。Windows、WSL
              应分别配置各自的 Agent 环境。
            </p>
          </li>
          <li>
            <b>检查回调并启动上传</b>
            <p>
              在 Codex / Claude Code 中检查新回调，运行 start-agent.cmd。双击
              status-agent.cmd 可查看本地待上传数量和错误。
            </p>
          </li>
        </ol>
        <p>
          WorkBuddy 可通过包内 MCP 工具接入，详见
          README。采集器仅上报选定项目的摘要和工具元数据，不读取完整历史对话或文件正文；任务描述和最终回复会经过过滤后上报。
        </p>
        <h3>已上报设备</h3>
        {devices.length ? (
          devices.map((d) => (
            <p key={d.device}>
              <code>{d.device.slice(0, 8)}</code> · {d.count} 条事件 · 最近同步{" "}
              {new Date(d.lastSync).toLocaleString()}
            </p>
          ))
        ) : (
          <p>尚未收到设备数据，首次上传后会显示在这里。</p>
        )}
      </div>
    </Modal>
  );
}
