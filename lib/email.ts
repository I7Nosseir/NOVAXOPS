import { Resend } from 'resend'

const FROM = process.env.RESEND_FROM_ADDRESS ?? 'NOVAX Ops <noreply@novaxops.com>'

function client() {
  return new Resend(process.env.RESEND_API_KEY)
}

type SendResult = { ok: boolean; error?: string }

// ---------------------------------------------------------------------------
// Shared HTML helpers
// ---------------------------------------------------------------------------

function htmlWrapper(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NOVAX Ops</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background:#1B3D38;padding:24px 32px;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.05em;">NOVAX OPS</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background:#f1f5f9;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                This is an automated message from NOVAX Ops. Do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function h2(text: string): string {
  return `<h2 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#1B3D38;">${text}</h2>`
}

function p(text: string): string {
  return `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;">${text}</p>`
}

function metaRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;white-space:nowrap;">${label}</td>
    <td style="padding:8px 12px;font-size:13px;color:#1e293b;border:1px solid #e2e8f0;">${value}</td>
  </tr>`
}

function metaTable(rows: Array<[string, string]>): string {
  return `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0;">
    ${rows.map(([l, v]) => metaRow(l, v)).join('\n')}
  </table>`
}

function ctaButton(text: string, href: string): string {
  return `<p style="margin:24px 0 0;">
    <a href="${href}" style="display:inline-block;background:#1B3D38;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">${text}</a>
  </p>`
}

// ---------------------------------------------------------------------------
// sendTaskAssigned
// ---------------------------------------------------------------------------

export interface TaskAssignedParams {
  taskTitle: string
  taskId: string
  assigneeName: string
  assigneeEmail: string
  clientName: string
  dueDate?: string | null
  priority?: string | null
}

export async function sendTaskAssigned(params: TaskAssignedParams): Promise<SendResult> {
  const { taskTitle, taskId, assigneeName, assigneeEmail, clientName, dueDate, priority } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://novaxops.com'

  const rows: Array<[string, string]> = [
    ['Client', clientName],
    ['Priority', priority ?? 'Normal'],
  ]
  if (dueDate) rows.push(['Due Date', dueDate])

  const html = htmlWrapper(`
    ${h2('Task Assigned to You')}
    ${p(`Hi ${assigneeName}, a task has been assigned to you in NOVAX Ops.`)}
    ${p(`<strong style="color:#1e293b;">${taskTitle}</strong>`)}
    ${metaTable(rows)}
    ${ctaButton('View Task', `${appUrl}/pipeline?task=${taskId}`)}
  `)

  try {
    const resend = client()
    const { error } = await resend.emails.send({
      from: FROM,
      to: assigneeEmail,
      subject: `New task assigned: ${taskTitle}`,
      html,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// sendApprovalRequest
// ---------------------------------------------------------------------------

export interface ApprovalRequestParams {
  clientEmail: string
  clientName: string
  requestTitle: string
  approvalLink: string
  expiresAt: string
}

export async function sendApprovalRequest(params: ApprovalRequestParams): Promise<SendResult> {
  const { clientEmail, clientName, requestTitle, approvalLink, expiresAt } = params

  const expiryLabel = new Date(expiresAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const html = htmlWrapper(`
    ${h2('Content Ready for Your Review')}
    ${p(`Hi ${clientName}, your content is ready for approval.`)}
    ${metaTable([
      ['Request', requestTitle],
      ['Expires', expiryLabel],
    ])}
    ${p('Please review the content at the link below and let us know your feedback.')}
    ${ctaButton('Review Content', approvalLink)}
    ${p(`<span style="font-size:12px;color:#94a3b8;">This link expires on ${expiryLabel}.</span>`)}
  `)

  try {
    const resend = client()
    const { error } = await resend.emails.send({
      from: FROM,
      to: clientEmail,
      subject: `Content ready for review: ${requestTitle}`,
      html,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// sendApprovalDecision
// ---------------------------------------------------------------------------

export interface ApprovalDecisionParams {
  teamEmail: string
  clientName: string
  requestTitle: string
  decisionSummary: string
}

export async function sendApprovalDecision(params: ApprovalDecisionParams): Promise<SendResult> {
  const { teamEmail, clientName, requestTitle, decisionSummary } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://novaxops.com'

  const html = htmlWrapper(`
    ${h2('Client Approval Decision Received')}
    ${p(`The client <strong style="color:#1e293b;">${clientName}</strong> has submitted their review for the following request.`)}
    ${metaTable([
      ['Request', requestTitle],
      ['Decision', decisionSummary],
    ])}
    ${ctaButton('View in NOVAX Ops', `${appUrl}/approval`)}
  `)

  try {
    const resend = client()
    const { error } = await resend.emails.send({
      from: FROM,
      to: teamEmail,
      subject: `Approval decision from ${clientName}: ${requestTitle}`,
      html,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// sendTeamInvite
// ---------------------------------------------------------------------------

export interface TeamInviteParams {
  toEmail: string
  toName: string
  role: string
  inviterName: string
  appUrl: string
}

export async function sendTeamInvite(params: TeamInviteParams): Promise<SendResult> {
  const { toEmail, toName, role, inviterName, appUrl } = params

  const roleLabel = role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  const html = htmlWrapper(`
    ${h2('You Have Been Invited to NOVAX Ops')}
    ${p(`Hi ${toName}, ${inviterName} has invited you to join the NOVAX Ops platform.`)}
    ${metaTable([
      ['Role', roleLabel],
      ['Platform', 'NOVAX Ops'],
    ])}
    ${p('Click the button below to accept the invitation and set up your account.')}
    ${ctaButton('Accept Invitation', appUrl)}
  `)

  try {
    const resend = client()
    const { error } = await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: `${inviterName} invited you to NOVAX Ops`,
      html,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
