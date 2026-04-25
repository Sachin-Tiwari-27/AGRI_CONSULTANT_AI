// ── User & Auth ─────────────────────────────────────────────────────

export type UserRole = 'consultant' | 'client' | 'admin'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url?: string
  company_name?: string
  phone?: string
  // Payment Preferences
  payment_preference?: 'always_upfront' | 'project_basis'
  default_currency?: string
  default_amount?: number
  created_at: string
}

// ── Project ──────────────────────────────────────────────────────────

export type ProjectStatus =
  | 'call_scheduled'
  | 'call_completed'
  | 'questionnaire_sent'
  | 'questionnaire_submitted'
  | 'clarification_sent'
  | 'analysis_running'
  | 'report_draft'
  | 'report_review'
  | 'report_published'
  | 'payment_pending'
  | 'completed'

export interface Project {
  id: string
  consultant_id: string
  client_id?: string
  client_email: string
  client_name: string
  title: string
  status: ProjectStatus
  // structured call brief — seeds all downstream AI
  region?: string
  country?: string
  gps_coordinates?: string
  land_size_sqm?: number
  crop_types?: string[]
  project_type?: 'greenhouse_turnkey' | 'expansion' | 'feasibility_only' | 'agro_tourism'
  climate_zone?: 'arid' | 'semi_arid' | 'tropical' | 'temperate' | 'humid'
  budget_range?: string
  experience_level?: 'first_time' | '1_3_years' | '3_6_years' | '6_plus_years'
  target_market?: string[]
  funding_status?: string
  consultant_notes?: string
  // meeting
  meet_link?: string
  meet_scheduled_at?: string
  meet_recording_url?: string
  // report
  report_price?: number
  currency?: string
  report_published_at?: string
  // metadata
  created_at: string
  updated_at: string
}

// ── Questionnaire ────────────────────────────────────────────────────

export type QuestionType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'file_upload'
  | 'gps'
  | 'date'
  | 'currency'

export interface QuestionOption {
  value: string
  label: string
}

export interface ConditionalRule {
  question_id: string
  operator: 'equals' | 'not_equals' | 'contains' | 'is_true'
  value: string
}

export interface Question {
  id: string
  label: string
  type: QuestionType
  required: boolean
  placeholder?: string
  helper_text?: string
  options?: QuestionOption[]
  conditions?: ConditionalRule[]  // show this question only if conditions met
  section_id: string
  order: number
}

export interface QuestionSection {
  id: string
  title: string
  description?: string
  order: number
}

export interface QuestionnaireTemplate {
  id: string
  consultant_id: string
  name: string
  description?: string
  sections: QuestionSection[]
  questions: Question[]
  created_at: string
}

export interface QuestionnaireSubmission {
  id: string
  project_id: string
  template_id: string
  token: string              // unique link token for client — no login needed
  client_email: string
  answers: Record<string, unknown>
  uploaded_files: UploadedFile[]
  submitted_at?: string
  created_at: string
}

export interface UploadedFile {
  id: string
  question_id: string
  filename: string
  url: string
  size: number
  mime_type: string
}

// ── AI ───────────────────────────────────────────────────────────────

export type AITask =
  | 'clarification_check'
  | 'followup_questions'
  | 'technical_analysis'
  | 'climate_analysis'
  | 'financial_projection'
  | 'market_research'
  | 'report_executive_summary'
  | 'report_market_analysis'
  | 'report_business_model'
  | 'report_financial_projection'
  | 'report_risk_mitigation'
  | 'report_conclusion'
  | 'call_brief_summary'

export type AIProvider = 'openrouter' | 'anthropic' | 'openai' | 'google'

export interface AIRequest {
  task: AITask
  variables: Record<string, string>
  maxTokens?: number
  stream?: boolean
}

export interface AIResponse {
  content: string
  tokensUsed: number
  model: string
  provider: AIProvider
  durationMs: number
}

export interface AIFlag {
  id: string
  field_name: string
  reason: string
  suggested_question: string
  severity: 'required' | 'recommended'
  status: 'pending' | 'accepted' | 'dismissed'
}

// ── Report ───────────────────────────────────────────────────────────

export type ReportSectionKey =
  | 'executive_summary'
  | 'introduction'
  | 'objectives'
  | 'project_overview'
  | 'market_analysis'
  | 'business_model'
  | 'revenue_streams'
  | 'infrastructure'
  | 'timelines'
  | 'quality_assurance'
  | 'financial_projection'
  | 'risk_mitigation'
  | 'benefits'
  | 'csr'
  | 'conclusion'
  | 'context_market_data'
  | 'context_climate_data'
  | 'technical_analysis'
export interface ReportSection {
  key: ReportSectionKey
  title: string
  content: string           // markdown content
  ai_generated: boolean
  last_edited_at: string
  approved: boolean
}

export interface FinancialModel {
  capex_total: number
  pre_startup_cost: number
  crops: CropProjection[]
  agro_tourism_revenue?: number
  total_annual_revenue: number
  growing_cost_annual: number
  manpower_cost_annual: number
  ebitda: number
  ebitda_margin: number
  payback_years: number
}

export interface CropProjection {
  name: string
  area_sqm: number
  yield_tonnes: number
  price_per_kg: number
  annual_revenue: number
}

export interface Report {
  id: string
  project_id: string
  sections: Partial<Record<ReportSectionKey, ReportSection>>
  financial_model: FinancialModel
  status: 'draft' | 'review' | 'published'
  branding: ReportBranding
  pdf_url?: string
  created_at: string
  updated_at: string
}

export interface ReportBranding {
  consultant_name: string
  company_name: string
  logo_url?: string
  primary_color: string
  secondary_color: string
}

// ── Notification ─────────────────────────────────────────────────────

export interface Notification {
  id: string
  user_id: string
  type: 'questionnaire_submitted' | 'clarification_needed' | 'report_ready' | 'payment_received'
  message: string
  project_id?: string
  read: boolean
  created_at: string
}
