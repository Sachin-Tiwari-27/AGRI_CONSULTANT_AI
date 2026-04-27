import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { Report, ReportSectionKey } from "@/types";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#0f172a",
  },
  header: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 8,
  },
  title: { fontSize: 22, fontWeight: 700, color: "#14532d" },
  subtitle: { fontSize: 11, marginTop: 4, color: "#475569" },
  meta: { marginTop: 4, fontSize: 9, color: "#64748b" },
  section: { marginTop: 14 },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 6,
    color: "#14532d",
    fontWeight: 700,
  },
  paragraph: { lineHeight: 1.35, marginBottom: 4 },
});

const SECTION_TITLES: Record<string, string> = {
  executive_summary: "Executive Summary",
  market_analysis: "Market Analysis",
  business_model: "Business Model",
  financial_projection: "Financial Projection",
  risk_mitigation: "Risk & Mitigation",
  technical_analysis: "Technical Analysis",
  conclusion: "Conclusion",
};

function markdownToPlainText(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/^[#>*\-]+\s?/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ReportPdfDocument({
  report,
  projectTitle,
}: {
  report: Report;
  projectTitle: string;
}) {
  const orderedSections = Object.keys(SECTION_TITLES).filter(
    (k) => report.sections[k as ReportSectionKey],
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{projectTitle}</Text>
          <Text style={styles.subtitle}>Agricultural Feasibility Report</Text>
          <Text style={styles.meta}>
            Generated on {new Date().toISOString().slice(0, 10)} • Prepared by{" "}
            {report.branding.consultant_name}
          </Text>
        </View>

        {orderedSections.map((key) => {
          const section = report.sections[key as ReportSectionKey];
          if (!section) return null;

          const plain = markdownToPlainText(section.content || "");
          const chunks = plain.split(/\n\n+/).filter(Boolean);

          return (
            <View key={key} style={styles.section}>
              <Text style={styles.sectionTitle}>
                {SECTION_TITLES[key] || key}
              </Text>
              {chunks.map((paragraph, index) => (
                <Text key={`${key}-${index}`} style={styles.paragraph}>
                  {paragraph}
                </Text>
              ))}
            </View>
          );
        })}
      </Page>
    </Document>
  );
}

export async function generateReportPdfBuffer(
  report: Report,
  projectTitle: string,
): Promise<Buffer> {
  return renderToBuffer(
    <ReportPdfDocument report={report} projectTitle={projectTitle} />,
  );
}
