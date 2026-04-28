import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

const VALID_STATUSES = ['pending', 'accepted', 'dismissed'] as const

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { status } = await req.json()
  if (!VALID_STATUSES.includes(status as any)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Verify ownership via join
  const { data: existingFlag } = await supabase
    .from('ai_flags')
    .select('id, project_id, projects!inner(consultant_id)')
    .eq('id', id)
    .single()

  if (!existingFlag) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const projects = existingFlag.projects as any;
  const consultantId = Array.isArray(projects) ? projects[0]?.consultant_id : projects?.consultant_id;

  if (consultantId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: updated, error } = await supabase
    .from('ai_flags')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ flag: updated })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: existingFlag } = await supabase
    .from('ai_flags')
    .select('id, projects!inner(consultant_id)')
    .eq('id', id)
    .single()

  if (!existingFlag) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const projects = existingFlag.projects as any;
  const consultantId = Array.isArray(projects) ? projects[0]?.consultant_id : projects?.consultant_id;

  if (consultantId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('ai_flags').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
