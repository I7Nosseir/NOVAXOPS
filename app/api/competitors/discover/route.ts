import { NextRequest, NextResponse } from 'next/server'

const HAS_ANTHROPIC = !!process.env.ANTHROPIC_API_KEY
const HAS_GEMINI    = !!process.env.GEMINI_API_KEY

/**
 * POST /api/competitors/discover
 * Body: { client_id, industry, client_name, audience? }
 * Returns: { suggestions: { handle: string; platform: string; reason: string }[] }
 *
 * Uses Claude (or Gemini fallback) to suggest 5–8 realistic competitor handles
 * for the client's industry and niche.
 */
export async function POST(req: NextRequest) {
  let body: { client_id?: string; industry?: string; client_name?: string; audience?: string }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { industry, client_name, audience } = body
  if (!industry && !client_name) {
    return NextResponse.json({ error: 'industry or client_name required' }, { status: 400 })
  }

  const prompt = `You are a competitive intelligence researcher for a social media agency.

Client: ${client_name ?? 'Unknown'}
Industry: ${industry ?? 'Unknown'}
${audience ? `Audience: ${audience}` : ''}

Suggest 6–8 realistic competitor social media accounts for this client. These should be:
- Real competitor brand types (not made-up) in the same industry and region
- Mix of platforms: Instagram, TikTok, LinkedIn, YouTube
- Accounts the client should monitor and benchmark against

Return ONLY valid JSON — no markdown, no explanation:
{
  "suggestions": [
    { "handle": "@example_handle", "platform": "Instagram", "reason": "One sentence why this is a relevant competitor to watch" }
  ]
}`

  try {
    let raw = ''

    if (HAS_ANTHROPIC) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      })
      raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
    } else if (HAS_GEMINI) {
      const { geminiGenerate } = await import('@/lib/gemini')
      raw = await geminiGenerate(prompt, undefined, { jsonMode: true, maxOutputTokens: 800 })
    } else {
      return NextResponse.json({ error: 'No AI provider configured' }, { status: 503 })
    }

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const parsed = JSON.parse(cleaned) as { suggestions: { handle: string; platform: string; reason: string }[] }
    return NextResponse.json({ suggestions: parsed.suggestions ?? [] })
  } catch (err) {
    console.error('[competitors/discover]', err)
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
  }
}
