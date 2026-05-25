"use client";

/**
 * src/components/report/RegenerateModal.tsx
 *
 *
 * Replaces the single "Regenerate" button with a split button:
 *   [Regenerate] [▾]  →  dropdown opens this modal
 *
 * The modal lets consultants type one-time instructions that are sent
 * with THIS regeneration only (not saved as persistent section instructions).
 *
 * For persistent instructions, use SectionInstructionsPanel instead.
 */

import { useState } from "react";
import { RefreshCw, Sparkles, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  sectionTitle: string;
  /** Called with optional one-time instructions */
  onRegenerate: (oneTimeInstructions?: string) => Promise<void>;
}

export function RegenerateButton({ sectionTitle, onRegenerate }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleStandard() {
    setLoading(true);
    setDropdownOpen(false);
    try {
      await onRegenerate();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Split button */}
      <div className="flex items-center">
        <button
          onClick={handleStandard}
          disabled={loading}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg border border-border",
            "text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
            "transition-colors",
            loading && "opacity-60 cursor-not-allowed",
          )}
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          {loading ? "Regenerating…" : "Regenerate"}
        </button>

        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            disabled={loading}
            className={cn(
              "flex items-center px-1.5 py-1.5 rounded-r-lg border border-l-0 border-border",
              "text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
              "transition-colors",
              loading && "opacity-60 cursor-not-allowed",
            )}
          >
            <ChevronDown className="size-3.5" />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute top-full right-0 mt-1 w-52 bg-card border border-border rounded-xl shadow-lg py-1 z-50">
                <button
                  onClick={handleStandard}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                >
                  <RefreshCw className="size-3.5 text-muted-foreground" />
                  Regenerate (standard)
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    setModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                >
                  <Sparkles className="size-3.5 text-violet-500" />
                  Regenerate with instructions…
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Instructions modal */}
      {modalOpen && (
        <RegenerateModal
          sectionTitle={sectionTitle}
          onClose={() => setModalOpen(false)}
          onConfirm={async (instructions) => {
            setModalOpen(false);
            setLoading(true);
            try {
              await onRegenerate(instructions);
            } finally {
              setLoading(false);
            }
          }}
        />
      )}
    </>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  sectionTitle: string;
  onClose: () => void;
  onConfirm: (instructions: string) => Promise<void>;
}

function RegenerateModal({ sectionTitle, onClose, onConfirm }: ModalProps) {
  const [instructions, setInstructions] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    setConfirming(true);
    try {
      await onConfirm(instructions.trim());
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-violet-100">
              <Sparkles className="size-4 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Regenerate with instructions
              </p>
              <p className="text-[11px] text-muted-foreground truncate max-w-[240px]">
                {sectionTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Add one-time instructions for this regeneration. These won't be
            saved permanently — use the{" "}
            <span className="font-medium text-violet-600">
              section instructions panel
            </span>{" "}
            for persistent guidance.
          </p>

          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={5}
            autoFocus
            placeholder="e.g. Shorten this section to under 300 words. Focus on the summer price premium advantage. Remove the UAE export paragraph — not applicable for this project."
            className="w-full px-3 py-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
          />

          <p className="text-[10px] text-muted-foreground">
            {instructions.length} characters
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg",
              "bg-violet-700 text-white hover:bg-violet-600 transition-colors",
              confirming && "opacity-60 cursor-not-allowed",
            )}
          >
            <RefreshCw
              className={cn("size-3.5", confirming && "animate-spin")}
            />
            {confirming ? "Regenerating…" : "Regenerate now"}
          </button>
        </div>
      </div>
    </div>
  );
}