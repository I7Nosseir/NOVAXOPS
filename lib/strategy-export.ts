// Client-side helpers — generation runs server-side
// pptxgenjs and @react-pdf/renderer are NOT imported here to avoid webpack node: scheme errors

import type { StrategyDocument, BossBrief } from '@/lib/studio-types'

type StrategyMetaData = Partial<Record<
  'intelligence' | 'positioning' | 'execution' | 'scale' | 'optimize',
  Record<string, unknown>
>>

// ── PDF export (new Esplanade-format strategy) ────────────────────────────────

export async function exportStrategyPdf(
  doc: StrategyDocument,
  clientName: string,
  clientColor?: string,
  platforms?: string[],
  bossBrief?: BossBrief | null,
) {
  const res = await fetch('/api/studio/strategy-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doc,
      clientName,
      clientColor,
      platforms: platforms ?? doc.platforms ?? [],
      bossBrief: bossBrief ?? null,
      quarter: doc.quarter,
      year:    doc.year,
    }),
  })

  if (!res.ok) {
    let msg = 'PDF export failed'
    try {
      const body = await res.json() as { error?: string }
      if (body.error) msg = body.error
    } catch {
      msg = await res.text().catch(() => 'PDF export failed')
    }
    throw new Error(msg)
  }

  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_')
  const q = doc.quarter ? `_${doc.quarter}` : ''
  const y = doc.year    ? `_${doc.year}`    : ''
  a.download = `${safeName}${q}${y}_Strategy.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── PPTX export (legacy — kept for backward compat) ───────────────────────────

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
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
