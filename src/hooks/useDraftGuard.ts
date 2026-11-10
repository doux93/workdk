"use client";
import React, { useEffect, useRef } from "react";
export function useDraftGuard(
  formRef: React.RefObject<HTMLFormElement | null>,
  configurationChanged: boolean,
  onClose: () => void,
) {
  const initialValues = useRef<string | null>(null);
  const snapshot = () =>
    formRef.current
      ? JSON.stringify(Array.from(new FormData(formRef.current).entries()))
      : null;
  useEffect(() => {
    initialValues.current = snapshot();
  }, []);
  const dirty = () =>
    configurationChanged ||
    (initialValues.current !== null && snapshot() !== initialValues.current);
  useEffect(() => {
    const handle = (event: BeforeUnloadEvent) => {
      if (dirty()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handle);
    return () => window.removeEventListener("beforeunload", handle);
  }, [configurationChanged]);
  return () => {
    if (!dirty() || window.confirm("有尚未保存的更改，确定放弃这些更改吗？"))
      onClose();
  };
}
