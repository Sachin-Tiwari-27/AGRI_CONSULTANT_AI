"use client";

/**
 * src/components/report/ReportSidebarSection.tsx
 *
 * A single section row in the report sidebar, with:
 *   - Status dot (generated / approved / streaming / empty)
 *   - Section title
 *   - 1-line content preview (first ~60 chars, markdown stripped) — fix 3a
 *   - Placeholder count chip
 *   - Word count
 *
 * Usage: replace the existing section list items in your ReportTab sidebar
 * with this component.
 */

import { useMemo } from "react";
import {
  CheckCircle,
  Loader2,
  FileText,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportSectionKey } from "@/types";

interface SectionData {
  content?: string;
  approved?: boolean;
  ai_generated?: boolean;
}

interface Props {
  sectionKey: ReportSectionKey;
  title: string;
  section?: SectionData;
  isActive: boolean;
  isStreaming: boolean;
  hasInstruction: boolean;
  onClick: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/:::chart[\s\S]*?:::/g, "[Chart]")
    .replace(/⬡ PLACEHOLDER: .+/g, "")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\|.+/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function countWords(text: string): number {
  return text
    .replace(/[^a-zA-Z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

function countPlaceholders(text: string): number {
  return (text.match(/⬡ PLACEHOLDER/g) || []).length;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReportSidebarSection({
  sectionKey,
  title,
  section,
  isActive,
  isStreaming,
  hasInstruction,
  onClick,
}: Props) {
  const content = section?.content || "";

  const preview = useMemo(() => {
    if (!content) return "";
    const stripped = stripMarkdown(content);
    return stripped.length > 65 ? stripped.slice(0, 65) + "…" : stripped;
  }, [content]);

  const wordCount = useMemo(
    () => (content ? countWords(content) : 0),
    [content],
  );

  const placeholderCount = useMemo(
    () => (content ? countPlaceholders(content) : 0),
    [content],
  );

  const hasContent = !!content;
  const isApproved = section?.approved;
  const isAiDraft = section?.ai_generated && !isApproved;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg transition-colors group",
        isActive
          ? "bg-brand-50 border border-brand-200"
          : "hover:bg-muted/60 border border-transparent",
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Status icon */}
        <div className="mt-0.5 flex-shrink-0">
          {isStreaming ? (
            <Loader2 className="size-3.5 text-brand-600 animate-spin" />
          ) : isApproved ? (
            <CheckCircle className="size-3.5 text-brand-600" />
          ) : isAiDraft ? (
            <Sparkles className="size-3.5 text-violet-500" />
          ) : hasContent ? (
            <FileText className="size-3.5 text-muted-foreground" />
          ) : (
            <div className="size-3.5 rounded-full border-2 border-border" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "text-xs font-medium leading-snug truncate",
                isActive ? "text-brand-800" : "text-foreground",
                !hasContent && "text-muted-foreground",
              )}
            >
              {title}
            </span>

            {/* Consultant instruction dot */}
            {hasInstruction && (
              <span
                className="size-1.5 rounded-full bg-violet-500 flex-shrink-0"
                title="Has consultant instructions"
              />
            )}
          </div>

          {/* Preview text — fix 3a */}
          {preview && (
            <p className="text-[10px] text-muted-foreground/70 leading-snug mt-0.5 truncate">
              {preview}
            </p>
          )}

          {/* Meta row: word count + placeholder chips */}
          {hasContent && (
            <div className="flex items-center gap-2 mt-1">
              {wordCount > 0 && (
                <span className="text-[9px] text-muted-foreground/60 tabular-nums">
                  {wordCount}w
                </span>
              )}
              {placeholderCount > 0 && (
                <span className="flex items-center gap-0.5 text-[9px] text-amber-600 font-medium">
                  <AlertTriangle className="size-2.5" />
                  {placeholderCount}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}