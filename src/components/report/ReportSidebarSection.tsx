"use client";

// Changes:
//   - Tighter layout: 56px min-height instead of 72px
//   - Status dot replaced with cleaner left-border accent
//   - Word count shown as pill only when near/over target
//   - Placeholder count only shown when > 0
//   - Preview text shows first sentence only (shorter)
//   - Instruction dot moved to right of title, not separate column
//   - imported_from_docx badge

import { useMemo } from "react";
import {
  CheckCircle,
  Loader2,
  FileText,
  AlertTriangle,
  Sparkles,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportSectionKey } from "@/types";

interface SectionData {
  content?: string;
  approved?: boolean;
  ai_generated?: boolean;
  imported_from_docx?: boolean;
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

// First sentence only for preview
function firstSentence(text: string): string {
  const stripped = stripMarkdown(text);
  const match = stripped.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : stripped.slice(0, 80);
}

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

  const preview = useMemo(
    () => (content ? firstSentence(content) : ""),
    [content],
  );
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
  const isImported = (section as any)?.imported_from_docx;

  // Status icon
  const StatusIcon = isStreaming
    ? () => <Loader2 className="size-3 text-brand-500 animate-spin" />
    : isApproved
      ? () => <CheckCircle className="size-3 text-brand-500" />
      : isImported
        ? () => <Upload className="size-3 text-blue-500" />
        : isAiDraft
          ? () => <Sparkles className="size-3 text-violet-400" />
          : hasContent
            ? () => <FileText className="size-3 text-muted-foreground/50" />
            : () => (
                <div className="size-3 rounded-full border-2 border-border/60" />
              );

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg px-3 py-2 transition-all duration-100 group",
        "border-l-2 mb-px",
        isActive
          ? "bg-brand-50 border-l-brand-600"
          : hasContent
            ? "hover:bg-muted/60 border-l-transparent hover:border-l-brand-200"
            : "hover:bg-muted/40 border-l-transparent opacity-60 hover:opacity-80",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Status icon */}
        <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center">
          <StatusIcon />
        </div>

        {/* Title */}
        <span
          className={cn(
            "text-[11px] font-medium leading-snug flex-1 truncate",
            isActive
              ? "text-brand-800"
              : hasContent
                ? "text-foreground"
                : "text-muted-foreground",
          )}
        >
          {title}
        </span>

        {/* Right badges */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasInstruction && (
            <span
              className="size-1.5 rounded-full bg-violet-400"
              title="Has consultant instructions"
            />
          )}
          {placeholderCount > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1">
              <AlertTriangle className="size-2" />
              {placeholderCount}
            </span>
          )}
        </div>
      </div>

      {/* Preview — only when active or has content */}
      {hasContent && preview && (
        <p className="text-[10px] text-muted-foreground/70 leading-snug mt-0.5 truncate pl-5">
          {preview}
        </p>
      )}

      {/* Word count — only show when content exists */}
      {hasContent && wordCount > 0 && (
        <div className="flex items-center gap-1 mt-0.5 pl-5">
          <span className="text-[9px] text-muted-foreground/50 tabular-nums">
            {wordCount}w
          </span>
        </div>
      )}
    </button>
  );
}
