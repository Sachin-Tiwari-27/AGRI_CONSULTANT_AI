import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM || 'AgriAI Platform <noreply@agriai.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function sendQuestionnaireInvite(params: {
  clientEmail: string
  clientName: string
  consultantName: string
  projectTitle: string
  token: string
}) {
  const link = `${APP_URL}/q/${params.token}`
  await resend.emails.send({
    from: FROM,
    to: params.clientEmail,
    subject: `Your project questionnaire is ready — ${params.projectTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1A5C38;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">AgriAI Platform</h1>
        </div>
        <div style="padding:32px;background:#fff;border:1px solid #e2e8f0;border-radius:0 0 8px 8px">
          <p>Hi ${params.clientName},</p>
          <p>${params.consultantName} has prepared a project questionnaire for <strong>${params.projectTitle}</strong>.</p>
          <p>Please complete the questionnaire at your convenience. It takes approximately 10–15 minutes and no account is required.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${link}" style="background:#1A5C38;color:white;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px">
              Open Questionnaire →
            </a>
          </div>
          <p style="color:#64748b;font-size:14px">Or copy this link: ${link}</p>
          <p style="color:#64748b;font-size:14px">This link is unique to you and expires after submission.</p>
        </div>
      </div>
    `,
  })
}

export async function sendClarificationRequest(params: {
  clientEmail: string
  clientName: string
  consultantName: string
  projectTitle: string
  token: string
  coveringMessage: string
}) {
  const link = `${APP_URL}/q/${params.token}`
  await resend.emails.send({
    from: FROM,
    to: params.clientEmail,
    subject: `A few follow-up questions — ${params.projectTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1A5C38;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">AgriAI Platform</h1>
        </div>
        <div style="padding:32px;background:#fff;border:1px solid #e2e8f0;border-radius:0 0 8px 8px">
          <p>Hi ${params.clientName},</p>
          <p>${params.coveringMessage}</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${link}" style="background:#1A5C38;color:white;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px">
              Answer Follow-up Questions →
            </a>
          </div>
          <p style="color:#64748b;font-size:14px">From: ${params.consultantName} via AgriAI Platform</p>
        </div>
      </div>
    `,
  })
}

export async function sendReportReady(params: {
  clientEmail: string
  clientName: string
  consultantName: string
  projectTitle: string
  projectId: string
  previewUrl: string
}) {
  await resend.emails.send({
    from: FROM,
    to: params.clientEmail,
    subject: `Your feasibility report is ready — ${params.projectTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1A5C38;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">AgriAI Platform</h1>
        </div>
        <div style="padding:32px;background:#fff;border:1px solid #e2e8f0;border-radius:0 0 8px 8px">
          <p>Hi ${params.clientName},</p>
          <p>Your feasibility report for <strong>${params.projectTitle}</strong> has been completed by ${params.consultantName}.</p>
          <p>You can preview the executive summary and download the full report below.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${params.previewUrl}" style="background:#1A5C38;color:white;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px">
              View Report →
            </a>
          </div>
        </div>
      </div>
    `,
  })
}
