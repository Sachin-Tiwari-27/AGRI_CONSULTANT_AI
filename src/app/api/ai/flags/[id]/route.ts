import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

const VALID_STATUSES = ['pending', 'accepted', 'dismissed'] as const
type FlagWithProjectRelation = {
  projects?: { consultant_id?: string } | Array<{ consultant_id?: string }>
}

function getConsultantIdFromJoin(flag: FlagWithProjectRelation): string | undefined {
  const relation = flag.projects
  if (Array.isArray(relation)) return relation[0]?.consultant_id
  return relation?.consultant_id
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { status } = await req.json()
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data: existingFlag } = await supabase
    .from('ai_flags')
    .select('id, projects!inner(consultant_id)')
    .eq('id', id)
    .single()

  if (!existingFlag) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const consultantId = getConsultantIdFromJoin(existingFlag)
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

  const consultantId = getConsultantIdFromJoin(existingFlag)
  if (consultantId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('ai_flags').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
