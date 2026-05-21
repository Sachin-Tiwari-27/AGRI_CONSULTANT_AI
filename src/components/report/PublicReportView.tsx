"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import {
  CheckCircle,
  FileText,
  TrendingUp,
  ShieldCheck,
  BarChart3,
  Info,
  Lock,
  Unlock,
  Download,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { REPORT_SECTIONS } from "@/lib/report-section-config";
import type { Report, ReportSectionKey } from "@/types";
import type { LucideIcon } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const SECTION_ICONS: Record<string, LucideIcon> = {
  executive_summary: CheckCircle,
  introduction: FileText,
  project_overview: FileText,
  market_analysis: BarChart3,
  target_market: BarChart3,
  competitive_analysis: TrendingUp,
  business_model: TrendingUp,
  revenue_streams: TrendingUp,
  marketing_sales_plan: TrendingUp,
  proposed_machinery: ShieldCheck,
  proposed_timelines: FileText,
  quality_assurance: ShieldCheck,
  financial_projection: TrendingUp,
  risk_mitigation: ShieldCheck,
  benefits_impact: CheckCircle,
  csr: FileText,
  conclusion: FileText,
};

const SECTION_TITLES: Record<string, string> = Object.fromEntries(
  REPORT_SECTIONS.map((s) => [s.key, s.title]),
);

const REPORT_SECTION_KEYS = REPORT_SECTIONS.map((s) => s.key);
const FREE_SECTIONS = ["executive_summary"];
const CHART_COLORS = ["#1a5c38", "#2e7d52", "#4cb57a", "#7dd3b0", "#a8e6ca"];

interface Props {
  report: Report;
  paid: boolean;
  projectId: string;
}

