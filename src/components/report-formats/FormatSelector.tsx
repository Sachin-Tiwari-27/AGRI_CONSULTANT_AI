"use client";

// ── src/components/report-formats/FormatSelector.tsx ─────────────────────────
// Dropdown to select a report format for a project.
// Used in CreateProjectModal and in ProjectWorkspace (to switch format).

import { useState, useEffect } from "react";
import {
  LayoutTemplate,
  ChevronDown,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ReportFormat } from "@/types/report-format";

interface Props {
  value: string | null; // selected format id
  onChange: (id: string) => void;
  disabled?: boolean;
  className?: string;
  showWarning?: boolean; // show warning if switching on existing report
}

export function FormatSelector({
  value,
  onChange,
  disabled,
  className = "",
  showWarning,
}: Props) {
  const [formats, setFormats] = useState<ReportFormat[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/report-formats")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFormats(data);
          // Auto-select default if no value set
          if (!value) {
            const def = data.find((f: ReportFormat) => f.is_default);
            if (def) onChange(def.id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selected = formats.find((f) => f.id === value);

  if (loading) {
    return (
      <div
        className={`h-9 flex items-center gap-2 px-3 rounded-lg border border-input bg-background text-xs text-muted-foreground ${className}`}
      >
        <Loader2 className="size-3.5 animate-spin" />
        Loading formats…
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 h-9 px-3 rounded-lg border border-input bg-background text-xs text-foreground hover:border-brand-300 transition-colors disabled:opacity-50"
      >
        <LayoutTemplate className="size-3.5 text-muted-foreground flex-shrink-0" />
        <span className="flex-1 text-left truncate">
          {selected ? selected.name : "Select format…"}
        </span>
        {selected?.is_default && (
          <Badge variant="green" className="text-[9px] py-0 flex-shrink-0">
            Default
          </Badge>
        )}
        <ChevronDown className="size-3.5 text-muted-foreground flex-shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-full min-w-[280px] bg-card border border-border rounded-xl shadow-lg py-1 z-50 max-h-64 overflow-y-auto">
            {formats.map((format) => (
              <button
                key={format.id}
                type="button"
                onClick={() => {
                  onChange(format.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground truncate">
                      {format.name}
                    </p>
                    {format.is_default && (
                      <Badge
                        variant="green"
                        className="text-[9px] py-0 flex-shrink-0"
                      >
                        Default
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format.sections?.length ?? 0} sections
                  </p>
                </div>
                {value === format.id && (
                  <Check className="size-3.5 text-brand-600 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {showWarning && value && (
        <div className="flex items-start gap-1.5 mt-1.5 text-[11px] text-amber-700">
          <AlertCircle className="size-3 flex-shrink-0 mt-0.5" />
          Changing the format will clear any existing report draft sections.
        </div>
      )}
    </div>
  );
}
