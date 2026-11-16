"use client";
import React, { useEffect, useRef, useState } from "react";
import { downloadFile } from "../../agent/download";
import { Modal } from "../shared";
import AgentDevices from "./AgentDevices";
import type { AgentDevice } from "../../agent/model";
export default function AgentConnection({
  devices,
  onClose,
}: {
  devices: AgentDevice[];
  onClose: () => void;
}) {
  const [panel, setPanel] = useState<"connect" | "devices">("connect");
  const manageButton = useRef<HTMLButtonElement>(null);
  const [label, setLabel] = useState("我的电脑");
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [configError, setConfigError] = useState("");
  const [configBusy, setConfigBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function downloadConfig(device?: string, deviceLabel = label) {
    if (active.current) return;
    if (!deviceLabel.trim()) {
      setConfigError("请填写电脑名称。");
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setConfigError("");
    setNotice("");
    setConfigBusy(true);
    try {
      const r = await fetch("/api/agent-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: deviceLabel.trim(),
          ...(device ? { device } : {}),
        }),
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
      if (!controller.signal.aborted) {
        downloadFile(blob, "workdk-agent.config.json");
        setNotice(
          "已生成独立连接配置，请仅在对应电脑导入。若下载未完成，可在设备列表重新签发。",
        );
        setRevision((n) => n + 1);
        setPanel("devices");
        manageButton.current?.focus();
      }
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
        <div
          className="agent-connection-switch"
          role="group"
          aria-label="连接设置"
        >
          <button
            className={`button ${panel === "connect" ? "primary" : ""}`}
            aria-pressed={panel === "connect"}
            onClick={() => setPanel("connect")}
          >
            连接新电脑
          </button>
          <button
            ref={manageButton}
            className={`button ${panel === "devices" ? "primary" : ""}`}
            aria-pressed={panel === "devices"}
            onClick={() => setPanel("devices")}
          >
            管理设备
          </button>
        </div>
        {notice && <p role="status">{notice}</p>}
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
        <div hidden={panel !== "connect"}>
          <ol>
            <li>
              <b>下载采集器与连接配置</b>
              <p>
                连接配置含私有访问凭据，请只保存在对应电脑上，每台电脑分别生成。
              </p>
              <label>
                电脑名称
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={80}
                  disabled={configBusy}
                  placeholder="例如：办公室 Windows"
                />
              </label>
              <div className="button-row">
                <a className="button" href="/workdk-agent.zip" download>
                  下载采集器
                </a>
                <button
                  className="button primary"
                  onClick={() => void downloadConfig()}
                  disabled={configBusy}
                >
                  {configBusy ? "正在下载…" : "下载连接配置"}
                </button>
              </div>
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
          <details className="agent-mcp-guide">
            <summary>使用 WorkBuddy？展开接入步骤</summary>
            <p>完成上方安装后，在解压的采集器目录运行：</p>
            <code>node collector.mjs install-mcp</code>
            <p>
              在 WorkBuddy 的「插件 → MCP 服务器」中重新连接 workdk-journal，
              然后让它调用 record_work
              记录本轮摘要。项目名应与安装时填写的一致。
            </p>
            <p>
              请保持上传窗口运行。MCP 调用成功表示已保存到本地， 同步结果可用
              status-agent.cmd 查看。记录仍依赖工具调用，尚不支持原生完成回调。
            </p>
          </details>
          <p>
            采集器仅上报选定项目的摘要和工具元数据，不读取完整历史对话或文件正文；
            任务描述和最终回复会经过过滤后上报。
          </p>
        </div>
        <div hidden={panel !== "devices"}>
          <AgentDevices
            devices={devices}
            revision={revision}
            busy={configBusy}
            onIssue={(device, name) => void downloadConfig(device, name)}
          />
        </div>
      </div>
    </Modal>
  );
}
