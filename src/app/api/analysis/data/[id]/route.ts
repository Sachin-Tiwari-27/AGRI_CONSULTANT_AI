import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { researchMarket, fetchClimateData } from "@/lib/ai/search.service";
import { parseGPS } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, consultant_id, region, country, gps_coordinates, crop_types, market_research, climate_data",
    )
    .eq("id", id)
    .single();

  if (!project || project.consultant_id !== user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── Serve from cache if already stored ────────────────────────────
  if (project.market_research && project.climate_data) {
    return NextResponse.json({
      marketResearch: project.market_research,
      climateData: project.climate_data,
      cached: true,
    });
  }

  // ── Otherwise call AI and persist the results ─────────────────────
  const [marketResearch, climateData] = await Promise.all([
    project.market_research
      ? Promise.resolve(project.market_research)
      : researchMarket(
          project.crop_types || [],
          project.region || "",
          project.country || "",
        ),
    (() => {
      if (project.climate_data) return Promise.resolve(project.climate_data);
      const gps = parseGPS(project.gps_coordinates || "");
      return gps
        ? fetchClimateData(gps.lat, gps.lon)
        : Promise.resolve(
            "GPS coordinates not provided — enter them in the project details to get climate data.",
          );
    })(),
  ]);

  // Persist so next load is instant
  await supabase
    .from("projects")
    .update({ market_research: marketResearch, climate_data: climateData })
    .eq("id", id);

  return NextResponse.json({ marketResearch, climateData, cached: false });
}

// ── Allow the consultant to force a refresh ────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id, consultant_id")
    .eq("id", id)
    .single();

  if (!project || project.consultant_id !== user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await supabase
    .from("projects")
    .update({ market_research: null, climate_data: null })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
