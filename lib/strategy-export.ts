// Client-side helper — generation runs server-side via /api/studio/strategy-export
// pptxgenjs is NOT imported here to avoid webpack node: scheme errors

type StrategyMetaData = Partial<Record<
  'intelligence' | 'positioning' | 'execution' | 'scale' | 'optimize',
  Record<string, unknown>
>>

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
