// ============================================================
// Pinterest Data Provider
//
// Primary:  Pinterest API v5 (PINTEREST_ACCESS_TOKEN)
//   Scopes: pins:read, boards:read, user_accounts:read
//   Endpoint: GET /v5/search/pins?query=<kw>&page_size=25
//
// Fallback: Apify pinterest-scraper (APIFY_API_KEY)
//   Used when the Pinterest token is missing or returns 401/403.
//
// Token note: Pinterest access tokens expire every 24 hours.
//   Paste the new token into PINTEREST_ACCESS_TOKEN in .env.local.
//   The fallback ensures the app keeps working between rotations.
// ============================================================

import { ARABIC_REGIONS } from '@/lib/studio/query-generator'

// ── Niche → search query mapping ─────────────────────────────

const EN_PINTEREST_QUERIES: Record<string, string[]> = {
  beauty:              ['skincare routine aesthetic', 'beauty tips glow'],
  skincare:            ['skincare routine steps', 'glass skin tips'],
  makeup:              ['makeup look inspiration', 'everyday glam makeup'],
  'hair care':         ['hair care routine healthy', 'hair transformation tips'],
  tech:                ['tech desk setup aesthetic', 'gadget ideas workspace'],
  'AI tools':          ['AI productivity tools', 'digital workspace aesthetic'],
  food:                ['recipe ideas aesthetic', 'meal prep healthy'],
  'food recipes':      ['easy recipe inspo', 'healthy meal ideas'],
  restaurants:         ['restaurant aesthetic photography', 'food presentation ideas'],
  fitness:             ['workout plan aesthetic', 'gym motivation board'],
  'gym workout':       ['gym workout routine', 'bodybuilding tips aesthetic'],
  'yoga pilates':      ['yoga inspiration poses', 'pilates workout board'],
  'nutrition diet':    ['healthy meal plan ideas', 'clean eating inspo'],
  finance:             ['budget template aesthetic', 'financial freedom goals'],
  'personal finance':  ['money saving ideas', 'budgeting tips board'],
  entrepreneurship:    ['entrepreneur motivation board', 'startup vision'],
  'real estate':       ['dream home aesthetic', 'interior design ideas house'],
  fashion:             ['outfit ideas inspo', 'fashion aesthetic board'],
  'luxury fashion':    ['luxury fashion inspo', 'designer aesthetic looks'],
  travel:              ['travel destination bucket list', 'wanderlust aesthetic'],
  'travel MENA':       ['dubai aesthetic travel', 'middle east travel inspo'],
  education:           ['study aesthetic inspo', 'learning motivation board'],
  'online courses':    ['online learning workspace', 'e-learning aesthetic'],
  marketing:           ['social media strategy ideas', 'content marketing inspo'],
  'marketing agency':  ['agency branding aesthetic', 'marketing design inspiration'],
  'social media tips': ['content creator tips aesthetic', 'instagram growth inspo'],
  'dental clinic':     ['smile transformation inspiration', 'dental aesthetic'],
  'law firm':          ['professional office aesthetic', 'law firm design'],
  'interior design':   ['interior design ideas aesthetic', 'home decor inspo'],
  photography:         ['photography aesthetic ideas', 'photo shoot inspiration'],
}

const AR_PINTEREST_QUERIES: Record<string, string[]> = {
  beauty:           ['روتين جمال وبشرة', 'مكياج انسبريشن'],
  skincare:         ['روتين سكن كير', 'عناية بشرة طبيعية'],
  makeup:           ['مكياج خليجي انسبريشن', 'ميكاب عربي'],
  food:             ['وصفات اكل لذيذة', 'طبخ عربي انسبريشن'],
  fitness:          ['رياضة انسبريشن', 'جيم تمارين بورد'],
  fashion:          ['موضة خليجية انسبريشن', 'ازياء عربية'],
  travel:           ['سياحة عربية وجهات', 'سفر انسبريشن بورد'],
  'interior design':['ديكور منزل انسبريشن', 'تصميم داخلي'],
  marketing:        ['تسويق رقمي انسبريشن', 'محتوى سوشيال ميديا'],
  education:        ['دراسة استيثيك بورد', 'تعلم انسبريشن'],
  'real estate':    ['منزل احلام ديكور', 'عقارات تصميم'],
}

// ── Exported pin shape ────────────────────────────────────────

export interface PinterestPin {
  id:           string
  title:        string
  description:  string
  url:          string
  imageUrl:     string
  saveCount:    number
  authorName:   string
  authorHandle: string
  createdAt:    string
}

