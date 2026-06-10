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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://perfumeexhibition.com'

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

export interface PostDecisionResult {
  caption: string
  status: 'approved' | 'changes_requested' | 'pending'
  note?: string
}

export interface ApprovalDecisionParams {
  teamEmail: string
  clientName: string
  requestTitle: string
  decisionSummary: string
  postResults?: PostDecisionResult[]
}

export async function sendApprovalDecision(params: ApprovalDecisionParams): Promise<SendResult> {
  const { teamEmail, clientName, requestTitle, decisionSummary, postResults } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://perfumeexhibition.com'

  const slbl = (s: string) => s === 'approved' ? 'Approved' : s === 'changes_requested' ? 'Changes Requested' : 'Pending'
  const sclr = (s: string) => s === 'approved' ? '#15803D' : s === 'changes_requested' ? '#DC2626' : '#D97706'
  const sbg  = (s: string) => s === 'approved' ? '#F0FDF4' : s === 'changes_requested' ? '#FEF2F2' : '#FFFBEB'

  const postsSection = postResults && postResults.length > 0
    ? `<div style="margin:20px 0;">
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Post-by-Post Review</div>
        ${postResults.map((item, i) => `<div style="border:1px solid #E2E8F0;border-radius:6px;overflow:hidden;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#F8FAFC;border-bottom:1px solid #F1F5F9;">
            <span style="font-size:11px;color:#64748b;font-weight:600;">Post ${i + 1}</span>
            <span style="display:inline-block;background:${sbg(item.status)};color:${sclr(item.status)};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">${slbl(item.status)}</span>
          </div>
          <div style="padding:10px 12px;">
            <p style="margin:0;font-size:13px;color:#475569;line-height:1.5;">${(item.caption ?? '').slice(0, 150)}${(item.caption ?? '').length > 150 ? '…' : ''}</p>
            ${item.note ? `<p style="margin:8px 0 0;font-size:12px;color:#92400E;background:#FFFBEB;padding:6px 8px;border-radius:4px;border-left:2px solid #FDBA74;">${item.note}</p>` : ''}
          </div>
        </div>`).join('')}
      </div>`
    : ''

  const html = htmlWrapper(`
    ${h2('Client Approval Decision Received')}
    ${p(`The client <strong style="color:#1e293b;">${clientName}</strong> has submitted their review for the following request.`)}
    ${metaTable([
      ['Request', requestTitle],
      ['Decision', decisionSummary],
    ])}
    ${postsSection}
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
  tempPassword: string
}

function credentialsBox(email: string, password: string): string {
  return `<div style="background:#EBF4F3;border:2px solid #9DCCC8;border-radius:8px;padding:20px 24px;margin:20px 0;">
    <p style="margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#2A6B62;">Your Login Credentials</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      <tr>
        <td style="font-size:13px;font-weight:600;color:#64748b;padding:6px 16px 6px 0;white-space:nowrap;vertical-align:top;">Email</td>
        <td style="font-size:14px;color:#1e293b;padding:6px 0;font-family:monospace;">${email}</td>
      </tr>
      <tr>
        <td style="font-size:13px;font-weight:600;color:#64748b;padding:6px 16px 6px 0;white-space:nowrap;vertical-align:top;">Temporary Password</td>
        <td style="font-size:15px;color:#1B3D38;padding:6px 0;font-family:monospace;font-weight:700;letter-spacing:0.5px;">${password}</td>
      </tr>
    </table>
    <p style="margin:14px 0 0;font-size:12px;color:#64748b;border-top:1px solid #9DCCC8;padding-top:12px;">You will be prompted to set a new password and complete your profile on first login. Keep these credentials safe.</p>
  </div>`
}

export async function sendTeamInvite(params: TeamInviteParams): Promise<SendResult> {
  const { toEmail, toName, role, inviterName, appUrl, tempPassword } = params

  const roleLabel = role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  const html = htmlWrapper(`
    ${h2('You Have Been Invited to NOVAX Ops')}
    ${p(`Hi ${toName}, <strong style="color:#1e293b;">${inviterName}</strong> has added you to the NOVAX Ops platform as <strong style="color:#1B3D38;">${roleLabel}</strong>.`)}
    ${credentialsBox(toEmail, tempPassword)}
    ${p('Click the button below to log in. You will be asked to set a new password and complete your profile before accessing the platform.')}
    ${ctaButton('Log In to NOVAX Ops', `${appUrl}/login`)}
    ${p(`<span style="font-size:12px;color:#94a3b8;">If you were not expecting this invitation, you can safely ignore this email.</span>`)}
  `)

  try {
    const resend = client()
    const { error } = await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: `You have been invited to NOVAX Ops`,
      html,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// sendMentionNotification
// ---------------------------------------------------------------------------

export interface MentionNotificationParams {
  mentionedEmail: string
  mentionedName: string
  mentionerName: string
  taskTitle: string
  taskId: string
  clientName: string
  commentPreview: string  // first 200 chars of the comment
}

export async function sendMentionNotification(params: MentionNotificationParams): Promise<SendResult> {
  const { mentionedEmail, mentionedName, mentionerName, taskTitle, taskId, clientName, commentPreview } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://perfumeexhibition.com'

  const blockquote = `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #5BB4AE;background:#EBF4F3;border-radius:0 6px 6px 0;font-size:13px;color:#475569;font-style:italic;">${commentPreview}</blockquote>`

  const html = htmlWrapper(`
    ${h2(`${mentionerName} mentioned you in a task`)}
    ${p(`Hi ${mentionedName}, <strong style="color:#1e293b;">${mentionerName}</strong> mentioned you in a comment on task <strong style="color:#1e293b;">${taskTitle}</strong>.`)}
    ${blockquote}
    ${metaTable([
      ['Client', clientName],
      ['Task', taskTitle],
    ])}
    ${ctaButton('View Task', `${appUrl}/pipeline?task=${taskId}`)}
  `)

  try {
    const resend = client()
    const { error } = await resend.emails.send({
      from: FROM,
      to: mentionedEmail,
      subject: `${mentionerName} mentioned you in "${taskTitle}"`,
      html,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// sendTaskReminder
// ---------------------------------------------------------------------------

export interface TaskReminderParams {
  userEmail: string
  userName: string
  taskTitle: string
  taskId: string
  clientName: string
  dueDate: string        // formatted date string
  priority: string
  hoursUntilDue: number  // e.g. 24 or 48
}

export async function sendTaskReminder(params: TaskReminderParams): Promise<SendResult> {
  const { userEmail, userName, taskTitle, taskId, clientName, dueDate, priority, hoursUntilDue } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://perfumeexhibition.com'

  const urgencyBadge = hoursUntilDue <= 24
    ? `<span style="display:inline-block;background:#FEF2F2;color:#DC2626;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;margin-bottom:12px;">Due in ${hoursUntilDue} hours</span>`
    : ''

  const html = htmlWrapper(`
    ${h2('Task Due Soon')}
    ${urgencyBadge}
    ${p(`Hi ${userName}, this is a reminder that your task <strong style="color:#1e293b;">${taskTitle}</strong> is due soon. Please submit your final work before the deadline.`)}
    ${metaTable([
      ['Client', clientName],
      ['Priority', priority],
      ['Due Date', dueDate],
    ])}
    ${ctaButton('View Task', `${appUrl}/pipeline?task=${taskId}`)}
  `)

  try {
    const resend = client()
    const { error } = await resend.emails.send({
      from: FROM,
      to: userEmail,
      subject: `Reminder: "${taskTitle}" is due in ${hoursUntilDue}h`,
      html,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ---------------------------------------------------------------------------
// sendDailyDigest
// ---------------------------------------------------------------------------

export interface DailyDigestStats {
  date: string
  totalActiveTasks: number
  tasksCreatedToday: number
  overdueTasks: number
  tasksByStage: { stage: string; count: number }[]
  postsScheduledToday: number
  postsPublishedToday: number
  pendingModeration: number
  clientsInCrisis: string[]
  topAssignees: { name: string; tasks: number }[]
  monthlyRequirements?: { name: string; target: number; actual: number }[]
  apiCostThisMonth?: number
}

export interface DailyDigestParams {
  ceoEmail: string
  ceoName: string
  stats: DailyDigestStats
}

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  strategy:  { bg: '#EBF4F3', text: '#2A6B62' },
  ideas:     { bg: '#F0FDF4', text: '#15803D' },
  calendar:  { bg: '#EFF6FF', text: '#1D4ED8' },
  copy:      { bg: '#FEF3C7', text: '#92400E' },
  design:    { bg: '#F3E8FF', text: '#7E22CE' },
  review:    { bg: '#FFF7ED', text: '#C2410C' },
  approval:  { bg: '#FEF2F2', text: '#B91C1C' },
  scheduled: { bg: '#EBF4F3', text: '#1B3D38' },
  published: { bg: '#F0FDF4', text: '#15803D' },
  reporting: { bg: '#F8FAFC', text: '#475569' },
}

function kpiMini(value: number | string, label: string): string {
  return `<div style="flex:1;background:#EBF4F3;border:1px solid #9DCCC8;border-radius:8px;padding:12px 14px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#1B3D38;">${value}</div><div style="font-size:10px;color:#2A6B62;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:3px;">${label}</div></div>`
}

export async function sendDailyDigest(params: DailyDigestParams): Promise<SendResult> {
  const { ceoEmail, ceoName, stats } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://perfumeexhibition.com'

  // KPI row
  const kpiRow = `<div style="display:flex;gap:10px;margin:16px 0;">
    ${kpiMini(stats.totalActiveTasks, 'Active Tasks')}
    ${kpiMini(stats.postsScheduledToday + stats.postsPublishedToday, 'Posts Today')}
    ${kpiMini(stats.pendingModeration, 'Pending Moderation')}
  </div>`

  // Pipeline snapshot table
  const stageActive = stats.tasksByStage.filter(s => s.count > 0)
  const pipelineTable = stageActive.length > 0
    ? `<table style="width:100%;border-collapse:separate;border-spacing:3px;margin:12px 0;">
        <tr>
          ${stageActive.map(({ stage, count }) => {
            const colors = STAGE_COLORS[stage] ?? { bg: '#F8FAFC', text: '#475569' }
            return `<td style="padding:8px 6px;text-align:center;background:${colors.bg};border-radius:4px;">
              <div style="font-size:13px;font-weight:700;color:${colors.text};">${count}</div>
              <div style="font-size:9px;font-weight:600;color:${colors.text};opacity:0.8;text-transform:capitalize;">${stage}</div>
            </td>`
          }).join('\n          ')}
        </tr>
      </table>`
    : ''

  // Flags section
  const flagRows: string[] = []
  if (stats.overdueTasks > 0) {
    flagRows.push(`<tr><td style="padding:10px 14px;background:#FEF2F2;border:1px solid #FCA5A5;border-radius:6px;font-size:13px;font-weight:600;color:#DC2626;">&#9888; ${stats.overdueTasks} task(s) are overdue</td></tr>`)
  }
  if (stats.clientsInCrisis.length > 0) {
    flagRows.push(`<tr><td style="padding:10px 14px;background:#FFF7ED;border:1px solid #FDBA74;border-radius:6px;font-size:13px;font-weight:600;color:#C2410C;margin-top:6px;">&#9650; ${stats.clientsInCrisis.join(', ')} in Crisis Mode</td></tr>`)
  }
  const flagsSection = flagRows.length > 0
    ? `<table cellpadding="0" cellspacing="4" style="width:100%;margin:16px 0;">${flagRows.join('\n')}</table>`
    : ''

  // Top contributors
  const contributorsSection = stats.topAssignees.length > 0
    ? `<div style="margin:16px 0;">
        <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Top Contributors Today</div>
        ${stats.topAssignees.map((a, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 12px;background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'};border-radius:4px;font-size:13px;">
          <span style="color:#1e293b;font-weight:500;">${a.name}</span>
          <span style="color:#2A6B62;font-weight:700;">${a.tasks} tasks</span>
        </div>`).join('\n        ')}
      </div>`
    : ''

  // Today's activity summary line
  const activityLine = `<div style="margin:10px 0 4px;font-size:13px;color:#475569;">
    <span style="color:#1B3D38;font-weight:600;">${stats.tasksCreatedToday}</span> task(s) created today &nbsp;|&nbsp;
    <span style="color:#15803D;font-weight:600;">${stats.postsPublishedToday}</span> post(s) published &nbsp;|&nbsp;
    <span style="color:#1D4ED8;font-weight:600;">${stats.postsScheduledToday}</span> post(s) scheduled
  </div>`

  // Monthly content requirements section
  const monthlyReqSection = stats.monthlyRequirements && stats.monthlyRequirements.length > 0
    ? `<div style="margin:20px 0;">
        <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Monthly Content Requirements</div>
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
          <tr style="background:#f8fafc;">
            <th style="padding:7px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0;">Client</th>
            <th style="padding:7px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:center;border-bottom:1px solid #e2e8f0;">Target</th>
            <th style="padding:7px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:center;border-bottom:1px solid #e2e8f0;">Published</th>
            <th style="padding:7px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:center;border-bottom:1px solid #e2e8f0;">Status</th>
          </tr>
          ${stats.monthlyRequirements.map((r, i) => {
            const pct = r.target > 0 ? r.actual / r.target : 1
            const [statusLabel, statusColor, statusBg] =
              pct >= 0.75 ? ['On track', '#15803D', '#F0FDF4'] :
              pct >= 0.5  ? ['Behind',   '#92400E', '#FFFBEB'] :
                            ['At risk',  '#DC2626', '#FEF2F2']
            return `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
              <td style="padding:7px 12px;font-size:13px;color:#1e293b;font-weight:500;border-bottom:1px solid #f1f5f9;">${r.name}</td>
              <td style="padding:7px 12px;font-size:13px;color:#64748b;text-align:center;border-bottom:1px solid #f1f5f9;">${r.target}</td>
              <td style="padding:7px 12px;font-size:13px;font-weight:700;color:#1e293b;text-align:center;border-bottom:1px solid #f1f5f9;">${r.actual}</td>
              <td style="padding:7px 12px;text-align:center;border-bottom:1px solid #f1f5f9;"><span style="display:inline-block;background:${statusBg};color:${statusColor};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">${statusLabel}</span></td>
            </tr>`
          }).join('\n          ')}
        </table>
      </div>`
    : ''

  // API cost line
  const apiCostLine = typeof stats.apiCostThisMonth === 'number'
    ? `<div style="margin:10px 0;font-size:12px;color:#64748b;">AI API cost this month: <strong style="color:#1B3D38;">$${stats.apiCostThisMonth.toFixed(2)}</strong></div>`
    : ''

  const html = htmlWrapper(`
    <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#1B3D38;">Good morning, ${ceoName}.</p>
    <p style="margin:0 0 20px;font-size:13px;color:#2A6B62;font-weight:500;">${stats.date}</p>
    ${kpiRow}
    ${activityLine}
    ${stageActive.length > 0 ? `<div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin:20px 0 4px;">Pipeline Snapshot</div>${pipelineTable}` : ''}
    ${flagsSection}
    ${monthlyReqSection}
    ${contributorsSection}
    ${apiCostLine}
    ${ctaButton('Open NOVAX Ops', appUrl)}
    <p style="margin:20px 0 0;font-size:11px;color:#94a3b8;">This digest is sent daily at 8:00 AM. Replies to this email are not monitored.</p>
  `)

  try {
    const resend = client()
    const { error } = await resend.emails.send({
      from: FROM,
      to: ceoEmail,
      subject: `NOVAX Ops Daily Brief — ${stats.date}`,
      html,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
