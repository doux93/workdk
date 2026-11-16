"use client";
import React, { useEffect, useId, useRef } from "react";
import {
  Bookmark,
  CalendarDays,
  FileText,
  Folder,
  Grid2X2,
  Link,
  List,
  Plus,
  Sparkles,
  X,
  CheckSquare2,
  Columns3,
  Feather,
  BookOpen,
  Headphones,
  Mic,
  Languages,
} from "lucide-react";
const ICONS: Record<string, typeof Plus> = {
  check: CheckSquare2,
  folder: Folder,
  note: FileText,
  link: Link,
  calendar: CalendarDays,
  list: List,
  board: Columns3,
  grid: Grid2X2,
  bookmark: Bookmark,
  sparkles: Sparkles,
  book: BookOpen,
  headphones: Headphones,
  mic: Mic,
  languages: Languages,
};
export function Icon({
  name,
  size = 19,
  ...rest
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const C = ICONS[name] || Grid2X2;
  return <C size={size} strokeWidth={1.7} {...rest} />;
}
export function MiniLayout({ type }: { type: string }) {
  return (
    <div className={"mini-layout " + type}>
      <div className="mini-side">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="mini-main">
        <div className="mini-title" />
        <div className="mini-hero" />
        <div className="mini-blocks">
          <i />
          <i />
          <i />
        </div>
        <div className="mini-lines">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}
export function Empty({
  title = "这里还是一张白纸",
  detail = "添加第一条内容，让你的工作从这里开始。",
  action,
}: {
  title?: string;
  detail?: string;
  action?: () => void;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Feather size={27} />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action && (
        <button className="button primary" onClick={action}>
          <Plus size={16} />
          添加内容
        </button>
      )}
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const subtitleId = useId();
  const backdropPress = useRef(false);
  const outside = (x: number, y: number) => {
    const bounds = ref.current?.getBoundingClientRect();
    return (
      !!bounds &&
      (x < bounds.left ||
        x > bounds.right ||
        y < bounds.top ||
        y > bounds.bottom)
    );
  };
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const dialog = ref.current;
    dialog?.showModal();
    dialog
      ?.querySelector<HTMLInputElement>(
        'input:not([type="checkbox"]):not([type="hidden"]),textarea',
      )
      ?.focus();
    return () => {
      dialog?.close();
      if (prev?.isConnected) prev.focus();
    };
  }, []);
  return (
    <dialog
      aria-labelledby={headingId}
      aria-describedby={subtitle ? subtitleId : undefined}
      ref={ref}
      className={"dialog " + (wide ? "wide" : "")}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => {
        backdropPress.current =
          e.button === 0 &&
          e.target === ref.current &&
          outside(e.clientX, e.clientY);
      }}
      onPointerCancel={() => {
        backdropPress.current = false;
      }}
      onClick={(e) => {
        const dismiss =
          backdropPress.current &&
          e.target === ref.current &&
          outside(e.clientX, e.clientY);
        backdropPress.current = false;
        if (dismiss) onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          <h2 id={headingId}>{title}</h2>
          {subtitle && <p id={subtitleId}>{subtitle}</p>}
        </div>
        <button className="icon-button" aria-label="关闭弹窗" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
