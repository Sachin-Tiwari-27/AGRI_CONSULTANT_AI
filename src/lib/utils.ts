import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateToken(length = 32): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function parseGPS(coords: string): { lat: number; lon: number } | null {
  const match = coords.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
  if (!match) return null;
  return { lat: parseFloat(match[1]), lon: parseFloat(match[2]) };
}

// ── Single source of truth for currency detection ─────────────────────
// Previously duplicated as detectCurrency() in clarify/route.ts
// and detectCurrencyFromCountry() in report/generate/route.ts — now unified here.
const COUNTRY_CURRENCY_MAP: [RegExp, string][] = [
  [/\boman\b|sultanate of oman/i, "OMR"],
  [/\buae\b|emirates|dubai|abu dhabi|sharjah/i, "AED"],
  [/\bsaudi\b|ksa|saudi arabia/i, "SAR"],
  [/\bqatar\b/i, "QAR"],
  [/\bkuwait\b/i, "KWD"],
  [/\bbahrain\b/i, "BHD"],
  [/\bindia\b/i, "INR"],
  [/\bjordan\b/i, "JOD"],
  [/\begypt\b/i, "EGP"],
  [/\bmorocco\b/i, "MAD"],
  [/\bkenya\b/i, "KES"],
  [/\bghana\b/i, "GHS"],
  [/\bnigeria\b/i, "NGN"],
  [/\buk\b|britain|england|scotland|wales/i, "GBP"],
  [
    /\bfrance\b|\bgermany\b|\bspain\b|\bitaly\b|\bnetherlands\b|\bbelgium\b/i,
    "EUR",
  ],
];

export function detectCurrencyFromCountry(country?: string | null): string {
  if (!country) return "USD";
  for (const [pattern, currency] of COUNTRY_CURRENCY_MAP) {
    if (pattern.test(country)) return currency;
  }
  return "USD";
}

// ── Answer sanitisation ───────────────────────────────────────────────
// Converts raw questionnaire JSONB answers into a flat, safe string record
// suitable for injecting into AI prompts. Strips file-upload objects,
// normalises booleans, joins arrays, truncates long values.

const QUESTION_LABELS: Record<string, string> = {
  q1: "Legal Entity / Company Name",
  q2: "Primary Contact Person",
  q3: "Email / WhatsApp",
  q4: "GPS Coordinates",
  q5: "Total Land Area (sqm)",
  q6: "Primary Water Source",
  q7: "Water Availability (litres/day)",
  q8: "Water Analysis Report Available",
  q9: "Water Analysis Upload",
  q10: "Power Source",
  q11: "Available Power Capacity (KVA)",
  q12: "Internet Connectivity",
  q13: "40ft Container Truck Access",
  q14: "Target Crops",
  q15: "Other Crops",
  q16: "Technology Level",
  q17: "Agro-Tourism Planned",
  q18: "Primary Target Market",
  q19: "On-Site Cold Storage Required",
  q20: "Phase 1 Budget",
  q21: "Target Construction Start Date",
  q22: "Other Requirements / Information",
};

function isFileObject(val: unknown): boolean {
  if (typeof val !== "object" || val === null || Array.isArray(val))
    return false;
  const obj = val as Record<string, unknown>;
  return (
    ("filename" in obj || "file_path" in obj || "path" in obj) &&
    ("mime_type" in obj || "size" in obj || "url" in obj)
  );
}

function scalarise(val: unknown, maxChars = 300): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") return val.slice(0, maxChars);
  if (Array.isArray(val)) {
    return (val as unknown[])
      .filter((v) => typeof v === "string" || typeof v === "number")
      .join(", ")
      .slice(0, maxChars);
  }
  if (isFileObject(val)) {
    const obj = val as Record<string, unknown>;
    const name = obj.filename ?? obj.file_path ?? "uploaded file";
    return `[File uploaded: ${name}]`;
  }
  // Fallback for unexpected object shapes
  try {
    return JSON.stringify(val).slice(0, maxChars);
  } catch {
    return "[complex value]";
  }
}

