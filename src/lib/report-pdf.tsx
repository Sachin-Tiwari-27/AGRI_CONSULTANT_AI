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
import { REPORT_SECTIONS } from "@/lib/report-section-config";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0f172a",
    lineHeight: 1.5,
  },
  // Cover header
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#1a5c38",
    paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: 700, color: "#1a5c38" },
  subtitle: { fontSize: 11, marginTop: 4, color: "#475569" },
  meta: { marginTop: 6, fontSize: 9, color: "#64748b" },
  // Section
  section: { marginTop: 18 },
  sectionTitle: {
    fontSize: 13,
    marginBottom: 6,
    color: "#1a5c38",
    fontWeight: 700,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 3,
  },
  paragraph: { lineHeight: 1.5, marginBottom: 5, fontSize: 10 },
  // Chart table fallback
  chartBox: {
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
  },
  chartTitle: {
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 9,
    fontWeight: 700,
    color: "#334155",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  chartRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  chartLabel: { fontSize: 9, color: "#475569" },
  chartValue: { fontSize: 9, color: "#0f172a", fontWeight: 700 },
  // Placeholder badge
  placeholderBox: {
    marginVertical: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#fbbf24",
    borderStyle: "dashed",
    borderRadius: 4,
    backgroundColor: "#fffbeb",
  },
  placeholderText: { fontSize: 9, color: "#92400e" },
});

// ── Derived section title map ─────────────────────────────────────────────────
const SECTION_TITLES: Record<string, string> = Object.fromEntries(
  REPORT_SECTIONS.map((s) => [s.key, s.title]),
);
const PDF_SECTION_KEYS = REPORT_SECTIONS.map((s) => s.key);

// ── Content parser ────────────────────────────────────────────────────────────
// Splits section content into typed segments so we can render each correctly.

type Segment =
  | { type: "text"; content: string }
  | { type: "chart"; title: string; rows: Array<{ label: string; value: string }> }
  | { type: "placeholder"; label: string };

function parseContent(raw: string): Segment[] {
  const segments: Segment[] = [];
  const chartPattern = /:::chart\n([\s\S]*?)\n:::/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = chartPattern.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push(...parseTextSegment(raw.slice(lastIndex, match.index)));
    }

    // Parse chart JSON → simple label/value rows for PDF table
    try {
      const attrs = JSON.parse(match[1].trim()) as {
        title: string;
        data: string;
        currency: string;
      };
      const dataPoints: Array<{ label: string; value: number }> = JSON.parse(
        attrs.data || "[]",
      );
      const rows = dataPoints.map((d) => ({
        label: d.label,
        value: attrs.currency
          ? `${attrs.currency} ${d.value.toLocaleString()}`
          : d.value.toLocaleString(),
      }));
      segments.push({ type: "chart", title: attrs.title || "Chart", rows });
    } catch {
      // Malformed — skip chart silently
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < raw.length) {
    segments.push(...parseTextSegment(raw.slice(lastIndex)));
  }

  return segments;
}

function parseTextSegment(text: string): Segment[] {
  const segments: Segment[] = [];
  const lines = text.split("\n");
  let buffer: string[] = [];

  for (const line of lines) {
    const ph = line.match(/^⬡ PLACEHOLDER: (.+)$/);
    if (ph) {
      if (buffer.length) {
        segments.push({ type: "text", content: buffer.join("\n") });
        buffer = [];
      }
      segments.push({ type: "placeholder", label: ph[1] });
    } else {
      buffer.push(line);
    }
  }

  if (buffer.length) {
    segments.push({ type: "text", content: buffer.join("\n") });
  }

  return segments;
}

// ── Convert markdown-ish text to plain readable text for PDF ─────────────────
function toPlain(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, "")        // code blocks
    .replace(/`([^`]+)`/g, "$1")           // inline code
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")    // links
    .replace(/^#{1,6}\s+/gm, "")          // headings → plain
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")  // bold+italic
    .replace(/\*\*(.+?)\*\*/g, "$1")      // bold
    .replace(/\*(.+?)\*/g, "$1")          // italic
    .replace(/__(.+?)__/g, "$1")          // bold alt
    .replace(/_([^_]+)_/g, "$1")          // italic alt
    .replace(/^\s*[-*+]\s+/gm, "• ")      // bullet lists
    .replace(/^\s*\d+\.\s+/gm, "")        // numbered lists
    .replace(/^\|.*\|$/gm, "")            // markdown tables (already in PDF tables)
    .replace(/^[-|:\s]+$/gm, "")          // table separators
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── PDF Document component ────────────────────────────────────────────────────
function ReportPdfDocument({
  report,
  projectTitle,
}: {
  report: Report;
  projectTitle: string;
}) {
  const orderedSections = PDF_SECTION_KEYS.filter(
    (k) => report.sections[k as ReportSectionKey],
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Cover header */}
        <View style={styles.header}>
          <Text style={styles.title}>{projectTitle}</Text>
          <Text style={styles.subtitle}>Agricultural Feasibility Report</Text>
          <Text style={styles.meta}>
            Generated on {new Date().toISOString().slice(0, 10)} • Prepared by{" "}
            {report.branding.consultant_name} — {report.branding.company_name}
          </Text>
        </View>

        {orderedSections.map((key) => {
          const section = report.sections[key as ReportSectionKey];
          if (!section?.content) return null;

          const segments = parseContent(section.content);

          return (
            <View key={key} style={styles.section}>
              <Text style={styles.sectionTitle}>
                {SECTION_TITLES[key] || key}
              </Text>

              {segments.map((seg, si) => {
                // ── Plain text ──────────────────────────────────────────────
                if (seg.type === "text") {
                  const plain = toPlain(seg.content);
                  if (!plain) return null;
                  const chunks = plain.split(/\n\n+/).filter(Boolean);
                  return chunks.map((chunk, ci) => (
                    <Text key={`${si}-${ci}`} style={styles.paragraph}>
                      {chunk}
                    </Text>
                  ));
                }

                // ── Chart → data table ──────────────────────────────────────
                if (seg.type === "chart") {
                  return (
                    <View key={si} style={styles.chartBox}>
                      <Text style={styles.chartTitle}>
                        Chart: {seg.title}
                      </Text>
                      {seg.rows.map((row, ri) => (
                        <View
                          key={ri}
                          style={[
                            styles.chartRow,
                            ri === seg.rows.length - 1
                              ? { borderBottomWidth: 0 }
                              : {},
                          ]}
                        >
                          <Text style={styles.chartLabel}>{row.label}</Text>
                          <Text style={styles.chartValue}>{row.value}</Text>
                        </View>
                      ))}
                    </View>
                  );
                }

                // ── Placeholder ─────────────────────────────────────────────
                if (seg.type === "placeholder") {
                  return (
                    <View key={si} style={styles.placeholderBox}>
                      <Text style={styles.placeholderText}>
                        ⬡ PLACEHOLDER: {seg.label}
                      </Text>
                    </View>
                  );
                }

                return null;
              })}
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