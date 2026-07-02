// Client-side helpers — PDF and PPTX generation runs server-side
// @react-pdf/renderer is NOT imported here; it lives in the API routes only

import type { StrategyDocument, BossBrief } from '@/lib/studio-types'
import type { ExportOptions } from '@/components/shared/export-format-modal'

type StrategyMetaData = Partial<Record<
  'intelligence' | 'positioning' | 'execution' | 'scale' | 'optimize',
  Record<string, unknown>
>>

// ── PDF export ────────────────────────────────────────────────────────────────

export async function exportStrategyPdf(
  doc: StrategyDocument,
  clientName: string,
  clientColor?: string,
  platforms?: string[],
  bossBrief?: BossBrief | null,
  exportOptions?: ExportOptions,
) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)

  let res: Response
  try {
    res = await fetch('/api/studio/strategy-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc,
        clientName,
        clientColor: clientColor ?? '#1B3D38',
        platforms: platforms ?? doc.platforms ?? [],
        bossBrief: bossBrief ?? null,
        quarter: doc.quarter,
        year: doc.year,
        options: exportOptions ? { size: exportOptions.size, theme: exportOptions.theme } : undefined,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('PDF generation timed out — please try again')
    }
    throw new Error('Network error reaching the PDF server')
  }
  clearTimeout(timer)

  if (!res.ok) {
    let msg = `PDF generation failed (status ${res.status})`
    try {
      const body = await res.json() as { error?: string }
      if (body.error) msg = body.error
    } catch { /* ignore parse error */ }
    throw new Error(msg)
  }

  const blob = await res.blob()

  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href    = url
  const safeName = clientName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
  const q = doc.quarter ? `_${doc.quarter}` : ''
  const y = doc.year    ? `_${doc.year}`    : ''
  a.download = `${safeName}${q}${y}_Strategy.pdf`
  document.body.appendChild(a)
  a.click()
  // Delay revoke so browser has time to initiate the download
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 1000)
}

// ── PPTX export (legacy) ──────────────────────────────────────────────────────

export async function exportStrategyPptx(
  clientName: string,
  clientColor: string | undefined,
  metaData: StrategyMetaData,
) {
  const res = await fetch('/api/studio/strategy-export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientName, clientColor, metaData }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => 'Export failed')
    throw new Error(text)
  }

  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${clientName.replace(/[^a-zA-Z0-9]/g, '_')}_Social_Media_Strategy.pptx`
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 1000)
}
