// ============================================================
// AI-powered search query generator
// Fires when a niche isn't in the predefined query banks.
// Uses Gemini Flash to produce targeted, platform-aware queries.
// ============================================================

import { geminiJson } from '@/lib/gemini'

export const ARABIC_REGIONS = new Set(['AE', 'SA', 'EG', 'JO', 'KW', 'QA'])

export const COUNTRY_NAMES: Record<string, string> = {
  EG: 'Egypt', SA: 'Saudi Arabia', AE: 'UAE', JO: 'Jordan',
  KW: 'Kuwait', QA: 'Qatar', US: 'United States', GB: 'United Kingdom',
  AU: 'Australia', CA: 'Canada', FR: 'France', DE: 'Germany', global: 'Global',
}

export const INDIAN_EXCLUSIONS = '-hindi -telugu -tamil -kannada -marathi -bollywood'

/**
 * Generates 3 search queries for any niche using Gemini.
 * Returns Arabic queries for MENA regions, English otherwise.
 */
export async function generateSearchQueries(
  niche:    string,
  region:   string,
  platform: 'youtube' | 'tiktok' = 'youtube',
): Promise<string[]> {
  if (!process.env.GEMINI_API_KEY) return basicFallback(niche, region)

  const isArabic    = ARABIC_REGIONS.has(region)
  const countryName = COUNTRY_NAMES[region] ?? region

  const langInstruction = isArabic
    ? `Target audience: ${countryName} Arabic-speaking. ALL 3 queries MUST be written in Arabic script.`
    : `Target audience: ${region === 'global' ? 'global English-speaking' : countryName}. Queries in English.`

  const platformNote = platform === 'tiktok'
    ? 'short viral TikTok videos (15-60 seconds)'
    : 'YouTube educational/tutorial/review videos'

  const prompt = `You are a content discovery specialist. Generate 3 highly targeted search queries to find trending ${platformNote} in the "${niche}" niche.

${langInstruction}

Requirements:
- SPECIFIC to this exact niche — not generic health/lifestyle/business content
- Use exact terminology that real ${niche} practitioners and their audiences use
- Cover 3 different content angles: e.g. educational/how-to, results/transformation, tips/advice
- For professional niches (medical, legal, dental, etc.): include patient-facing AND professional content angles
- Queries should be 3-6 words, natural search phrasing

Return ONLY a valid JSON array of exactly 3 strings. No markdown, no explanation.
Example: ["dental implants before after", "dentist explains tooth pain", "cosmetic dentistry tips"]`

  try {
    const result = await geminiJson<string[]>(prompt, undefined, {
      temperature:     0.3,
      maxOutputTokens: 200,
    })
    if (Array.isArray(result) && result.length > 0) {
      return result
        .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
        .slice(0, 3)
    }
  } catch { /* use fallback */ }

  return basicFallback(niche, region)
}

function basicFallback(niche: string, region: string): string[] {
  if (ARABIC_REGIONS.has(region)) {
    return [`${niche} عربي`, `${niche} نصائح`, `${niche} تعليمي`]
  }
  return [`${niche} tutorial`, `${niche} tips guide`, `${niche} explained`]
}
