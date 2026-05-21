/**
 * AsyncFeedback.tsx — compatibility shim
 *
 * The component previously used here is now replaced by InlineAlert
 * from @/components/ui/status, which has the same API but uses the
 * shared design token system.
 *
 * All existing imports continue to work.
 */

"use client";

import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { InlineAlert } from "@/components/ui/status";

export type FeedbackTone = "success" | "error" | "info";

interface Props {
  message: string;
  tone: FeedbackTone;
  className?: string;
}

export function AsyncFeedback({ message, tone, className }: Props) {
  const icon =
    tone === "success" ? (
      <CheckCircle2 className="size-3.5" />
    ) : tone === "error" ? (
      <AlertTriangle className="size-3.5" />
    ) : (
      <Info className="size-3.5" />
    );

  return (
    <InlineAlert tone={tone} icon={icon} className={className}>
      {message}
    </InlineAlert>
  );
}
