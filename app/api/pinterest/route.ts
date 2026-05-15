import { NextRequest, NextResponse } from 'next/server'

export interface PinterestPin {
  id: string
  title: string
  description: string
  imageUrl: string
  link: string
  dominantColor: string
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')
  if (!query) {
    return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 })
  }

  try {
    const pins = await scrapePinterest(query)
    return NextResponse.json({ pins })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pinterest fetch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function scrapePinterest(query: string): Promise<PinterestPin[]> {
  const encoded = encodeURIComponent(query)

  // Pinterest's internal resource API returns JSON without requiring a login session
  const timestamp = Date.now()
  const resourceUrl = `https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=%2Fsearch%2Fpins%2F%3Fq%3D${encoded}&data=%7B%22options%22%3A%7B%22query%22%3A%22${encoded}%22%2C%22scope%22%3A%22pins%22%2C%22bookmarks%22%3A%5B%5D%7D%2C%22context%22%3A%7B%7D%7D&_=${timestamp}`

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*, q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': `https://www.pinterest.com/search/pins/?q=${encoded}`,
    'X-Requested-With': 'XMLHttpRequest',
    'X-Pinterest-AppState': 'active',
  }

  const res = await fetch(resourceUrl, { headers, signal: AbortSignal.timeout(8000) })

  if (res.ok) {
    try {
      const json = await res.json()
      const results: PinterestPin[] = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pins: any[] = json?.resource_response?.data?.results ?? []
      for (const pin of pins.slice(0, 20)) {
        const images = pin?.images
        const orig = images?.orig ?? images?.['736x'] ?? images?.['474x']
        if (!orig?.url) continue
        results.push({
          id: String(pin.id ?? Math.random()),
          title: pin.grid_title ?? pin.title ?? '',
          description: pin.description ?? '',
          imageUrl: orig.url,
          link: pin.link ?? `https://www.pinterest.com/pin/${pin.id}/`,
          dominantColor: pin.dominant_color ?? '#cccccc',
        })
      }
      if (results.length > 0) return results
    } catch {
      // fall through to HTML scrape
    }
  }

  // Fallback: scrape the search page HTML and extract __PWS_DATA__
  const htmlRes = await fetch(`https://www.pinterest.com/search/pins/?q=${encoded}&rs=typed`, {
    headers: {
      ...headers,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(10000),
  })

  if (!htmlRes.ok) {
    throw new Error(`Pinterest returned HTTP ${htmlRes.status}`)
  }

  const html = await htmlRes.text()
  return extractPinsFromHtml(html)
}

function extractPinsFromHtml(html: string): PinterestPin[] {
  const results: PinterestPin[] = []

  // Try __PWS_DATA__ script tag
  const pwsMatch = html.match(/<script id="__PWS_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (pwsMatch) {
    try {
      const data = JSON.parse(pwsMatch[1])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pins: any[] =
        data?.props?.initialReduxState?.pins ??
        data?.props?.pageProps?.resourceResponses?.[0]?.response?.data?.results ??
        []

      const pinArr = Array.isArray(pins) ? pins : Object.values(pins)
      for (const pin of pinArr.slice(0, 20)) {
        const images = pin?.images
        const img = images?.orig ?? images?.['736x'] ?? images?.['474x']
        if (!img?.url) continue
        results.push({
          id: String(pin.id ?? Math.random()),
          title: pin.grid_title ?? pin.title ?? '',
          description: pin.description ?? '',
          imageUrl: img.url,
          link: pin.link ?? `https://www.pinterest.com/pin/${pin.id}/`,
          dominantColor: pin.dominant_color ?? '#cccccc',
        })
      }
    } catch {
      // continue to img tag fallback
    }
  }

  if (results.length > 0) return results

  // Last resort: extract pinimg.com image URLs from HTML
  const imgMatches = html.matchAll(/https:\/\/i\.pinimg\.com\/[^"' ]+\.jpg/g)
  const seen = new Set<string>()
  let idx = 0
  for (const [url] of imgMatches) {
    if (seen.has(url)) continue
    seen.add(url)
    results.push({
      id: String(idx++),
      title: '',
      description: '',
      imageUrl: url,
      link: 'https://www.pinterest.com',
      dominantColor: '#cccccc',
    })
    if (results.length >= 20) break
  }

  return results
}
