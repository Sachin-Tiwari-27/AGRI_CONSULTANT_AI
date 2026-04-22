import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const MAX_FILE_SIZE = 10 * 1024 * 1024

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createServiceClient()

  const formData = await req.formData()
  const file = formData.get('file')
  const questionId = String(formData.get('question_id') || '')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }

  if (!questionId) {
    return NextResponse.json({ error: 'Missing question_id' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 })
  }

  const { data: submission } = await supabase
    .from('questionnaire_submissions')
    .select('id, token, submitted_at, project_id')
    .eq('token', token)
    .single()

  if (!submission) {
    return NextResponse.json({ error: 'Questionnaire not found' }, { status: 404 })
  }

  if (submission.submitted_at) {
    return NextResponse.json({ error: 'Questionnaire already submitted' }, { status: 410 })
  }

  const safeName = sanitizeFileName(file.name)
  const ext = safeName.includes('.') ? safeName.split('.').pop() : 'bin'
  const uploadPath = `${submission.project_id}/${submission.id}/${questionId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('uploads')
    .upload(uploadPath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: 'Failed to upload file', details: uploadError.message }, { status: 500 })
  }

  const { data: signed } = await supabase.storage
    .from('uploads')
    .createSignedUrl(uploadPath, 60 * 60 * 24 * 14)

  return NextResponse.json({
    success: true,
    file: {
      question_id: questionId,
      filename: safeName,
      path: uploadPath,
      url: signed?.signedUrl || null,
      size: file.size,
      mime_type: file.type || 'application/octet-stream',
    },
  })
}
