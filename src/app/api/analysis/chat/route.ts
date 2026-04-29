import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { projectId, message, context, history = [] } = await req.json();

  if (!projectId || !message) {
    return NextResponse.json(
      { error: "projectId and message required" },
      { status: 400 },
    );
  }

  // Verify ownership
  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, consultant_id, title, region, country, crop_types, project_type, budget_range",
    )
    .eq("id", projectId)
    .eq("consultant_id", user.id)
    .single();

  if (!project)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Fetch consultant notes to give AI context
  const { data: notes } = await supabase
    .from("consultant_notes")
    .select("category, title, content")
    .eq("project_id", projectId)
    .limit(10);

  const notesContext = notes?.length
    ? `\n\nConsultant Research Notes:\n${notes.map((n) => `[${n.category}] ${n.title}: ${n.content}`).join("\n")}`
    : "";

  const systemPrompt = `You are an expert agricultural consultant assistant specializing in controlled-environment agriculture (CEA), greenhouse farming, and agribusiness feasibility.

You are supporting a consultant working on this project:
- Project: ${project.title}
- Location: ${project.region}, ${project.country}
- Crop types: ${(project.crop_types || []).join(", ")}
- Project type: ${project.project_type || "greenhouse"}
- Budget: ${project.budget_range || "not specified"}
${context?.currency ? `- Currency: ${context.currency}` : ""}

${context?.market_data ? `Live Market Research Data:\n${context.market_data}` : ""}
${context?.climate_data ? `\nClimate Data (monthly averages):\n${context.climate_data}` : ""}
${notesContext}

Your role:
- Answer questions about crop production, market prices, climate conditions, and project feasibility
- Provide specific, actionable insights relevant to ${project.country} and this region
- Use actual data from the context when available
- Flag risks and opportunities specific to this project
- Be concise but thorough — this is professional consultancy research
- Format responses with markdown for clarity (use tables for comparisons, bullet points for lists)
- When you don't have specific data, clearly state that and provide reasonable estimates with caveats

Always tailor your response to ${project.country}'s agricultural context, local market conditions, and climate.`;

  // Build message history for context
  const messages: ChatMessage[] = [
    ...history.slice(-8).map((m: ChatMessage) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: message },
  ];
  // ── Provider configuration ────────────────────────────────────────────
  const PROVIDER_CONFIG: Record<
    AIProvider,
    { baseURL: string; apiKeyEnv: string; defaultModel: string }
  > = {
    openrouter: {
      baseURL: "https://openrouter.ai/api/v1",
      apiKeyEnv: "OPENROUTER_API_KEY",
      defaultModel: "minimax/minimax-m2.5:free",
    },
    anthropic: {
      baseURL: "https://api.anthropic.com/v1",
      apiKeyEnv: "ANTHROPIC_API_KEY",
      defaultModel: "claude-3-5-haiku-latest",
    },
    openai: {
      baseURL: "https://api.openai.com/v1",
      apiKeyEnv: "OPENAI_API_KEY",
      defaultModel: "gpt-4o-mini",
    },
    google: {
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKeyEnv: "GOOGLE_AI_API_KEY",
      defaultModel: "gemini-2.0-flash",
    },
  };
  // Load provider config
  const providerName =
    (process.env.AI_PROVIDER as AIProvider | undefined) || "openrouter";
  const config = PROVIDER_CONFIG[providerName];
  if (!config) {
    return NextResponse.json({ error: "Invalid AI_PROVIDER" }, { status: 400 });
  }

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    console.warn(`[Chat] API key missing for provider: ${providerName}`);
    return NextResponse.json(
      { error: "AI provider not configured" },
      { status: 500 },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (providerName === "openrouter") {
    headers["HTTP-Referer"] =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    headers["X-Title"] = "AgriAI Platform";
  }

  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.defaultModel,
      max_tokens: 1500,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("[Chat] AI error:", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }

  const data = await response.json();
  const reply =
    data.choices?.[0]?.message?.content ||
    "Sorry, I couldn't generate a response.";

  return NextResponse.json({ reply });
}
