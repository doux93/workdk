"use client";
import React, { useEffect, useRef, useState } from "react";
import { requestJson } from "../../agent/api";
import type { AgentDevice } from "../../agent/model";

type Credential = {
  device: string;
  label: string;
  created_at: string;
  revoked_at: string | null;
};
export default function AgentDevices({
  devices,
  revision,
  busy,
  onIssue,
}: {
  devices: AgentDevice[];
  revision: number;
  busy: boolean;
  onIssue: (device: string, label: string) => void;
}) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [retry, setRetry] = useState(0);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => mutation.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    requestJson<{ devices: Credential[] }>("/api/agent-devices", {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(data.devices))
          throw new Error("设备服务尚未升级，请更新服务端后重试。");
        setCredentials(data.devices);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision, retry]);
  const rows = [
    ...credentials,
    ...devices
      .filter((d) => !credentials.some((c) => c.device === d.device))
      .map((d) => ({
        device: d.device,
        label: `旧设备 ${d.device.slice(0, 8)}`,
        created_at: "",
        revoked_at: null,
      })),
  ];
  async function revoke(device: string, label: string) {
    if (
      mutation.current ||
      !window.confirm(`停用“${label}”？该电脑将不能继续上传，历史记录会保留。`)
    )
      return;
    const controller = new AbortController();
    mutation.current = controller;
    setPending(device);
    setError("");
    try {
      await requestJson("/api/agent-devices", {
        method: "PATCH",
        body: JSON.stringify({ device }),
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setRetry((n) => n + 1);
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (mutation.current === controller) mutation.current = null;
      if (!controller.signal.aborted) setPending("");
    }
  }
  return (
    <section className="agent-device-management" aria-label="设备连接管理">
      <h3>设备连接</h3>
      <p className="agent-note">
        每台电脑独立授权。停用保留历史记录；重新签发保留设备编号，并使该设备的旧配置失效。
      </p>
      {loading && <p role="status">正在读取设备…</p>}
      {error && (
        <div role="alert" className="agent-inline-error">
          {error}
          <button
            className="text-button"
            onClick={() => setRetry((n) => n + 1)}
          >
            重试设备列表
          </button>
        </div>
      )}
      {!loading && !error && !rows.length && (
        <p className="agent-note">尚无设备连接，先为这台电脑下载配置。</p>
      )}
      <ul className="agent-device-list">
        {rows.map((d) => {
          const observed = devices.find((item) => item.device === d.device);
          return (
            <li key={d.device}>
              <div className="agent-device-title">
                <b>{d.label}</b>
                <span
                  className={`agent-source ${d.revoked_at ? "revoked" : ""}`}
                >
                  {d.revoked_at
                    ? "已停用"
                    : d.created_at
                      ? "已授权"
                      : "旧配置 · 待升级"}
                </span>
              </div>
              <p>
                <code>{d.device.slice(0, 8)}</code>
                {observed
                  ? ` · ${observed.count} 条事件 · 最近同步 ${new Date(observed.lastSync).toLocaleString()}`
                  : " · 尚未上报记录"}
              </p>
              <div className="button-row">
                <button
                  className="button"
                  disabled={busy || !!pending || loading || !!error}
                  onClick={() => {
                    if (
                      window.confirm(
                        `为“${d.label}”重新签发？旧配置将失效，请在原电脑导入新配置并重启上传器。`,
                      )
                    )
                      onIssue(d.device, d.label);
                  }}
                >
                  {d.created_at ? "重新签发配置" : "升级连接配置"}
                </button>
                {d.created_at && !d.revoked_at && (
                  <button
                    className="button danger-outline"
                    disabled={busy || !!pending || loading || !!error}
                    onClick={() => void revoke(d.device, d.label)}
                  >
                    {pending === d.device ? "正在停用…" : "停用设备"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
