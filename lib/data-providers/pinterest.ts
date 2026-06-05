// ============================================================
// Pinterest Data Provider — Apify Pinterest Scraper
// Actor: apify/pinterest-scraper
// Searches by keyword via Pinterest search URLs.
// No OAuth required. Uses APIFY_API_KEY.
// ============================================================

import { ARABIC_REGIONS } from '@/lib/studio/query-generator'

// ── Niche → search query mapping ─────────────────────────────
// Pinterest is visual + aspirational — queries reflect that

const EN_PINTEREST_QUERIES: Record<string, string[]> = {
  beauty:             ['skincare routine aesthetic', 'beauty tips glow'],
  skincare:           ['skincare routine steps', 'glass skin tips'],
  makeup:             ['makeup look inspiration', 'everyday glam makeup'],
  'hair care':        ['hair care routine healthy', 'hair transformation tips'],
  tech:               ['tech desk setup aesthetic', 'gadget ideas workspace'],
  'AI tools':         ['AI productivity tools', 'digital workspace aesthetic'],
  food:               ['recipe ideas aesthetic', 'meal prep healthy'],
  'food recipes':     ['easy recipe inspo', 'healthy meal ideas'],
  restaurants:        ['restaurant aesthetic photography', 'food presentation ideas'],
  fitness:            ['workout plan aesthetic', 'gym motivation board'],
  'gym workout':      ['gym workout routine', 'bodybuilding tips aesthetic'],
  'yoga pilates':     ['yoga inspiration poses', 'pilates workout board'],
  'nutrition diet':   ['healthy meal plan ideas', 'clean eating inspo'],
  finance:            ['budget template aesthetic', 'financial freedom goals'],
  'personal finance': ['money saving ideas', 'budgeting tips board'],
  entrepreneurship:   ['entrepreneur motivation board', 'startup vision'],
  'real estate':      ['dream home aesthetic', 'interior design ideas house'],
  fashion:            ['outfit ideas inspo', 'fashion aesthetic board'],
  'luxury fashion':   ['luxury fashion inspo', 'designer aesthetic looks'],
  travel:             ['travel destination bucket list', 'wanderlust aesthetic'],
  'travel MENA':      ['dubai aesthetic travel', 'middle east travel inspo'],
  education:          ['study aesthetic inspo', 'learning motivation board'],
  'online courses':   ['online learning workspace', 'e-learning aesthetic'],
  marketing:          ['social media strategy ideas', 'content marketing inspo'],
  'marketing agency': ['agency branding aesthetic', 'marketing design inspiration'],
  'social media tips': ['content creator tips aesthetic', 'instagram growth inspo'],
  'dental clinic':    ['smile transformation inspiration', 'dental aesthetic'],
  'law firm':         ['professional office aesthetic', 'law firm design'],
  'interior design':  ['interior design ideas aesthetic', 'home decor inspo'],
  photography:        ['photography aesthetic ideas', 'photo shoot inspiration'],
}

const AR_PINTEREST_QUERIES: Record<string, string[]> = {
  beauty:             ['روتين جمال وبشرة', 'مكياج انسبريشن'],
  skincare:           ['روتين سكن كير', 'عناية بشرة طبيعية'],
  makeup:             ['مكياج خليجي انسبريشن', 'ميكاب عربي'],
  food:               ['وصفات اكل لذيذة', 'طبخ عربي انسبريشن'],
  fitness:            ['رياضة انسبريشن', 'جيم تمارين بورد'],
  fashion:            ['موضة خليجية انسبريشن', 'ازياء عربية'],
  travel:             ['سياحة عربية وجهات', 'سفر انسبريشن بورد'],
  'interior design':  ['ديكور منزل انسبريشن', 'تصميم داخلي'],
  marketing:          ['تسويق رقمي انسبريشن', 'محتوى سوشيال ميديا'],
  education:          ['دراسة استيثيك بورد', 'تعلم انسبريشن'],
  'real estate':      ['منزل احلام ديكور', 'عقارات تصميم'],
}

// ── Apify response shape (handled defensively) ────────────────

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
  author?:      {
    name?:     string
    fullName?: string
    username?: string
    url?:      string
  }
  authorName?:    string
  authorUsername?: string
  createdAt?:     string
  hashtags?:      string[]
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
    const arQueries = AR_PINTEREST_QUERIES[key]
    if (arQueries?.length) return arQueries.slice(0, 2)
  }

  const enQueries = EN_PINTEREST_QUERIES[key]
  if (enQueries?.length) return enQueries.slice(0, 2)

  // Custom niche: build queries from raw niche words
  return [niche, `${niche} inspiration aesthetic`]
}

// ── Main fetcher ──────────────────────────────────────────────

export async function fetchPinterestPins(
  niche:  string,
  region: string,
): Promise<PinterestPin[]> {
  const key = process.env.APIFY_API_KEY
  if (!key) return []

  const queries = resolveQueries(niche, region)

  // Build start URLs from Pinterest search
  const startUrls = queries.map(q => ({
    url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}&rs=typed`,
  }))

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~pinterest-scraper/run-sync-get-dataset-items?token=${key}&timeout=25&memory=512`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls,
          maxItems: 15,
        }),
        signal: AbortSignal.timeout(30_000),
      }
    )

    if (!res.ok) {
      console.error(`[pinterest] Apify returned ${res.status} for niche "${niche}"`)
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
        // Normalize image URL across different actor response shapes
        const imageUrl =
          p.imageUrl ??
          (typeof p.image === 'string' ? p.image : p.image?.src) ??
          ''

        // Normalize pin URL
        const pinUrl =
          p.link ??
          p.url ??
          (p.id ? `https://www.pinterest.com/pin/${p.id}/` : '')

        // Normalize save count
        const saveCount = p.saveCount ?? p.saves ?? p.repins ?? 0

        // Normalize author
        const authorName =
          p.authorName ??
          p.author?.fullName ??
          p.author?.name ??
          p.author?.username ??
          ''
        const authorHandle =
          p.authorUsername ??
          p.author?.username ??
          ''

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
      .sort((a, b) => b.saveCount - a.saveCount)
      .slice(0, 12)

  } catch (err) {
    console.error('[pinterest] fetch failed:', err)
    return []
  }
}