export function PublicReportView({
  report,
  paid: initialPaid,
  projectId,
}: Props) {
  const [paid, setPaid] = useState(initialPaid);
  const [paying, setPaying] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const sectionKeys = REPORT_SECTION_KEYS.filter(
    (k) => report.sections[k as ReportSectionKey],
  );
  const cropChartData =
    report.financial_model?.crops?.map((c) => ({
      name: c.name,
      revenue: c.annual_revenue,
    })) || [];
  const costPieData = report.financial_model
    ? [
        { name: "CAPEX", value: report.financial_model.capex_total },
        { name: "Pre-startup", value: report.financial_model.pre_startup_cost },
        { name: "Growing", value: report.financial_model.growing_cost_annual },
        {
          name: "Manpower",
          value: report.financial_model.manpower_cost_annual,
        },
      ].filter((d) => d.value > 0)
    : [];

  async function handleUnlock() {
    setPaying(true);
    try {
      const res = await fetch("/api/payment/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) setPaid(true);
    } finally {
      setPaying(false);
    }
  }

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/report/download?projectId=${projectId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Download failed");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      alert("Unable to generate a download link right now.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-10">
      {/* Report cover */}
      <div
        className="rounded-2xl p-10 text-white shadow-xl relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${report.branding.primary_color}, ${report.branding.secondary_color})`,
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <Badge className="bg-white/20 text-white border-white/30 mb-4">
              Feasibility Study
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              Agricultural Project Synthesis
            </h1>
            <p className="text-white/75 text-sm">
              Prepared by {report.branding.consultant_name} —{" "}
              {report.branding.company_name}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md px-5 py-4 rounded-xl border border-white/20 flex-shrink-0 text-center">
            <p className="text-[10px] uppercase font-bold opacity-70 mb-1">
              Access
            </p>
            <p className="text-sm font-bold flex items-center justify-center gap-2">
              {paid ? (
                <>
                  <Unlock className="size-4 text-brand-300" /> Full access
                </>
              ) : (
                <>
                  <Lock className="size-4 text-amber-300" /> Preview
                </>
              )}
            </p>
            {paid && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3 border-white/40 text-white hover:bg-white/10"
                onClick={downloadPdf}
                loading={downloading}
              >
                <Download className="size-4" /> Download PDF
              </Button>
            )}
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: "Total CAPEX",
            value: formatCurrency(report.financial_model.capex_total),
            icon: BarChart3,
          },
          {
            label: "Annual Revenue",
            value: formatCurrency(report.financial_model.total_annual_revenue),
            icon: TrendingUp,
          },
          {
            label: "Payback Period",
            value: `${report.financial_model.payback_years} years`,
            icon: Info,
          },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="flex items-center gap-4 py-5">
              <div className="p-2.5 rounded-xl bg-brand-50">
                <Icon className="size-5 text-brand-700" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <p className="text-xl font-bold text-foreground mt-0.5">
                  {value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Report sections */}
      <div className="space-y-10">
        {sectionKeys.map((key) => {
          const section = report.sections[key as ReportSectionKey]!;
          const Icon = SECTION_ICONS[key] || Info;
          const isLocked = !paid && !FREE_SECTIONS.includes(key);

          return (
            <section key={key} className="scroll-mt-20">
              {/* Section heading */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 ${
                    isLocked
                      ? "bg-muted text-muted-foreground/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isLocked ? (
                    <Lock className="size-5" />
                  ) : (
                    <Icon className="size-5" />
                  )}
                </div>
                <h2
                  className={`text-xl font-bold tracking-tight ${
                    isLocked ? "text-muted-foreground/40" : "text-foreground"
                  }`}
                >
                  {SECTION_TITLES[key]}
                </h2>
                <div className="flex-1 h-px bg-border hidden md:block ml-4" />
              </div>

              {isLocked ? (
                <div className="relative">
                  <div className="blur-sm select-none pointer-events-none opacity-50">
                    <MarkdownRenderer
                      content={section.content.slice(0, 400) + "…"}
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/70 to-background flex flex-col items-center justify-end pb-4">
                    <div className="text-center">
                      <Lock className="size-5 text-muted-foreground/60 mx-auto mb-2" />
                      <p className="text-xs font-medium text-muted-foreground">
                        Section locked
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <MarkdownRenderer content={section.content} />
              )}

              {/* Financial charts inline */}
              {key === "financial_projection" && !isLocked && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
                  {cropChartData.length > 0 && (
                    <Card>
                      <CardContent className="pt-5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-3">
                          Crop Revenue Breakdown
                        </p>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={cropChartData}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#f1f5f9"
                            />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <YAxis
                              tick={{ fontSize: 10 }}
                              tickFormatter={(v) =>
                                `${(Number(v) / 1000).toFixed(0)}K`
                              }
                            />
                            <Tooltip
                              formatter={(v) => formatCurrency(v as number)}
                            />
                            <Bar
                              dataKey="revenue"
                              fill="#1a5c38"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                  {costPieData.length > 0 && (
                    <Card>
                      <CardContent className="pt-5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-3">
                          Investment Breakdown
                        </p>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={costPieData}
                              cx="50%"
                              cy="50%"
                              outerRadius={70}
                              dataKey="value"
                            >
                              {costPieData.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v) => formatCurrency(v as number)}
                            />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Pay-to-unlock sticky bar */}
      {!paid && (
        <div className="sticky bottom-0 bg-card border-t border-border shadow-lg px-6 py-4 rounded-t-2xl">
          <div className="max-w-lg mx-auto flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm">
                Unlock the full report
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get access to {sectionKeys.length - FREE_SECTIONS.length} more
                sections including financial projections, market analysis, and
                risk assessment.
              </p>
            </div>
            <Button
              onClick={handleUnlock}
              loading={paying}
              className="flex-shrink-0"
            >
              <Unlock className="size-4" /> Unlock full report
            </Button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-8 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} {report.branding.company_name}. All
          rights reserved.
          <br />
          Confidential Business Intelligence Report.
        </p>
      </footer>
    </div>
  );
}
