import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Creates a Google Calendar event with Meet link
// Uses OAuth2 — consultant must have connected Google account
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { projectId, scheduledAt, durationMinutes = 45 } = await req.json()

  const { data: project } = await supabase
    .from('projects').select('*').eq('id', projectId).single()
  if (!project || project.consultant_id !== user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get Google OAuth token from Supabase session
  const { data: { session } } = await supabase.auth.getSession()
  const googleToken = session?.provider_token

  if (!googleToken) {
    // Return a link for the consultant to connect Google
    return NextResponse.json({
      error: 'google_not_connected',
      connectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google`,
    }, { status: 400 })
  }

  const startTime = new Date(scheduledAt)
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000)

  // Create Google Calendar event with Meet conference
  const eventPayload = {
    summary: `AgriAI Intro Call — ${project.title}`,
    description: `Initial consultation for ${project.title}.\n\nPlease join at the scheduled time.`,
    start: { dateTime: startTime.toISOString(), timeZone: 'Asia/Muscat' },
    end: { dateTime: endTime.toISOString(), timeZone: 'Asia/Muscat' },
    attendees: [
      { email: project.client_email, displayName: project.client_name },
      { email: user.email! },
    ],
    conferenceData: {
      createRequest: {
        requestId: `agriai-${projectId}-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 60 },
        { method: 'popup', minutes: 15 },
      ],
    },
  }

  const calRes = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${googleToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    }
  )

  if (!calRes.ok) {
    const err = await calRes.text()
    console.error('[Calendar] Google API error:', err)
    return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 })
  }

  const calEvent = await calRes.json()
  const meetLink = calEvent.conferenceData?.entryPoints?.find(
    (ep: { entryPointType: string }) => ep.entryPointType === 'video'
  )?.uri || calEvent.hangoutLink

  // Store meet link and schedule time on project
  await supabase.from('projects').update({
    meet_link: meetLink,
    meet_scheduled_at: scheduledAt,
    status: 'call_scheduled',
  }).eq('id', projectId)

  return NextResponse.json({
    success: true,
    meetLink,
    calendarEventId: calEvent.id,
    scheduledAt,
  })
}
