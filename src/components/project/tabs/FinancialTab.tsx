"use client";

import { useState, useEffect } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/status";
import { FinancialModelEditor } from "@/components/analysis/FinancialModelEditor";
import type { Project, Report, FinancialModel } from "@/types";

interface Props {
  project: Project;
  report: Report | null;
  currency: string;
}

export function FinancialTab({ project, report, currency }: Props) {
  const [loading, setLoading] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [fmData, setFmData] = useState<{
    financialModel: FinancialModel | null;
    notes: string;
    source: "override" | "report_draft" | "none" | "ai_estimate";
  } | null>(null);

  const hasSubmissions = !!(project as any).questionnaire_submissions?.filter(
    (s: any) => s.submitted_at,
  ).length;

  /* Load on mount */
  useEffect(() => {
    loadFinancialModel();
  }, [project.id]);

  async function loadFinancialModel() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/financial-model`);
      if (res.ok) setFmData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function generateEstimate() {
    setEstimating(true);
    try {
      const res = await fetch(
        `/api/projects/${project.id}/financial-model/estimate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const data = await res.json();

      if (res.status === 409) {
        toast.error("A financial model already exists. Edit it below.");
        setEstimating(false);
        await loadFinancialModel();
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to generate estimate");

      setFmData({
        financialModel: data.financialModel,
        notes: "",
        source: "ai_estimate",
      });
      toast.success(
        "AI financial estimate generated — review and refine below",
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to generate financial estimate");
    } finally {
      setEstimating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeModel = fmData?.financialModel ?? report?.financial_model ?? null;

  if (!activeModel) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <EmptyState
          icon={<Wand2 className="size-10" />}
          title="No financial model yet"
          description="Generate an AI estimate from your questionnaire data, then review and refine the figures before generating the full report."
          action={
            <Button
              onClick={generateEstimate}
              loading={estimating}
              disabled={!hasSubmissions}
            >
              <Wand2 className="size-4" />
              {hasSubmissions
                ? "Generate AI Financial Estimate"
                : "Collect questionnaire data first"}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <FinancialModelEditor
        projectId={project.id}
        currency={currency}
        initialModel={activeModel}
        initialNotes={fmData?.notes ?? ""}
        source={fmData?.source ?? "none"}
        onSaved={(saved, savedNotes) => {
          setFmData((prev) => ({
            ...prev!,
            financialModel: saved,
            notes: savedNotes,
            source: "override",
          }));
        }}
      />
    </div>
  );
}
