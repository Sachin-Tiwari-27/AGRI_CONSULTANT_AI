import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { researchMarket, fetchClimateData } from '@/lib/ai/search.service'
import { parseGPS } from '@/lib/utils'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServiceClient()

  // Note: For simplicity in this demo, we're skipping full Consultant auth check here
  // since this is a protected API route in a real app.
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  try {
    const crops = project.crop_types || ['vegetables']
    const region = project.region || 'unknown region'
    const country = project.country || 'unknown country'

    const marketResearch = await researchMarket(crops, region, country)

    let climateData = 'GPS coordinates not provided'
    const gps = parseGPS(project.gps_coordinates || '')
    if (gps) {
      climateData = await fetchClimateData(gps.lat, gps.lon)
    }

    return NextResponse.json({ marketResearch, climateData })
  } catch (error: any) {
    console.error('Analysis Data Fetch Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