// ── Query resolver ────────────────────────────────────────────

function resolveQueries(niche: string, region: string): string[] {
  const key = niche.toLowerCase().trim()
  if (ARABIC_REGIONS.has(region)) {
    const arQ = AR_PINTEREST_QUERIES[key]
    if (arQ?.length) return arQ.slice(0, 2)
  }
  const enQ = EN_PINTEREST_QUERIES[key]
  if (enQ?.length) return enQ.slice(0, 2)
  return [niche, `${niche} inspiration aesthetic`]
}

// ─────────────────────────────────────────────────────────────
// PRIMARY — Pinterest API v5
// ─────────────────────────────────────────────────────────────

interface PinterestV5Pin {
  id:          string
  created_at?: string
  link?:       string
  title?:      string
  description?:string
  alt_text?:   string
  board_owner?:{ username?: string }
  creator?:    { username?: string }
  media?:      {
    images?: {
      '1200x'?: { url: string }
      '600x'?:  { url: string }
      '400x300'?:{ url: string }
      '150x150'?:{ url: string }
    }
  }
  pin_metrics?: {
    pin_stats?: { save?: number; impression?: number; click_through?: number }
  }
}

interface PinterestV5Response {
  items?:    PinterestV5Pin[]
  bookmark?: string
  error?:    { code?: number; message?: string }
}

async function searchPinterestAPI(
  query:    string,
  pageSize: number,
  token:    string,
): Promise<PinterestPin[]> {
  const url = new URL('https://api.pinterest.com/v5/search/pins')
  url.searchParams.set('query', query)
  url.searchParams.set('page_size', String(pageSize))
  // Request pin_metrics so we get save counts
  url.searchParams.set('pin_fields', 'id,created_at,link,title,description,alt_text,board_owner,creator,media,pin_metrics')

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[pinterest-api] ${res.status} for query "${query}": ${body.slice(0, 200)}`)
    throw new Error(`Pinterest API ${res.status}`)
  }

  const data = await res.json() as PinterestV5Response
  if (!Array.isArray(data.items)) return []

  return data.items.map(p => {
    const imgs    = p.media?.images
    const imgUrl  = imgs?.['1200x']?.url ?? imgs?.['600x']?.url ?? imgs?.['400x300']?.url ?? imgs?.['150x150']?.url ?? ''
    const pinUrl  = p.link ?? (p.id ? `https://www.pinterest.com/pin/${p.id}/` : '')
    const saves   = p.pin_metrics?.pin_stats?.save ?? 0
    const handle  = p.creator?.username ?? p.board_owner?.username ?? ''

    return {
      id:           p.id,
      title:        p.title ?? p.alt_text ?? (p.description?.slice(0, 80)) ?? 'Pinterest pin',
      description:  p.description ?? '',
      url:          pinUrl,
      imageUrl:     imgUrl,
      saveCount:    saves,
      authorName:   handle,
      authorHandle: handle,
      createdAt:    p.created_at ?? '',
    }
  }).filter(p => p.url.length > 0)
}

async function fetchViaPinterestAPI(
  queries: string[],
  maxPerQuery: number,
): Promise<PinterestPin[]> {
  const token = process.env.PINTEREST_ACCESS_TOKEN
  if (!token) return []

  const results = await Promise.allSettled(
    queries.map(q => searchPinterestAPI(q, maxPerQuery, token))
  )

  const seen = new Set<string>()
  const pins: PinterestPin[] = []

  for (const r of results) {
    if (r.status === 'rejected') continue
    for (const pin of r.value) {
      if (!pin.id || seen.has(pin.id)) continue
      seen.add(pin.id)
      pins.push(pin)
    }
  }

  return pins
}

// ─────────────────────────────────────────────────────────────
// FALLBACK — Apify pinterest-scraper
// ─────────────────────────────────────────────────────────────

interface ApifyPinterestItem {
  id?:          string
  title?:       string
  alt?:         string
  description?: string
  link?:        string
  url?:         string
  imageUrl?:    string
  image?:       { src?: string } | string
  saveCount?:   number
  saves?:       number
  repins?:      number
  likeCount?:   number
  likes?:       number
  author?:      { name?: string; fullName?: string; username?: string; url?: string }
  authorName?:   string
  authorUsername?:string
  createdAt?:   string
  hashtags?:    string[]
}

