"use client";
import React, { useEffect, useRef, useState } from "react";
import { Cloud, RefreshCw } from "lucide-react";
import { type Workspace } from "../workspace";
import { summarizeWorkspace } from "../storage/backup";
import {
  readSnapshot,
  writeSnapshot,
  SnapshotError,
  type Snapshot,
} from "../storage/snapshot-api";
import { Modal } from "./shared";
type Plan = {
  direction: "upload" | "download";
  local: string;
  remote: Snapshot;
};
export default function SnapshotPanel({
  workspace,
  canTransfer,
  onRestore,
  onExport,
}: {
  workspace: Workspace;
  canTransfer: boolean;
  onRestore: (value: Workspace) => boolean;
  onExport: () => void;
}) {
  const [remote, setRemote] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const latest = useRef({ workspace, canTransfer });
  latest.current = { workspace, canTransfer };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  async function perform(action: (signal: AbortSignal) => Promise<void>) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action(controller.signal);
    } catch (err) {
      if (mounted.current) {
        setError(
          controller.signal.aborted
            ? "请求超时。写入结果可能尚未确认，请重新查看云端版本。"
            : (err as Error).message,
        );
        if (err instanceof SnapshotError && err.status === 409) setRemote(null);
      }
    } finally {
      clearTimeout(timeout);
      request.current = null;
      if (mounted.current) setBusy(false);
    }
  }
  const check = (revision?: number) =>
    perform(async (signal) => {
      const snapshot = await readSnapshot(signal, revision);
      if (!signal.aborted && mounted.current) {
        setRemote(snapshot);
        setMessage(
          snapshot.revision
            ? "云端版本已读取，请比较后选择操作。"
            : "云端尚无快照，可保存第一份。",
        );
      }
    });
  const localSummary = summarizeWorkspace(workspace);
  const remoteSummary = remote?.workspace
    ? summarizeWorkspace(remote.workspace)
    : null;
  const same =
    !!remote?.workspace &&
    JSON.stringify(remote.workspace) === JSON.stringify(workspace);
  const latestVersion =
    !remote?.history.length || remote.revision === remote.history[0].revision;
  async function apply() {
    if (!plan || busy) return;
    if (
      !latest.current.canTransfer ||
      JSON.stringify(latest.current.workspace) !== plan.local
    ) {
      setPlan(null);
      setError("本机内容或保存状态已变化，请重新比较后操作。");
      return;
    }
    const approved = plan;
    setPlan(null);
    if (approved.direction === "download") {
      try {
        if (approved.remote.workspace && onRestore(approved.remote.workspace))
          setMessage(
            "快照已载入本机。替换前副本可在数据与备份中下载，保存结果见页面状态。",
          );
        else setError("另一窗口更新了本机内容，请先处理保存冲突。");
      } catch (err) {
        setError((err as Error).message);
      }
      return;
    }
    await perform(async (signal) => {
      const uploaded = JSON.parse(approved.local) as Workspace;
      const saved = await writeSnapshot(
        uploaded,
        approved.remote.revision,
        signal,
      );
      if (signal.aborted || !mounted.current) return;
      setRemote({
        ...saved,
        workspace: uploaded,
        history: [saved, ...approved.remote.history].slice(0, 10),
      });
      setMessage(
        `云端快照 v${saved.revision} 已保存。另一设备登录同一站点后可查看并载入。`,
      );
    });
  }
  return (
    <section
      className="panel setting-panel snapshot-panel"
      aria-label="跨设备接续"
    >
      <h2>
        <Cloud size={18} /> 跨设备接续
      </h2>
      <p>
        需要换设备时，手动保存或载入云端快照。平时编辑只保存在当前浏览器；这里不会自动合并两边的修改。
      </p>
      <button className="button" disabled={busy} onClick={() => void check()}>
        <RefreshCw size={15} />
        {busy ? "正在处理…" : "查看云端版本"}
      </button>
      {remote && (
        <>
          <div className="snapshot-comparison">
            <table>
              <caption>本机与云端快照</caption>
              <thead>
                <tr>
                  <th>内容</th>
                  <th>本机</th>
                  <th>
                    云端 {remote.revision ? `v${remote.revision}` : "空白"}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>模块</th>
                  <td>{localSummary.modules}</td>
                  <td>{remoteSummary?.modules ?? 0}</td>
                </tr>
                <tr>
                  <th>记录</th>
                  <td>{localSummary.records}</td>
                  <td>{remoteSummary?.records ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {remote.updatedAt && (
            <p>
              快照时间：{new Date(remote.updatedAt).toLocaleString("zh-CN")}
            </p>
          )}
          <p>
            {same
              ? "本机与此快照内容一致。"
              : "数量相同也可能包含不同修改，请确认需要保留哪一份。"}
          </p>
          <div className="button-row">
            <button
              className="button primary"
              disabled={
                busy ||
                !canTransfer ||
                same ||
                !latestVersion ||
                localSummary.bytes > 1_500_000
              }
              onClick={() =>
                setPlan({
                  direction: "upload",
                  local: JSON.stringify(workspace),
                  remote,
                })
              }
            >
              将本机保存到云端
            </button>
            <button
              className="button"
              disabled={busy || !canTransfer || same || !remote.workspace}
              onClick={() =>
                setPlan({
                  direction: "download",
                  local: JSON.stringify(workspace),
                  remote,
                })
              }
            >
              将此快照载入本机
            </button>
          </div>
          {remote.history.length > 1 && (
            <label className="snapshot-history">
              历史快照（最近 10 份）
              <select
                value={remote.revision}
                disabled={busy}
                onChange={(event) => void check(Number(event.target.value))}
              >
                {remote.history.map((h) => (
                  <option value={h.revision} key={h.revision}>
                    v{h.revision} ·{" "}
                    {new Date(h.updatedAt).toLocaleString("zh-CN")}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!latestVersion && (
            <p>
              当前查看历史版本。载入后如需保存为新版本，请先重新查看云端最新版本。
            </p>
          )}
        </>
      )}
      {!canTransfer && <p>请先解决本机保存问题，再进行快照替换。</p>}
      {localSummary.bytes > 1_500_000 && (
        <p>当前内容超过云端快照 1.5 MB 上限，请用文件备份迁移。</p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <p className="field-hint">
        仅站点所有者可访问；Agent
        原始日志不包含在快照中。未开启云端服务时仍可使用文件备份。
      </p>
      {plan && (
        <Modal
          title={
            plan.direction === "upload"
              ? "保存本机快照到云端？"
              : "用云端快照替换本机？"
          }
          onClose={() => setPlan(null)}
        >
          <div className="form-body">
            <p>
              {plan.direction === "upload"
                ? `将当前本机内容保存为新的云端版本。若云端 v${plan.remote.revision} 已被其他设备更新，会停止写入。`
                : `将用云端 v${plan.remote.revision} 替换当前本机内容，不会合并。替换前会保留一份本机恢复副本。`}
            </p>
            <button className="text-button" onClick={onExport}>
              先导出本机备份
            </button>
          </div>
          <div className="modal-footer">
            <button className="button" onClick={() => setPlan(null)}>
              取消
            </button>
            <button className="button primary" onClick={() => void apply()}>
              确认{plan.direction === "upload" ? "保存快照" : "载入快照"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
