"use client";
import { saveRecovery } from "../storage/backup";
("use client");
import { useEffect, useMemo, useRef, useState } from "react";
import {
  initialWorkspace,
  loadWorkspace,
  persistWorkspace,
  type Workspace,
} from "../workspace";

const STORE = "yiyu-workspace-v1";

/** Own storage recovery and compare-before-write; UI actions never write directly. */
export function useWorkspaceStorage() {
  const [data, setData] = useState<Workspace | null>(null);
  const [recoveryRaw, setRecoveryRaw] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const [storageConflict, setStorageConflict] = useState<{
    raw: string | null;
  } | null>(null);
  const expectedRaw = useRef<string | null>(null);
  const [lastSavedRaw, setLastSavedRaw] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const serialized = useMemo(
    () => (data ? JSON.stringify(data) : null),
    [data],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      const loaded = loadWorkspace(raw);
      expectedRaw.current = raw;
      setData(loaded.workspace);
      setRecoveryRaw(loaded.recoveryRaw);
    } catch {
      setData(initialWorkspace());
      setSaveError(
        "浏览器存储不可用，当前更改仅保留在本次页面中。请导出备份。",
      );
    }
  }, []);

  useEffect(() => {
    if (!data || recoveryRaw !== null || storageConflict !== null) return;
    const result = persistWorkspace(
      {
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => localStorage.setItem(key, value),
      },
      STORE,
      data,
      expectedRaw.current,
    );
    if (result.status === "saved") {
      expectedRaw.current = result.raw;
      setLastSavedRaw(result.raw);
      setSaveError("");
    } else if (result.status === "conflict") {
      setStorageConflict({ raw: result.raw });
    } else {
      setSaveError(
        "自动保存失败，当前更改尚未保存。请导出备份并检查浏览器存储空间，然后重试保存。",
      );
    }
  }, [data, recoveryRaw, storageConflict, revision]);

  useEffect(() => {
    const handle = (event: StorageEvent) => {
      // Storage access itself may throw when browser privacy settings change.
      try {
        if (
          event.storageArea === localStorage &&
          (event.key === STORE || event.key === null) &&
          event.newValue !== expectedRaw.current
        ) {
          setStorageConflict({ raw: event.newValue });
        }
      } catch {
        setSaveError("暂时无法读取浏览器数据，请先导出当前内容。");
      }
    };
    window.addEventListener("storage", handle);
    return () => window.removeEventListener("storage", handle);
  }, []);

  const unsaved =
    !!data &&
    (serialized !== lastSavedRaw ||
      recoveryRaw !== null ||
      storageConflict !== null ||
      !!saveError);
  useEffect(() => {
    if (!unsaved) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [unsaved]);

  const reload = () => {
    try {
      const raw = localStorage.getItem(STORE);
      const loaded = loadWorkspace(raw);
      expectedRaw.current = raw;
      setStorageConflict(null);
      setRecoveryRaw(loaded.recoveryRaw);
      setSaveError("");
      setData(loaded.workspace);
      return true;
    } catch {
      setSaveError("暂时无法读取浏览器数据，请先导出当前内容。");
      return false;
    }
  };

  // Explicit replacement only: preserve what the user is replacing before applying it.
  const restore = (workspace: Workspace) => {
    let current: string | null;
    try {
      current = localStorage.getItem(STORE);
      if (current !== expectedRaw.current) {
        setStorageConflict({ raw: current });
        return false;
      }
      const before = recoveryRaw ?? (data ? JSON.stringify(data) : current);
      if (before && before !== JSON.stringify(workspace)) saveRecovery(before);
    } catch {
      throw new Error(
        "无法保留替换前的副本，本机内容未改变。请先导出备份并释放浏览器空间后重试。",
      );
    }
    expectedRaw.current = current;
    setStorageConflict(null);
    setRecoveryRaw(null);
    setSaveError("");
    setData(workspace);
    return true;
  };

  return {
    data,
    setData,
    recoveryRaw,
    saveError,
    storageConflict,
    reload,
    restore,
    retry: () => setRevision((n) => n + 1),
    // Retain the old expected value: a concurrent update must still stop this write.
    replaceUnreadable: () => setRecoveryRaw(null),
    saveState:
      recoveryRaw !== null || storageConflict !== null || saveError
        ? "未保存"
        : serialized === lastSavedRaw
          ? "已保存"
          : "保存中",
  };
}
