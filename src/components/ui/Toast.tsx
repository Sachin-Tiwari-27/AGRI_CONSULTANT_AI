"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

// ── Singleton event bus ───────────────────────────────────────────────
type Listener = (toast: Toast) => void;
const listeners: Set<Listener> = new Set();

export function toast(message: string, tone: ToastTone = "info") {
  const t: Toast = { id: crypto.randomUUID(), message, tone };
  listeners.forEach((fn) => fn(t));
}
toast.success = (msg: string) => toast(msg, "success");
toast.error = (msg: string) => toast(msg, "error");
toast.info = (msg: string) => toast(msg, "info");

// ── Provider (mount once in layout or ProjectWorkspace) ───────────────
const TONE_CONFIG = {
  success: {
    icon: CheckCircle2,
    bg: "bg-green-900",
    border: "border-green-700",
    text: "text-green-100",
    iconColor: "text-green-400",
    bar: "bg-green-500",
  },
  error: {
    icon: AlertTriangle,
    bg: "bg-red-900",
    border: "border-red-700",
    text: "text-red-100",
    iconColor: "text-red-400",
    bar: "bg-red-500",
  },
  info: {
    icon: Info,
    bg: "bg-slate-800",
    border: "border-slate-600",
    text: "text-slate-100",
    iconColor: "text-blue-400",
    bar: "bg-blue-500",
  },
};

const AUTO_DISMISS_MS = 5000;

function ToastItem({
  toast: t,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const cfg = TONE_CONFIG[t.tone];
  const Icon = cfg.icon;
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(t.id), 300);
  }, [t.id, onDismiss]);

  useEffect(() => {
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [dismiss]);

  return (
    <div
      className={`relative flex items-start gap-3 w-80 rounded-xl border shadow-2xl px-4 py-3 overflow-hidden
        ${cfg.bg} ${cfg.border} ${cfg.text}
        transition-all duration-300 ${exiting ? "opacity-0 translate-x-full" : "opacity-100 translate-x-0"}`}
      role="alert"
    >
      {/* Auto-dismiss progress bar */}
      <div
        className={`absolute bottom-0 left-0 h-0.5 ${cfg.bar} animate-[shrink_5s_linear_forwards]`}
        style={{
          animation: `shrink ${AUTO_DISMISS_MS}ms linear forwards`,
        }}
      />
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.iconColor}`} />
      <p className="text-sm flex-1 leading-snug">{t.message}</p>
      <button
        onClick={dismiss}
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (t: Toast) => {
      setToasts((prev) => {
        // Max 4 toasts visible at once — drop oldest
        const next = [...prev, t];
        return next.length > 4 ? next.slice(next.length - 4) : next;
      });
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <>
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </>
  );
}
