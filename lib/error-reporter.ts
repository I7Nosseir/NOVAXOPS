import { createAdminClient } from '@/lib/supabase'
import { Resend } from 'resend'

export interface ReportErrorOptions {
  route: string
  error: unknown
  orgId?: string | null
  userId?: string | null
  context?: Record<string, unknown>
  severity?: 'info' | 'warning' | 'error' | 'critical'
}

/**
 * Report a server-side error to:
 * 1. The error_events table (always, fire-and-forget)
 * 2. Admin email (only for 'critical' severity)
 *
 * Call this instead of bare console.error in API routes.
 * Never throws — error reporting must never crash the caller.
 */
export async function reportError(opts: ReportErrorOptions): Promise<void> {
  const {
    route,
    error,
    orgId,
    userId,
    context = {},
    severity = 'error',
  } = opts

  const message = error instanceof Error ? error.message : String(error)
  const stack   = error instanceof Error ? (error.stack ?? null) : null

  // Always log to console for local dev visibility
  console.error(`[${severity.toUpperCase()}] ${route}: ${message}`)

  try {
    const supabase = createAdminClient()

    // Insert into error_events table (non-blocking)
    await supabase.from('error_events').insert({
      route,
      error_message: message,
      error_stack: stack,
      context_json: context,
      severity,
      organization_id: orgId ?? null,
      user_id: userId ?? null,
    })

    // Send email for critical errors
    if (severity === 'critical') {
      const adminEmail = process.env.ADMIN_ALERT_EMAIL
      const resendKey  = process.env.RESEND_API_KEY

      if (adminEmail && resendKey) {
        const resend = new Resend(resendKey)
        const from   = process.env.RESEND_FROM_ADDRESS ?? 'NOVAX Ops <noreply@novaxops.com>'

        await resend.emails.send({
          from,
          to: adminEmail,
          subject: `[CRITICAL] Error in ${route}`,
          html: `
            <div style="font-family:sans-serif;padding:20px;max-width:600px;">
              <h2 style="color:#DC2626;margin:0 0 16px;">Critical Error Alert</h2>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px;background:#fef2f2;border:1px solid #fca5a5;font-weight:600;">Route</td><td style="padding:8px;border:1px solid #fca5a5;font-family:monospace;">${route}</td></tr>
                <tr><td style="padding:8px;background:#fef2f2;border:1px solid #fca5a5;font-weight:600;">Error</td><td style="padding:8px;border:1px solid #fca5a5;">${message}</td></tr>
                ${orgId ? `<tr><td style="padding:8px;background:#fef2f2;border:1px solid #fca5a5;font-weight:600;">Org ID</td><td style="padding:8px;border:1px solid #fca5a5;font-family:monospace;">${orgId}</td></tr>` : ''}
                ${userId ? `<tr><td style="padding:8px;background:#fef2f2;border:1px solid #fca5a5;font-weight:600;">User ID</td><td style="padding:8px;border:1px solid #fca5a5;font-family:monospace;">${userId}</td></tr>` : ''}
              </table>
              ${stack ? `<pre style="margin-top:16px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;overflow:auto;">${stack}</pre>` : ''}
              <p style="margin-top:16px;font-size:12px;color:#94a3b8;">View all errors at <a href="https://www.novaxops.com/admin/errors">novaxops.com/admin/errors</a></p>
            </div>
          `,
        }).catch(() => { /* email failure must not throw */ })
      }
    }
  } catch {
    // Swallow any error from the reporter itself — never let this cascade
  }
}
