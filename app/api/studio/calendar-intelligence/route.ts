import { NextRequest, NextResponse } from 'next/server'
import { anthropic, AI_MODELS } from '@/lib/ai-client'
import { geminiGenerate } from '@/lib/gemini'

export interface CalendarEvent {
  date: string
  name: string
  type: 'holiday' | 'religious' | 'cultural' | 'industry' | 'seasonal' | 'awareness'
  region: string
  relevance_score: number
  content_angle: string
  urgency: 'now' | 'this_week' | 'this_month' | 'upcoming'
}

interface RequestBody {
  industry?: string
  region?: string
  month?: number
  year?: number
  platforms?: string[]
  goal?: string
  client_name?: string
}

const SYSTEM = `You are a senior social media strategist for a MENA-based creative agency.
Your job is to identify ONLY events that create a genuine, brand-specific content opportunity — not generic tie-ins.
You filter ruthlessly. Quantity is not a goal. Quality and specificity are.
Return only valid JSON arrays.`

function buildPrompt(body: RequestBody, startDate: Date, endDate: Date): string {
  const startStr   = startDate.toISOString().split('T')[0]
  const endStr     = endDate.toISOString().split('T')[0]
  const todayStr   = startDate.toISOString().split('T')[0]
  const startMonth = startDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const endMonth   = endDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return `Today is ${todayStr}. Identify upcoming events between ${startStr} and ${endStr} that create a REAL content opportunity for this brand.

Brand context:
- Industry: ${body.industry ?? 'general'}
- Region: ${body.region ?? 'UAE'}
- Platforms: ${body.platforms?.join(', ') ?? 'Instagram, TikTok'}
- Content goal: ${body.goal ?? 'Engagement'}
- Client: ${body.client_name ?? 'unnamed brand'}
- Window: ${startMonth} → ${endMonth}

HARD RULES — if an event fails any of these, do NOT include it:
1. The event must fall between ${startStr} and ${endStr} (exact dates only)
2. The content_angle must be SPECIFIC to this industry — it must name what the post shows, teaches, or does. Generic angles ("celebrate with us", "share the love", "join the conversation") are rejected.
3. Exclude World Emoji Day, World Selfie Day, World Photography Day, World Smile Day, and all similar fabricated awareness days unless they have a direct, non-trivial link to this industry.
4. For religious events (Eid, Ramadan, etc.): only include if the event is currently active or approaching within the window AND is genuinely observed in ${body.region ?? 'UAE'}.
5. For national holidays: only include if the client's industry has a natural, non-forced tie-in — not just "celebrate UAE National Day with us."
6. Exclude any event the client's audience in ${body.region ?? 'UAE'} would not recognise or care about.

QUALITY BAR: Each event must score ≥ 7/10 on relevance. Include 5–8 events maximum. Fewer good events is better than more weak ones.

Return ONLY a valid JSON array — no markdown, no wrapper, no explanation:
[
  {
    "date": "YYYY-MM-DD",
    "name": "Event name",
    "type": "holiday" | "religious" | "cultural" | "industry" | "seasonal",
    "region": "UAE" | "Saudi Arabia" | "Egypt" | "MENA" | "Global",
    "relevance_score": 7-10,
    "content_angle": "Specific: what this post shows/says/does for a ${body.industry ?? 'brand'} brand — 1 concrete sentence"
  }
]

If you cannot find 5 genuinely relevant events, return fewer. Do not pad the list.`
}

function computeUrgency(eventDate: Date, today: Date): CalendarEvent['urgency'] {
  const diffMs   = eventDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays <= 3)  return 'now'
  if (diffDays <= 7)  return 'this_week'
  if (diffDays <= 30) return 'this_month'
  return 'upcoming'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as RequestBody

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() + 45)

    const prompt = buildPrompt(body, today, cutoff)
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

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('[calendar-intelligence] JSON parse failed:', cleaned.slice(0, 200))
      return NextResponse.json({ events: [] })
    }

    const rawEvents: CalendarEvent[] = Array.isArray(parsed)
      ? (parsed as CalendarEvent[])
      : ((parsed as { events?: CalendarEvent[] }).events ?? [])

    // Server-side filtering: valid date, within window, relevance threshold, server-computed urgency
    const events: CalendarEvent[] = rawEvents
      .filter(e => {
        if (!e.date) return false
        const d = new Date(e.date)
        if (isNaN(d.getTime())) return false
        if (d < today || d > cutoff) return false
        if ((e.relevance_score ?? 0) < 7) return false
        return true
      })
      .map(e => ({
        ...e,
        urgency: computeUrgency(new Date(e.date), today),
      }))
      .sort((a, b) => b.relevance_score - a.relevance_score)

    return NextResponse.json({ events })
  } catch (e) {
    console.error('[calendar-intelligence]', e)
    return NextResponse.json({ error: 'Failed to fetch calendar intelligence' }, { status: 500 })
  }
}
