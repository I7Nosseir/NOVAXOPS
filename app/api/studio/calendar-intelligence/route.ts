import { NextRequest, NextResponse } from 'next/server'
import { anthropic, AI_MODELS } from '@/lib/ai-client'
import { geminiGenerate } from '@/lib/gemini'

export interface CalendarEvent {
  date: string          // ISO 8601, e.g. "2026-06-15"
  name: string
  type: 'holiday' | 'religious' | 'cultural' | 'industry' | 'seasonal' | 'awareness'
  region: string        // "Global" | "UAE" | "Saudi Arabia" | etc.
  relevance_score: number  // 1-10
  content_angle: string    // How to tie content to this moment
  urgency: 'now' | 'this_week' | 'this_month' | 'upcoming'
}

interface RequestBody {
  industry?: string
  region?: string          // e.g. "UAE", "Saudi Arabia", "Egypt", "Global"
  month?: number           // 1-12; defaults to current month
  year?: number
  platforms?: string[]
  goal?: string
  client_name?: string
}

const SYSTEM = `You are a strategic social media calendar analyst specializing in the MENA region.
Given a brand's industry, region, and goal, identify the most relevant upcoming events, holidays, and cultural moments for social media content.
Focus on moments that create genuine content opportunities — not superficial tie-ins.
Return only valid JSON.`

function buildPrompt(body: RequestBody, month: number, year: number): string {
  const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' })
  return `Identify all relevant upcoming events for social media content planning.

Context:
- Industry: ${body.industry ?? 'general'}
- Region: ${body.region ?? 'UAE / MENA'}
- Month: ${monthName} ${year}
- Platforms: ${body.platforms?.join(', ') ?? 'Instagram, TikTok'}
- Goal: ${body.goal ?? 'Engagement'}
- Client: ${body.client_name ?? 'unknown brand'}

Return a JSON array of events (10-15 items). Each event MUST follow this exact shape:
{
  "date": "YYYY-MM-DD",
  "name": "string",
  "type": "holiday" | "religious" | "cultural" | "industry" | "seasonal" | "awareness",
  "region": "string",
  "relevance_score": 1-10,
  "content_angle": "string — specific creative angle for this client",
  "urgency": "now" | "this_week" | "this_month" | "upcoming"
}

Include: national holidays for the region, Islamic calendar dates (Ramadan, Eid, etc. if applicable), global awareness days, industry-specific events, seasonal moments.
Sort by relevance_score descending.
Return ONLY the JSON array, no markdown, no explanation.`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as RequestBody

    const now   = new Date()
    const month = body.month ?? now.getMonth() + 1
    const year  = body.year  ?? now.getFullYear()

    const prompt = buildPrompt(body, month, year)
    let raw = ''

    if (process.env.ANTHROPIC_API_KEY) {
      const msg = await anthropic.messages.create({
        model:      AI_MODELS.primary,
        max_tokens: 2048,
        system:     SYSTEM,
        messages:   [{ role: 'user', content: prompt }],
      })
      raw = (msg.content[0] as { text: string }).text ?? ''
    } else {
      raw = await geminiGenerate(prompt, SYSTEM, { jsonMode: true, maxOutputTokens: 2048 })
    }

    // Strip potential markdown fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    let events: CalendarEvent[] = []
    try {
      const parsed = JSON.parse(cleaned)
      events = Array.isArray(parsed) ? parsed : (parsed.events ?? [])
    } catch {
      console.error('[calendar-intelligence] JSON parse failed:', cleaned.slice(0, 200))
      events = []
    }

    // Filter to requested month + keep upcoming months too
    const relevant = events.filter(e => {
      if (!e.date) return false
      const d = new Date(e.date)
      return !isNaN(d.getTime())
    })

    return NextResponse.json({ events: relevant, month, year })
  } catch (e) {
    console.error('[calendar-intelligence]', e)
    return NextResponse.json({ error: 'Failed to fetch calendar intelligence' }, { status: 500 })
  }
}
