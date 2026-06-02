// ============================================================
// Search query + niche keyword utilities
// All AI calls use Gemini Flash (fast, cheap).
// ============================================================

import { geminiJson } from '@/lib/gemini'

export const ARABIC_REGIONS = new Set(['AE', 'SA', 'EG', 'JO', 'KW', 'QA'])

export const COUNTRY_NAMES: Record<string, string> = {
  EG: 'Egypt', SA: 'Saudi Arabia', AE: 'UAE', JO: 'Jordan',
  KW: 'Kuwait', QA: 'Qatar', US: 'United States', GB: 'United Kingdom',
  AU: 'Australia', CA: 'Canada', FR: 'France', DE: 'Germany', global: 'Global',
}

export const INDIAN_EXCLUSIONS = '-hindi -telugu -tamil -kannada -marathi -bollywood'

// ── Niche keyword extractor ───────────────────────────────────
// Returns terms that MUST appear in a video to be considered on-niche.
// Used as a pre-filter BEFORE the AI ranking call.

export async function getNicheKeywords(niche: string, region: string): Promise<string[]> {
  // Always include the raw niche words themselves
  const rawWords = niche.toLowerCase().split(/[\s\-_,]+/).filter(w => w.length > 2)

  if (!process.env.GEMINI_API_KEY) return rawWords

  const isArabic = ARABIC_REGIONS.has(region)

  const prompt = `List the specific terms that MUST appear in the title, description, or tags of a video to confirm it is about "${niche}".

${isArabic ? 'Include both English AND Arabic terms.' : 'English terms only.'}

Rules:
- Only terms that are UNIQUE to this niche — not generic words like "tips", "guide", "tutorial", "how to"
- Include specialty terms, procedure names, equipment names, professional titles related to this niche
- 6 to 12 terms, all lowercase
- If the niche is in English, provide the exact English terms used by practitioners

Return ONLY a JSON array of strings. No explanation, no markdown.
Example for "dental clinic": ["dentist","dental","teeth","tooth","oral","cavity","braces","implant","orthodontic","whitening","اسنان","عيادة اسنان"]`

  try {
    const result = await geminiJson<string[]>(prompt, undefined, {
      temperature:     0.1,
      maxOutputTokens: 250,
    })
    if (Array.isArray(result) && result.length > 0) {
      const aiKeywords = result
        .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        .map(k => k.toLowerCase().trim())
      return [...new Set([...rawWords, ...aiKeywords])]
    }
  } catch { /* fallback to raw words */ }

  return rawWords
}

// ── Search query generator ────────────────────────────────────
// Generates 3 platform-aware queries for any niche.
// For predefined niches the hardcoded banks in the route take priority —
// this fires only for custom/unknown niches.

export async function generateSearchQueries(
  niche:    string,
  region:   string,
  platform: 'youtube' | 'tiktok' = 'youtube',
): Promise<string[]> {
  if (!process.env.GEMINI_API_KEY) return basicFallback(niche, region)

  const isArabic    = ARABIC_REGIONS.has(region)
  const countryName = COUNTRY_NAMES[region] ?? region

  const langInstruction = isArabic
    ? `Language: ALL 3 queries MUST be in Arabic script. Target: ${countryName} Arabic-speaking audience.`
    : `Language: English. Target: ${region === 'global' ? 'global' : countryName} audience.`

  const platformNote = platform === 'tiktok'
    ? 'short viral TikTok videos'
    : 'YouTube tutorial/review/educational videos'

  const prompt = `You are a content discovery expert. Generate exactly 3 search queries to find trending ${platformNote} about: "${niche}"

${langInstruction}

STRICT rules:
1. Every query must contain a core term from the niche itself (e.g. for "dental clinic": must contain "dental", "dentist", "teeth", or Arabic equivalent)
2. Never generate generic queries that could match ANY niche (e.g. "tips 2025", "tutorial guide")
3. Cover 3 different content angles: patient/customer results, professional tips or explanation, before/after or product review
4. 3 to 7 words per query, phrased naturally as a YouTube/TikTok searcher would type

Return ONLY a JSON array of exactly 3 strings. No markdown, no explanation.`

  try {
    const result = await geminiJson<string[]>(prompt, undefined, {
      temperature:     0.2,
      maxOutputTokens: 200,
    })
    if (Array.isArray(result) && result.length > 0) {
      const valid = result.filter(
        (q): q is string => typeof q === 'string' && q.trim().length > 3
      ).slice(0, 3)
      if (valid.length >= 2) return valid
    }
  } catch { /* fallback */ }

  return basicFallback(niche, region)
}

function basicFallback(niche: string, region: string): string[] {
  if (ARABIC_REGIONS.has(region)) {
    return [`${niche} عربي`, `${niche} نصائح`, `${niche} تعليمي`]
  }
  return [`"${niche}" tutorial`, `"${niche}" tips`, `"${niche}" review`]
}
