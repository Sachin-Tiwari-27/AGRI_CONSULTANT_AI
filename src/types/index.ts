// ── User & Auth ─────────────────────────────────────────────────────

export type UserRole = "consultant" | "client" | "admin";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  // Contact
  avatar_url?: string;
  company_name?: string;
  phone?: string;
  // Extended (pkg5)
  bio?: string;
  website?: string;
  linkedin_url?: string;
  logo_url?: string;
  // Branding defaults (pkg5)
  brand_primary_color?: string;
  brand_secondary_color?: string;
  brand_footer_text?: string;
  // Payment
  payment_preference?: "always_upfront" | "project_basis";
  default_currency?: string;
  default_amount?: number;
  // Stripe (pkg5)
  stripe_connected?: boolean;
  stripe_account_id?: string;
  created_at: string;
}

// ── Project ──────────────────────────────────────────────────────────

export type ProjectStatus =
  | "call_scheduled"
  | "call_completed"
  | "questionnaire_sent"
  | "questionnaire_submitted"
  | "clarification_sent"
  | "analysis_running"
  | "report_draft"
  | "report_review"
  | "report_published"
  | "payment_pending"
  | "completed";

export interface Project {
  id: string;
  consultant_id: string;
  client_id?: string;
  client_email: string;
  client_name: string;
  title: string;
  status: ProjectStatus;
  region?: string;
  country?: string;
  gps_coordinates?: string;
  land_size_sqm?: number;
  crop_types?: string[];
  project_type?:
    | "greenhouse_turnkey"
    | "expansion"
    | "feasibility_only"
    | "agro_tourism";
  climate_zone?: "arid" | "semi_arid" | "tropical" | "temperate" | "humid";
  budget_range?: string;
  experience_level?: "first_time" | "1_3_years" | "3_6_years" | "6_plus_years";
  target_market?: string[];
  funding_status?: string;
  consultant_notes?: string;
  // pkg1
  call_brief?: CallBrief | null;
  transcript_url?: string | null;
  // pkg2
  financial_model_override?: FinancialModel | null;
  financial_model_notes?: string | null;
  // pkg4
  report_price?: number;
  report_price_set_at?: string | null;
  payment_collected?: boolean;
  payment_collected_at?: string | null;
  payment_collected_note?: string | null;
  // Meeting
  meet_link?: string;
  meet_scheduled_at?: string;
  meet_recording_url?: string;
  currency?: string;
  report_published_at?: string;
  created_at: string;
  updated_at: string;
}

// ── Call Brief ───────────────────────────────────────────────────────

export interface CallBrief {
  client_name?: string;
  region?: string;
  country?: string;
  land_size_sqm?: number | null;
  crop_types?: string[];
  project_type?: string;
  budget_range?: string;
  experience_level?: string;
  target_market?: string[];
  funding_status?: string;
  key_concerns?: string[];
  agro_tourism_interest?: boolean;
  water_source_mentioned?: string;
  power_source_mentioned?: string;
  consultant_notes?: string;
  extracted_at?: string;
}

// ── Questionnaire ────────────────────────────────────────────────────

export type QuestionType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "multiselect"
  | "boolean"
  | "file_upload"
  | "gps"
  | "date"
  | "currency";

export interface QuestionOption {
  value: string;
  label: string;
}

export interface ConditionalRule {
  question_id: string;
  operator: "equals" | "not_equals" | "contains" | "is_true";
  value: string;
}

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  placeholder?: string;
  helper_text?: string;
  options?: QuestionOption[];
  conditions?: ConditionalRule[];
  section_id: string;
  order: number;
  ai_suggested?: boolean;
  deleted?: boolean;
}

export interface QuestionSection {
  id: string;
  title: string;
  description?: string;
  order: number;
}

export interface QuestionnaireTemplate {
  id: string;
  consultant_id: string;
  name: string;
  description?: string;
  sections: QuestionSection[];
  questions: Question[];
  created_at: string;
}

export interface QuestionnaireSubmission {
  id: string;
  project_id: string;
  template_id: string;
  token: string;
  client_email: string;
  answers: Record<string, unknown>;
  uploaded_files: UploadedFile[];
  submitted_at?: string;
  created_at: string;
}