/**
 * Sanitises raw questionnaire answers from Supabase JSONB into a flat,
 * human-readable labelled record safe for injecting into AI prompts.
 *
 * - Drops file-upload objects (replaces with "[File uploaded: filename]")
 * - Converts booleans to "Yes" / "No"
 * - Joins arrays with comma
 * - Applies human-readable labels (q6 → "Primary Water Source")
 * - Truncates individual values to maxValueChars
 */
export function sanitiseAnswers(
  answers: Record<string, unknown>,
  options: { useLabels?: boolean; maxValueChars?: number } = {},
): Record<string, string> {
  const { useLabels = true, maxValueChars = 300 } = options;
  const result: Record<string, string> = {};

  for (const [key, val] of Object.entries(answers)) {
    const sanitised = scalarise(val, maxValueChars);
    if (!sanitised) continue; // skip empty values
    const label = useLabels ? (QUESTION_LABELS[key] ?? key) : key;
    result[label] = sanitised;
  }

  return result;
}

/**
 * Serialises sanitised answers to a string for AI prompt injection.
 * Applies key filtering if relevantKeys is provided.
 * Hard-truncates the final string to maxChars.
 */
export function serialiseAnswersForPrompt(
  answers: Record<string, unknown>,
  options: {
    relevantKeys?: string[];
    maxChars?: number;
    useLabels?: boolean;
  } = {},
): string {
  const { relevantKeys, maxChars = 2000, useLabels = true } = options;

  let filtered = answers;
  if (relevantKeys && relevantKeys.length > 0) {
    filtered = Object.fromEntries(
      Object.entries(answers).filter(([k]) =>
        relevantKeys.some((rk) => k.toLowerCase().includes(rk.toLowerCase())),
      ),
    );
    // If filtering left nothing, fall back to full set
    if (Object.keys(filtered).length === 0) filtered = answers;
  }

  const sanitised = sanitiseAnswers(filtered, { useLabels });
  const lines = Object.entries(sanitised).map(([k, v]) => `${k}: ${v}`);
  const joined = lines.join("\n");

  if (joined.length <= maxChars) return joined;
  return joined.slice(0, maxChars) + "\n... [truncated]";
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  call_scheduled: "Call Scheduled",
  call_completed: "Call Completed",
  questionnaire_sent: "Questionnaire Sent",
  questionnaire_submitted: "Questionnaire Submitted",
  clarification_sent: "Clarification Sent",
  analysis_running: "Analysis Running",
  report_draft: "Report Draft",
  report_review: "Report In Review",
  report_published: "Report Published",
  payment_pending: "Payment Pending",
  completed: "Completed",
};

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  call_scheduled: "bg-blue-100 text-blue-800",
  call_completed: "bg-blue-100 text-blue-800",
  questionnaire_sent: "bg-amber-100 text-amber-800",
  questionnaire_submitted: "bg-amber-100 text-amber-800",
  clarification_sent: "bg-orange-100 text-orange-800",
  analysis_running: "bg-purple-100 text-purple-800",
  report_draft: "bg-purple-100 text-purple-800",
  report_review: "bg-purple-100 text-purple-800",
  report_published: "bg-green-100 text-green-800",
  payment_pending: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
};

export function getCurrencyByGPS(coords: string): string {
  const parsed = parseGPS(coords);
  if (!parsed) return "OMR";
  const { lat, lon } = parsed;
  if (lat >= 16 && lat <= 27 && lon >= 52 && lon <= 60) return "OMR";
  if (lat >= 22 && lat <= 26 && lon >= 51 && lon <= 57) return "AED";
  if (lat >= 16 && lat <= 33 && lon >= 34 && lon <= 56) return "SAR";
  if (lat >= 24 && lat <= 27 && lon >= 50 && lon <= 52) return "QAR";
  if (lat >= 28 && lat <= 31 && lon >= 46 && lon <= 49) return "KWD";
  if (lat >= 25 && lat <= 27 && lon >= 50 && lon <= 51) return "BHD";
  return "USD";
}
