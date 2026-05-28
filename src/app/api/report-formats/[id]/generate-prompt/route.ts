// ── src/app/api/report-formats/[id]/generate-prompt/route.ts ────────────────
// POST /api/report-formats/[id]/generate-prompt
//
// Given a section's prompt_hint and metadata, calls AI to generate a full
// prompt template. Returns the prompt for consultant review — does NOT save
// automatically. The consultant reviews and saves via PATCH /api/report-formats/[id].

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callAI } from "@/lib/ai/ai.service";
import type { ReportFormatSection } from "@/types/report-format";

type Params = { params: Promise<{ id: string }> };

const PROMPT_GENERATOR_TEMPLATE = `
You are an expert agricultural consultant and technical writer.

A consultant is building a custom report section for their feasibility reports.
Your job is to write a high-quality AI prompt template that will generate excellent
content for this section.

SECTION DETAILS:
- Title: {{section_title}}
- Type: {{section_type}}
- Target word count: {{word_count_target}} words
- Consultant's instructions: {{prompt_hint}}

REPORT CONTEXT (these variables will be available at generation time):
- Project title: {{project_title}}
- Location: {{region}}, {{country}}
- Crops: {{crop_types}}
- Currency: {{currency}}
- Project type: {{project_type}}
- Client name: {{client_name}}
- Consultant firm: {{company_name}}
- Consultant name: {{consultant_name}}
- Technical analysis: {{technical_analysis}}
- Market research: {{market_research}}
- Financial model JSON: {{financial_model_json}}
- Questionnaire answers: {{questionnaire_answers}}
- Consultant research notes: {{consultant_research_notes}}
- Climate data: {{climate_data}}

TASK:
Write a detailed, professional prompt template for this section.

Rules:
1. Use {{variable_name}} syntax for all dynamic variables — use ONLY variables from the list above
2. The prompt must instruct the AI to write exactly {{word_count_target}} words (±20%)
3. Structure the output format clearly — use STRUCTURE TO FOLLOW: with --- delimiters
4. For financial sections: always instruct "use EXACT figures from financial model — do not invent numbers"
5. For market sections: always instruct "use specific data from market_research variable"
6. Always end with: {{consultant_instructions}}
7. Write in the same style and quality as professional feasibility report prompts
8. Be specific about what to include and in what order

Return ONLY the prompt template text. No explanation, no preamble, no code blocks.
The output is the prompt itself.
`;

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // Verify ownership
  const { data: format } = await supabase
    .from("report_formats")
    .select("id, consultant_id")
    .eq("id", id)
    .eq("consultant_id", user.id)
    .single();

  if (!format)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { section } = (await req.json()) as { section: ReportFormatSection };
  if (!section)
    return NextResponse.json({ error: "section required" }, { status: 400 });

  if (!section.prompt_hint?.trim()) {
    return NextResponse.json(
      { error: "prompt_hint is required to generate a prompt" },
      { status: 400 },
    );
  }

  const prompt = PROMPT_GENERATOR_TEMPLATE.replaceAll(
    "{{section_title}}",
    section.title,
  )
    .replaceAll("{{section_type}}", section.section_type)
    .replaceAll("{{word_count_target}}", String(section.word_count_target))
    .replaceAll("{{prompt_hint}}", section.prompt_hint);

  let generatedPrompt: string;
  try {
    const resp = await callAI({
      task: "clarification_check" as any, // reuse a generic task slot — the prompt above fully controls behaviour
      variables: {},
      maxTokens: 2000,
    });
    // We bypassed the prompt store by injecting above — do the call properly:
    const { gateway } = await import("@/lib/ai/gateway");
    const result = await gateway.execute({
      task: "generate_section_prompt",
      prompt,
      maxTokens: 2000,
    });
    generatedPrompt = result.content.trim();
  } catch (err) {
    console.error("[generate-prompt] AI call failed:", err);
    return NextResponse.json(
      { error: "AI prompt generation failed. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ prompt: generatedPrompt });
}
