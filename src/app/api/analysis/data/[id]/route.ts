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
    .select("id, consultant_id, region, country, gps_coordinates, crop_types")
    .eq("id", id)
    .single();

  if (!project || project.consultant_id !== user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [marketResearch, climateData] = await Promise.all([
    researchMarket(
      project.crop_types || [],
      project.region || "",
      project.country || "",
    ),
    (() => {
      const gps = parseGPS(project.gps_coordinates || "");
      return gps
        ? fetchClimateData(gps.lat, gps.lon)
        : Promise.resolve(
            "GPS coordinates not provided — enter them in the project details to get climate data.",
          );
    })(),
  ]);

  return NextResponse.json({ marketResearch, climateData });
}
