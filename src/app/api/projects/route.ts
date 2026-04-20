import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/projects — list consultant's projects
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: projects, error } = await supabase
    .from('projects')
    .select('*, reports(status, updated_at)')
    .eq('consultant_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(projects)
}

// POST /api/projects — create new project
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const {
    title, client_name, client_email,
    region, country, gps_coordinates, land_size_sqm,
    crop_types, project_type, climate_zone,
    budget_range, experience_level, target_market,
    funding_status, consultant_notes,
    meet_scheduled_at, meet_link,
  } = body

  if (!title || !client_name || !client_email)
    return NextResponse.json({ error: 'title, client_name, and client_email are required' }, { status: 400 })

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      consultant_id: user.id,
      title, client_name, client_email,
      region, country, gps_coordinates, land_size_sqm,
      crop_types, project_type, climate_zone,
      budget_range, experience_level, target_market,
      funding_status, consultant_notes,
      meet_scheduled_at, meet_link,
      status: meet_scheduled_at ? 'call_scheduled' : 'call_scheduled',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(project, { status: 201 })
}