async function fetchViaApify(
  startUrls: { url: string }[],
  maxItems: number,
  timeoutSecs = 25,
): Promise<PinterestPin[]> {
  const key = process.env.APIFY_API_KEY
  if (!key) return []

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~pinterest-scraper/run-sync-get-dataset-items?token=${key}&timeout=${timeoutSecs}&memory=512`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ startUrls, maxItems }),
        signal:  AbortSignal.timeout((timeoutSecs + 10) * 1_000),
      },
    )
    if (!res.ok) {
      console.error(`[pinterest-apify] ${res.status}`)
      return []
    }
    const items = await res.json() as ApifyPinterestItem[]
    if (!Array.isArray(items)) return []

    const seen = new Set<string>()
    return items
      .filter(p => {
        const id = p.id ?? p.link ?? p.url ?? ''
        if (!id || seen.has(id)) return false
        seen.add(id)
        return true
      })
      .map(p => {
        const imageUrl =
          p.imageUrl ??
          (typeof p.image === 'string' ? p.image : p.image?.src) ??
          ''
        const pinUrl =
          p.link ?? p.url ??
          (p.id ? `https://www.pinterest.com/pin/${p.id}/` : '')
        const saveCount   = p.saveCount ?? p.saves ?? p.repins ?? 0
        const authorName  = p.authorName ?? p.author?.fullName ?? p.author?.name ?? p.author?.username ?? ''
        const authorHandle = p.authorUsername ?? p.author?.username ?? ''
        return {
          id:           p.id ?? pinUrl,
          title:        p.title ?? p.alt ?? (p.description?.slice(0, 80)) ?? 'Pinterest pin',
          description:  p.description ?? '',
          url:          pinUrl,
          imageUrl,
          saveCount,
          authorName,
          authorHandle,
          createdAt:    p.createdAt ?? '',
        }
      })
      .filter(p => p.url.length > 0)
  } catch (err) {
    console.error('[pinterest-apify] fetch failed:', err)
    return []
  }
}

// ─────────────────────────────────────────────────────────────
// PUBLIC FETCHERS
// ─────────────────────────────────────────────────────────────

// Niche-based — used by Inspiration Library page

export async function fetchPinterestPins(
  niche:  string,
  region: string,
): Promise<PinterestPin[]> {
  const queries = resolveQueries(niche, region)

  // Try native API first
  if (process.env.PINTEREST_ACCESS_TOKEN) {
    try {
      const pins = await fetchViaPinterestAPI(queries, 15)
      if (pins.length > 0) {
        return pins.sort((a, b) => b.saveCount - a.saveCount).slice(0, 12)
      }
      console.warn('[pinterest] Native API returned 0 pins, falling back to Apify')
    } catch (err) {
      console.warn('[pinterest] Native API failed, falling back to Apify:', err)
    }
  }

  // Apify fallback
  const startUrls = queries.map(q => ({
    url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}&rs=typed`,
  }))
  const pins = await fetchViaApify(startUrls, 15, 25)
  return pins.sort((a, b) => b.saveCount - a.saveCount).slice(0, 12)
}

// ── Custom query fetcher (used by Copy Inspiration Engine) ────

export interface PinterestQueryInput {
  query: string
  angle?: string
}

export interface PinterestPinWithMeta extends PinterestPin {
  queryUsed:  string
  queryAngle: string
}

export async function fetchPinterestPinsCustom(
  queries:        PinterestQueryInput[],
  maxItems:       number,
  timeoutSeconds = 40,
): Promise<PinterestPinWithMeta[]> {
  if (queries.length === 0) return []

  // Try native API first
  if (process.env.PINTEREST_ACCESS_TOKEN) {
    try {
      const perQuery = Math.ceil(maxItems / queries.length)
      const raw      = await fetchViaPinterestAPI(queries.map(q => q.query), perQuery)
      if (raw.length > 0) {
        return raw.slice(0, maxItems).map(pin => ({
          ...pin,
          queryUsed:  '',
          queryAngle: '',
        }))
      }
      console.warn('[pinterest-custom] Native API returned 0 pins, falling back to Apify')
    } catch (err) {
      console.warn('[pinterest-custom] Native API failed, falling back to Apify:', err)
    }
  }

  // Apify fallback
  if (!process.env.APIFY_API_KEY) return []

  const startUrls = queries.map(q => ({
    url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q.query)}&rs=typed`,
  }))
  const raw = await fetchViaApify(startUrls, maxItems, timeoutSeconds)

  return raw.map(pin => ({
    ...pin,
    queryUsed:  '',
    queryAngle: '',
  }))
}
