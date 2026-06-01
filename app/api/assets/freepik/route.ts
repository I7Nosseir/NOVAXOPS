import { NextRequest, NextResponse } from 'next/server'

export interface FreepikResult {
  id: string
  title: string
  thumbnailUrl: string
  previewUrl: string
  sourceUrl: string
  type: 'photo' | 'vector' | 'psd'
  isPremium: boolean
}

interface FreepikResource {
  id: number
  title: string
  thumbnails: { url: string; width: number; height: number }[]
  preview?: { url: string }
  url: string
  type: string
  premium?: boolean
  licenses?: { type: string }[]
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 })

  const apiKey = process.env.FREEPIK_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'FREEPIK_API_KEY is not configured. Add it to your environment variables.' },
      { status: 503 }
    )
  }

  const page = Number(req.nextUrl.searchParams.get('page') ?? '1')
  const limit = 20

  const params = new URLSearchParams({
    locale: 'en-US',
    page: String(page),
    limit: String(limit),
    term: q,
    'filters[content_type][photo]': '1',
    'filters[license][freepik]': '1',
  })

  try {
    const res = await fetch(`https://api.freepik.com/v1/resources?${params}`, {
      headers: {
        'Accept-Language': 'en-US',
        'Content-Type': 'application/json',
        'X-Freepik-API-Key': apiKey,
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.status.toString())
      return NextResponse.json(
        { error: `Freepik API error ${res.status}: ${text}` },
        { status: res.status }
      )
    }

    const data = await res.json() as { data: FreepikResource[]; meta?: unknown }
    const results: FreepikResult[] = (data.data ?? []).map(r => {
      const thumb = r.thumbnails?.[0]?.url ?? ''
      const preview = r.preview?.url ?? r.thumbnails?.[r.thumbnails.length - 1]?.url ?? thumb
      return {
        id: String(r.id),
        title: r.title ?? '',
        thumbnailUrl: thumb,
        previewUrl: preview,
        sourceUrl: r.url ?? `https://www.freepik.com`,
        type: (r.type === 'vector' ? 'vector' : r.type === 'psd' ? 'psd' : 'photo') as FreepikResult['type'],
        isPremium: r.premium ?? false,
      }
    })

    return NextResponse.json({ results, total: results.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Freepik search failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
