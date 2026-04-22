"use client";

import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

export type FeedbackTone = "success" | "error" | "info";

interface AsyncFeedbackProps {
  message: string;
  tone: FeedbackTone;
  className?: string;
}

const TONE_STYLES: Record<
  FeedbackTone,
  { icon: typeof CheckCircle2; wrapper: string; text: string }
> = {
  success: {
    icon: CheckCircle2,
    wrapper: "bg-green-50 border-green-200",
    text: "text-green-800",
  },
  error: {
    icon: AlertTriangle,
    wrapper: "bg-red-50 border-red-200",
    text: "text-red-800",
  },
  info: {
    icon: Info,
    wrapper: "bg-blue-50 border-blue-200",
    text: "text-blue-800",
  },
};

export function AsyncFeedback({ message, tone, className }: AsyncFeedbackProps) {
  const style = TONE_STYLES[tone];
  const Icon = style.icon;

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${style.wrapper} ${style.text} ${className ?? ""}`}
      role="status"
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
