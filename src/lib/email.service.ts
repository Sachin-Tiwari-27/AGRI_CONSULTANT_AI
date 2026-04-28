import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY environment variable is not set");
    _resend = new Resend(key);
  }
  return _resend;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Use onboarding@resend.dev in development/testing if no custom domain configured
function getFrom(): string {
  const custom = process.env.EMAIL_FROM;
  if (custom) return custom;
  // Resend's verified test sender — works without a custom domain
  return "AgriAI Platform <onboarding@resend.dev>";
}

export async function sendQuestionnaireInvite(params: {
  clientEmail: string;
  clientName: string;
  consultantName: string;
  projectTitle: string;
  token: string;
}) {
  const link = `${APP_URL}/q/${params.token}`;
  const resend = getResend();

  const { error } = await resend.emails.send({
    from: getFrom(),
    to: params.clientEmail,
    subject: `Your project questionnaire is ready — ${params.projectTitle}`,
    html: buildEmailHtml({
      heading: "Project Questionnaire Ready",
      body: `<p>Hi ${params.clientName},</p>
        <p>${params.consultantName} has prepared a project questionnaire for <strong>${params.projectTitle}</strong>.</p>
        <p>Please complete the questionnaire at your convenience — it takes approximately 10–15 minutes and no account is required.</p>`,
      ctaLabel: "Open Questionnaire →",
      ctaUrl: link,
      footer: `This link is unique to you and expires after submission.<br/>From: ${params.consultantName}`,
    }),
  });

  if (error) {
    console.error("[Email] sendQuestionnaireInvite failed:", error);
    throw new Error(`Email send failed: ${error.message}`);
  }
}

export async function sendClarificationRequest(params: {
  clientEmail: string;
  clientName: string;
  consultantName: string;
  projectTitle: string;
  token: string;
  coveringMessage: string;
}) {
  const link = `${APP_URL}/q/${params.token}`;
  const resend = getResend();

  const { error } = await resend.emails.send({
    from: getFrom(),
    to: params.clientEmail,
    subject: `A few follow-up questions — ${params.projectTitle}`,
    html: buildEmailHtml({
      heading: "Follow-up Questions",
      body: `<p>Hi ${params.clientName},</p><p>${params.coveringMessage}</p>`,
      ctaLabel: "Answer Follow-up Questions →",
      ctaUrl: link,
      footer: `From: ${params.consultantName} via AgriAI Platform`,
    }),
  });

  if (error) {
    console.error("[Email] sendClarificationRequest failed:", error);
    throw new Error(`Email send failed: ${error.message}`);
  }
}

export async function sendReportReady(params: {
  clientEmail: string;
  clientName: string;
  consultantName: string;
  projectTitle: string;
  projectId: string;
  previewUrl: string;
}) {
  const resend = getResend();

  const { error } = await resend.emails.send({
    from: getFrom(),
    to: params.clientEmail,
    subject: `Your feasibility report is ready — ${params.projectTitle}`,
    html: buildEmailHtml({
      heading: "Your Report is Ready",
      body: `<p>Hi ${params.clientName},</p>
        <p>Your feasibility report for <strong>${params.projectTitle}</strong> has been completed by ${params.consultantName}.</p>
        <p>You can preview the executive summary and download the full report below.</p>`,
      ctaLabel: "View Full Report →",
      ctaUrl: params.previewUrl,
      footer: `Prepared by ${params.consultantName} · AgriAI Platform`,
    }),
  });

  if (error) {
    console.error("[Email] sendReportReady failed:", error);
    throw new Error(`Email send failed: ${error.message}`);
  }
}

// ── Shared email HTML builder ─────────────────────────────────────────
function buildEmailHtml(opts: {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  footer: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <!-- Header -->
        <tr><td style="background:#1A5C38;padding:24px 32px;border-radius:12px 12px 0 0">
          <table width="100%"><tr>
            <td style="color:white">
              <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.7">AgriAI Platform</p>
              <h1 style="margin:4px 0 0;font-size:22px;font-weight:700">${opts.heading}</h1>
            </td>
            <td align="right">
              <div style="width:40px;height:40px;background:rgba(255,255,255,0.15);border-radius:10px;display:inline-flex;align-items:center;justify-content:center">
                <span style="color:white;font-size:20px">🌾</span>
              </div>
            </td>
          </tr></table>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:white;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
          <div style="color:#374151;font-size:15px;line-height:1.6">
            ${opts.body}
          </div>
          <div style="text-align:center;margin:32px 0">
            <a href="${opts.ctaUrl}" 
               style="background:#1A5C38;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block">
              ${opts.ctaLabel}
            </a>
          </div>
          <p style="color:#9ca3af;font-size:12px;word-break:break-all">
            Or copy this link: <a href="${opts.ctaUrl}" style="color:#1A5C38">${opts.ctaUrl}</a>
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f1f5f9;padding:16px 32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
          <p style="margin:0;color:#6b7280;font-size:12px;text-align:center">${opts.footer}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