export interface UploadedFile {
  id: string;
  question_id: string;
  filename: string;
  url: string;
  size: number;
  mime_type: string;
}

export interface QuestionnaireSendLog {
  id: string;
  project_id: string;
  submission_id: string | null;
  round: number;
  recipient: string;
  sent_by: string | null;
  is_resend: boolean;
  sent_at: string;
}

// ── Project Events ───────────────────────────────────────────────────

export type ProjectEventType =
  | "project_created"
  | "call_scheduled"
  | "call_completed"
  | "transcript_uploaded"
  | "questionnaire_personalised"
  | "questionnaire_sent"
  | "questionnaire_resent"
  | "client_submitted"
  | "ai_gap_check"
  | "flag_actioned"
  | "follow_up_sent"
  | "financial_model_edited"
  | "report_generated"
  | "report_published"
  | "payment_initiated"
  | "payment_received"
  | "note_added";

export type ProjectEventActor = "consultant" | "client" | "system" | "ai";

export interface ProjectEvent {
  id: string;
  project_id: string;
  event_type: ProjectEventType;
  actor: ProjectEventActor;
  title: string;
  detail?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ── AI ───────────────────────────────────────────────────────────────

export type AITask =
  | "clarification_check"
  | "followup_questions"
  | "technical_analysis"
  | "climate_analysis"
  | "financial_projection"
  | "market_research"
  | "report_executive_summary"
  | "report_market_analysis"
  | "report_business_model"
  | "report_financial_projection"
  | "report_risk_mitigation"
  | "report_conclusion"
  | "call_brief_summary"
  | "personalize_questionnaire";

export type AIProvider = "openrouter" | "anthropic" | "openai" | "google";

export interface AIRequest {
  task: AITask;
  variables: Record<string, string>;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIResponse {
  content: string;
  tokensUsed: number;
  model: string;
  provider: AIProvider;
  durationMs: number;
}

export interface AIFlag {
  id: string;
  field_name: string;
  reason: string;
  suggested_question: string;
  severity: "required" | "recommended";
  status: "pending" | "accepted" | "dismissed";
  is_manual?: boolean;
}

export interface PersonalisationDiff {
  add: Array<{
    section_id: string;
    label: string;
    type: QuestionType;
    required: boolean;
    reason: string;
  }>;
  annotate: Record<string, string>;
  reorder: Record<string, number>;
  covering_note: string;
}

// ── Report ───────────────────────────────────────────────────────────

export type ReportSectionKey =
  | "executive_summary"
  | "introduction"
  | "objectives"
  | "project_overview"
  | "market_analysis"
  | "business_model"
  | "revenue_streams"
  | "infrastructure"
  | "timelines"
  | "quality_assurance"
  | "financial_projection"
  | "risk_mitigation"
  | "benefits"
  | "csr"
  | "conclusion"
  | "context_market_data"
  | "context_climate_data"
  | "technical_analysis";

export interface ReportSection {
  key: ReportSectionKey;
  title: string;
  content: string;
  ai_generated: boolean;
  last_edited_at: string;
  approved: boolean;
}

export interface FinancialModel {
  capex_total: number;
  pre_startup_cost: number;
  crops: CropProjection[];
  agro_tourism_revenue?: number;
  total_annual_revenue: number;
  growing_cost_annual: number;
  manpower_cost_annual: number;
  ebitda: number;
  ebitda_margin: number;
  payback_years: number;
  assumptions?: string[];
}

export interface CropProjection {
  name: string;
  area_sqm: number;
  yield_tonnes: number;
  price_per_kg: number;
  annual_revenue: number;
}

export interface Report {
  id: string;
  project_id: string;
  sections: Partial<Record<ReportSectionKey, ReportSection>>;
  financial_model: FinancialModel;
  status: "draft" | "review" | "published";
  branding: ReportBranding;
  pdf_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ReportBranding {
  consultant_name: string;
  company_name: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
}

// ── Notification ─────────────────────────────────────────────────────

export interface Notification {
  id: string;
  user_id: string;
  type:
    | "questionnaire_submitted"
    | "clarification_needed"
    | "report_ready"
    | "payment_received";
  message: string;
  project_id?: string;
  read: boolean;
  created_at: string;
}
