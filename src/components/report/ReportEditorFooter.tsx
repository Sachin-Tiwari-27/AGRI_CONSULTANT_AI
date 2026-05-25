"use client";

/**
 * src/components/report/ReportEditorFooter.tsx
 *
 * Section word count targets with under/over warnings.
 * Autosave indicator.
 *
 * Drop this inside ReportEditor below the editor content area.
 * Wire up autosave by calling triggerAutosave() in the editor's onChange.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Save, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportSectionKey } from "@/types";

// ── Word count targets per section ────────────────────────────────────────────
// Based on the Zaher Farm report section lengths.
// [min, max] — warnings fire at <70% of min or >130% of max.

const WORD_TARGETS: Partial<Record<ReportSectionKey, [number, number]>> = {
  executive_summary:    [400, 600],
  introduction:         [350, 500],
  project_overview:     [200, 400],
  market_analysis:      [400, 600],
  target_market:        [250, 400],
  competitive_analysis: [300, 500],
  business_model:       [500, 750],
  revenue_streams:      [200, 400],
  marketing_sales_plan: [300, 500],
  proposed_machinery:   [400, 600],
  proposed_timelines:   [300, 500],
  quality_assurance:    [200, 350],
  financial_projection: [400, 600],
  risk_mitigation:      [300, 500],
  benefits_impact:      [300, 500],
  csr:                  [200, 350],
  conclusion:           [200, 350],
};

interface WordCountStatusProps {
  wordCount: number;
  sectionKey: ReportSectionKey;
}

export function WordCountStatus({ wordCount, sectionKey }: WordCountStatusProps) {
  const targets = WORD_TARGETS[sectionKey];

  if (!targets || wordCount === 0) {
    return (
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {wordCount} words
      </span>
    );
  }

  const [min, max] = targets;
  const tooShort = wordCount < min * 0.7;
  const tooLong = wordCount > max * 1.3;
  const nearTarget = !tooShort && !tooLong;

  return (
    <div className="flex items-center gap-1.5">
      {tooShort && <AlertTriangle className="size-3 text-amber-500" />}
      {tooLong && <AlertTriangle className="size-3 text-amber-500" />}
      {nearTarget && <CheckCircle className="size-3 text-brand-500" />}

      <span
        className={cn(
          "text-[10px] tabular-nums font-medium",
          tooShort && "text-amber-600",
          tooLong && "text-amber-600",
          nearTarget && "text-muted-foreground",
        )}
      >
        {wordCount} / {min}–{max} words
      </span>

      {tooShort && (
        <span className="text-[10px] text-amber-600">
          (add ~{min - wordCount} more)
        </span>
      )}
      {tooLong && (
        <span className="text-[10px] text-amber-600">
          (trim ~{wordCount - max})
        </span>
      )}
    </div>
  );
}

// ── Autosave hook ─────────────────────────────────────────────────────────────

interface UseAutosaveOptions {
  /** The save function — called after the debounce delay */
  onSave: () => Promise<void>;
  /** Debounce delay in ms. Default 30 000 (30 seconds) */
  delay?: number;
  /** Set to true while the user is actively editing */
  isEditing: boolean;
}

export function useAutosave({ onSave, delay = 30_000, isEditing }: UseAutosaveOptions) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAutosave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!isEditing) return;
      setSaving(true);
      try {
        await onSave();
        setLastSaved(new Date());
      } finally {
        setSaving(false);
      }
    }, delay);
  }, [onSave, delay, isEditing]);

  // Clear on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { triggerAutosave, lastSaved, saving };
}

// ── Autosave indicator component ──────────────────────────────────────────────

interface AutosaveIndicatorProps {
  lastSaved: Date | null;
  saving: boolean;
}

export function AutosaveIndicator({ lastSaved, saving }: AutosaveIndicatorProps) {
  const [displayTime, setDisplayTime] = useState("");

  useEffect(() => {
    if (!lastSaved) return;

    function update() {
      if (!lastSaved) return;
      const diffSec = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
      if (diffSec < 10) setDisplayTime("just now");
      else if (diffSec < 60) setDisplayTime(`${diffSec}s ago`);
      else if (diffSec < 3600) setDisplayTime(`${Math.floor(diffSec / 60)}m ago`);
      else setDisplayTime(lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }

    update();
    const interval = setInterval(update, 10_000);
    return () => clearInterval(interval);
  }, [lastSaved]);

  if (!lastSaved && !saving) return null;

  return (
    <div className="flex items-center gap-1.5">
      {saving ? (
        <>
          <Save className="size-3 text-muted-foreground animate-pulse" />
          <span className="text-[10px] text-muted-foreground">Saving…</span>
        </>
      ) : (
        <>
          <Clock className="size-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            Autosaved {displayTime}
          </span>
        </>
      )}
    </div>
  );
}

// ── Combined footer bar ───────────────────────────────────────────────────────
// Drop this at the bottom of the editor content area in ReportEditor.

interface EditorFooterProps {
  wordCount: number;
  charCount: number;
  sectionKey: ReportSectionKey;
  lastSaved: Date | null;
  saving: boolean;
}

export function ReportEditorFooter({
  wordCount,
  charCount,
  sectionKey,
  lastSaved,
  saving,
}: EditorFooterProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30 rounded-b-xl">
      {/* Left: word count with target */}
      <WordCountStatus wordCount={wordCount} sectionKey={sectionKey} />

      {/* Right: char count + autosave */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground tabular-nums hidden sm:block">
          {charCount} chars
        </span>
        <AutosaveIndicator lastSaved={lastSaved} saving={saving} />
      </div>
    </div>
  );
}