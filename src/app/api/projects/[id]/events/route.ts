import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Verify the consultant owns this project
  const { data: project } = await supabase
    .from('projects')
    .select('id, consultant_id')
    .eq('id', id)
    .eq('consultant_id', user.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: events, error } = await supabase
    .from('project_events')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(events ?? [])
}
