"use client";

/**
 * Toast system built on Sonner.
 *
 * Drop-in replacement for the previous custom Toast.tsx.
 * Import { toast } from "@/components/ui/toast" anywhere — same API.
 * Mount <Toaster /> once in the root layout or ProjectWorkspace.
 */

import { Toaster as SonnerToaster } from "sonner";
import { toast as sonnerToast } from "sonner";

/* ── Re-export toast with the same API as before ─────────────────── */
export const toast = Object.assign(
  (message: string, opts?: { description?: string }) =>
    sonnerToast(message, opts),
  {
    success: (message: string, opts?: { description?: string }) =>
      sonnerToast.success(message, opts),
    error: (message: string, opts?: { description?: string }) =>
      sonnerToast.error(message, opts),
    info: (message: string, opts?: { description?: string }) =>
      sonnerToast.info(message, opts),
    warning: (message: string, opts?: { description?: string }) =>
      sonnerToast.warning(message, opts),
    promise: sonnerToast.promise,
    dismiss: sonnerToast.dismiss,
  },
);

/* ── Toaster (mount once) ─────────────────────────────────────────── */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group font-sans text-sm border border-border shadow-lg rounded-xl",
          title: "font-medium text-foreground",
          description: "text-xs text-muted-foreground mt-0.5",
          success:
            "!border-emerald-200 !bg-emerald-50 [&_[data-icon]]:text-emerald-600",
          error: "!border-red-200 !bg-red-50 [&_[data-icon]]:text-red-600",
          info: "!border-blue-200 !bg-blue-50 [&_[data-icon]]:text-blue-600",
          warning:
            "!border-amber-200 !bg-amber-50 [&_[data-icon]]:text-amber-600",
          actionButton:
            "!bg-brand-800 !text-white text-xs font-medium rounded-md px-2.5 py-1",
          cancelButton:
            "!bg-muted !text-muted-foreground text-xs font-medium rounded-md px-2.5 py-1",
          closeButton: "!border-border !bg-background hover:!bg-muted",
        },
      }}
      expand
      gap={8}
    />
  );
}

/**
 * Legacy ToastProvider — kept for backward-compatibility with
 * ProjectWorkspace which mounts <ToastProvider />.
 * Just renders <Toaster />.
 */
export function ToastProvider() {
  return <Toaster />;
}
