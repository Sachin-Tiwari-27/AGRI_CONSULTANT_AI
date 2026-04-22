import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { projectId } = await req.json()

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('projects')
    .update({ status: 'completed' })
    .eq('id', projectId)

  if (error) {
    return NextResponse.json({ error: 'Failed to unlock report' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
