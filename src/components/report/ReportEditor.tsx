"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/FormFields";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { createClient } from "@/lib/supabase/client";
import {
  CheckCircle,
  Edit3,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Lock,
  Send,
} from "lucide-react";
import type { Report, ReportSectionKey } from "@/types";

const SECTION_TITLES: Record<string, string> = {
  executive_summary: "Executive Summary",
  market_analysis: "Market Analysis",
  business_model: "Business Model",
  financial_projection: "Financial Projection",
  risk_mitigation: "Risk & Mitigation",
  technical_analysis: "Technical Analysis",
  conclusion: "Conclusion",
};

interface Props {
  report: Report;
  projectId: string;
  onUpdate: (report: Report) => void;
}

export function ReportEditor({ report, projectId, onUpdate }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>(
    "executive_summary",
  );
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const sectionKeys = Object.keys(SECTION_TITLES).filter(
    (k) => report.sections[k as ReportSectionKey],
  );

  async function saveSection(key: string) {
    setSaving(true);
    const updated = {
      ...report.sections,
      [key]: {
        ...report.sections[key as ReportSectionKey],
        content: editContent,
        ai_generated: false,
        last_edited_at: new Date().toISOString(),
      },
    };
    await supabase
      .from("reports")
      .update({ sections: updated })
      .eq("project_id", projectId);
    onUpdate({ ...report, sections: updated as typeof report.sections });
    setEditingSection(null);
    setSaving(false);
  }

  async function approveSection(key: string) {
    const updated = {
      ...report.sections,
      [key]: { ...report.sections[key as ReportSectionKey], approved: true },
    };
    await supabase
      .from("reports")
      .update({ sections: updated })
      .eq("project_id", projectId);
    onUpdate({ ...report, sections: updated as typeof report.sections });
  }

  async function regenerateSection(key: string) {
    setRegenerating(key);
    try {
      await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, sectionsToGenerate: [key] }),
      });
      // Refetch report
      const { data } = await supabase
        .from("reports")
        .select("*")
        .eq("project_id", projectId)
        .single();
      if (data) onUpdate(data as Report);
    } finally {
      setRegenerating(null);
    }
  }

  async function publishReport() {
    setSaving(true);
    try {
      const res = await fetch("/api/report/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error("Failed to publish");

      onUpdate({ ...report, status: "published" });
    } catch (err) {
      alert("Failed to publish report. Please check your connection.");
    } finally {
      setSaving(false);
    }
  }

  async function resendNotification() {
    setSaving(true);
    try {
      const res = await fetch("/api/report/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error("Failed to send");
      alert("Notification email resent to client.");
    } catch (err) {
      alert("Failed to resend email.");
    } finally {
      setSaving(false);
    }
  }

  const allApproved = sectionKeys.every(
    (k) => report.sections[k as ReportSectionKey]?.approved,
  );

  return (
    <div className="space-y-3">
      {/* Publish bar */}
      <Card>
        <CardBody className="py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {report.status === "published"
                  ? "Report published"
                  : "Review all sections before publishing"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {
                  sectionKeys.filter(
                    (k) => report.sections[k as ReportSectionKey]?.approved,
                  ).length
                }{" "}
                of {sectionKeys.length} sections approved
              </p>
            </div>
            {report.status === "published" ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                  <Lock className="w-4 h-4" /> Published
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resendNotification()}
                  loading={saving}
                >
                  <Send className="w-4 h-4" /> Resend email
                </Button>
              </div>
            ) : (
              <Button
                onClick={publishReport}
                disabled={!allApproved}
                loading={saving}
                size="sm"
              >
                Publish report
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Sections */}
      {sectionKeys.map((key) => {
        const section = report.sections[key as ReportSectionKey]!;
        const isExpanded = expandedSection === key;
        const isEditing = editingSection === key;

        return (
          <Card key={key}>
            <CardHeader className="py-3">
              <button
                className="flex items-center justify-between w-full text-left"
                onClick={() => setExpandedSection(isExpanded ? null : key)}
              >
                <div className="flex items-center gap-3">
                  {section.approved ? (
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                  )}
                  <span className="font-medium text-sm text-slate-900">
                    {SECTION_TITLES[key]}
                  </span>
                  {section.ai_generated && (
                    <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                      <Sparkles className="w-3 h-3" /> AI draft
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </CardHeader>

            {isExpanded && (
              <CardBody>
                {isEditing ? (
                  <div className="space-y-3">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[300px] font-mono text-xs"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveSection(key)}
                        loading={saving}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingSection(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <MarkdownRenderer content={section.content} />
                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingSection(key);
                          setEditContent(section.content);
                        }}
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={regenerating === key}
                        onClick={() => regenerateSection(key)}
                      >
                        <RefreshCw className="w-3 h-3" /> Regenerate
                      </Button>
                      {!section.approved && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approveSection(key)}
                          className="ml-auto border-green-300 text-green-700 hover:bg-green-50"
                        >
                          <CheckCircle className="w-3 h-3" /> Approve
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardBody>
            )}
          </Card>
        );
      })}
    </div>
  );
}
