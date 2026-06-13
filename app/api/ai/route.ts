import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'
import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { getArabicDialectGuide, getClientDialect, HUMANIZATION_RULES_EN, HUMANIZATION_RULES_AR } from '@/lib/arabic-dialect'
import type { ArabicDialect } from '@/lib/arabic-dialect'
import { buildClientIntelligenceBlock } from '@/lib/client-intelligence'
import { aiGuard } from '@/lib/ai-guard'

const PRIMARY_MODEL = 'claude-sonnet-4-6'
const ADVANCED_MODEL = 'claude-opus-4-7'
const GEMINI_MODEL = 'gemini-3-flash-preview'

// In-memory rate limit: 10 requests per unique key per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 10) return false
  entry.count++
  return true
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

function promptHash(agent: string, taskId: string, title: string, desc: string): string {
  return createHash('sha256').update(`${agent}:${taskId}:${title}:${desc}`).digest('hex')
}

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// ── Arabic Knowledge Base cache (10-min TTL, shared across requests) ──────────
interface KBRow { context_rules: string; banned_phrases: string[] | null; category: string }
let kbCache: { data: KBRow[]; fetchedAt: number } | null = null
const KB_TTL_MS = 10 * 60 * 1000

async function fetchDialectRules(
  dialect: ArabicDialect,
  db: ReturnType<typeof adminSupabase>
): Promise<string> {
  if (!db) return getArabicDialectGuide(dialect) // fallback to hardcoded module

  const now = Date.now()
  if (!kbCache || now - kbCache.fetchedAt > KB_TTL_MS) {
    const { data } = await db
      .from('arabic_knowledge_base')
      .select('context_rules, banned_phrases, category')
      .eq('is_active', true)
    kbCache = { data: (data ?? []) as KBRow[], fetchedAt: now }
  }

  const rows = kbCache.data

  const allBanned = rows
    .flatMap(r => r.banned_phrases ?? [])
    .filter(Boolean)

  const dbLayer = rows.length > 0
    ? `\nBANNED ARABIC PHRASES (critical — never use in any output):\n${allBanned.map(p => `• "${p}"`).join('\n')}`
    : ''

  // Combine the hardcoded dialect guide (rich vocabulary + culture) with DB banned phrases
  return getArabicDialectGuide(dialect) + dbLayer
}

interface GeminiImage { base64: string; mimeType: string }

async function callGemini(prompt: string, image?: GeminiImage): Promise<string> {
  const key = process.env.GEMINI_API_KEY!
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`
  const parts: object[] = []
  if (image) {
    console.log(`[callGemini] Attaching inline_data: ${image.mimeType}, base64 size: ${Math.round(image.base64.length / 1024)}KB`)
    parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } })
  }
  parts.push({ text: prompt })
  const bodyStr = JSON.stringify({ contents: [{ parts }] })
  console.log(`[callGemini] Request body size: ${Math.round(bodyStr.length / 1024)}KB`)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: bodyStr,
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.status.toString())
    console.error(`[callGemini] Error ${res.status}:`, err.slice(0, 300))
    throw new Error(`Gemini error ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  console.log(`[callGemini] Response text length: ${text.length} chars`)
  return text
}

interface AIRequest {
  agent: string
  task?: { id: string; title: string; description: string; pipeline_stage: string }
  client?: {
    id: string; name: string
    brand_identity: {
      tone_of_voice: string; target_audience: string; key_messages: string[]
      industry: string; primary_color?: string; secondary_color?: string
    }
    competitor_context?: string[]
  }
  project?: { name: string }
  commentText?: string; commenterName?: string; postCaption?: string; platform?: string
  brief?: string; month?: string; frequency?: string; language?: 'en' | 'ar'
  media_url?: string  // public image or video URL — images passed as vision block, videos as text context
  imageBase64?: string; mimeType?: string; fileType?: 'image' | 'video' | 'text' | 'pdf'
  fileBase64?: string; fileMimeType?: string  // direct file upload (PDF etc) — bypasses text extraction
  fileUrl?: string  // public URL — route fetches server-side to avoid Vercel body size limits
  textContent?: string
  platforms?: string[]
  evalMode?: 'strategy' | 'content'
  contentType?: 'copy' | 'data'
}

// Agents that operate on a specific task and benefit from caching
const CACHEABLE_AGENTS = new Set(['task_analyzer', 'copywriter', 'researcher', 'asset_finder', 'presentation_builder'])

export async function POST(req: NextRequest) {
  const guard = await aiGuard()
  if (guard) return guard

  const useAnthropic = !!process.env.ANTHROPIC_API_KEY
  if (!useAnthropic && !process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'No AI API key configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env.local.' }, { status: 500 })
  }

  const ip = getClientIp(req)
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Max 10 AI requests per minute.' }, { status: 429 })
  }

  let body: AIRequest
  try {
    const ct = req.headers.get('content-type') ?? ''
    if (ct.includes('multipart/form-data')) {
      // File upload path — PDF sent as binary FormData to avoid JSON body size limits
      const fd = await req.formData()
      const paramsRaw = fd.get('params')
      body = JSON.parse(typeof paramsRaw === 'string' ? paramsRaw : '{}') as AIRequest
      const file = fd.get('file')
      if (file && file instanceof Blob) {
        const ab = await file.arrayBuffer()
        body.fileBase64 = Buffer.from(ab).toString('base64')
        body.fileMimeType = file.type || 'application/pdf'
        console.log(`[multipart] PDF base64 size: ${Math.round(body.fileBase64.length / 1024)}KB, mime: ${body.fileMimeType}`)
      }
    } else {
      body = await req.json()
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  // If client uploaded PDF to Supabase Storage and sent us the public URL,
  // fetch it server-side (outbound — no Vercel body size limit) and base64-encode for Gemini
  if (body.fileUrl && body.fileType === 'pdf' && !body.fileBase64) {
    try {
      const r = await fetch(body.fileUrl)
      if (!r.ok) throw new Error(`Failed to fetch PDF: ${r.status}`)
      const ab = await r.arrayBuffer()
      body.fileBase64 = Buffer.from(ab).toString('base64')
      body.fileMimeType = 'application/pdf'
      console.log(`[fileUrl] Fetched PDF, base64 size: ${Math.round(body.fileBase64.length / 1024)}KB`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[fileUrl] PDF fetch failed:', msg)
      return NextResponse.json({ error: `Could not retrieve uploaded PDF: ${msg}` }, { status: 500 })
    }
  }

  const { agent, client, task, project } = body
  const clientName = client?.name ?? 'the client'
  const brandVoice = client?.brand_identity?.tone_of_voice ?? 'professional'
  const audience = client?.brand_identity?.target_audience ?? 'general audience'
  const keyMessages = client?.brand_identity?.key_messages?.join(', ') ?? ''
  const competitors = client?.competitor_context?.join(', ') ?? 'not specified'
  const industry = client?.brand_identity?.industry ?? 'unspecified'

  // Arabic dialect context — used by copywriter, moderation_reply, and caption agents
  const clientDialect = getClientDialect((client?.brand_identity ?? {}) as Record<string, unknown>)
  const clientLang = (client?.brand_identity as Record<string, unknown> | undefined)?.language as string | undefined
  const isArabicClient = clientLang === 'ar' || clientLang === 'both'
  const requestLang = body.language ?? (isArabicClient ? 'ar' : 'en')

  // Cache check for task-scoped agents
  const db = adminSupabase()
  const canCache = CACHEABLE_AGENTS.has(agent) && !!task?.id && !!db
  const hash = canCache ? promptHash(agent, task!.id, task!.title, task!.description ?? '') : ''

  if (canCache) {
    const { data: cached } = await db!
      .from('ai_responses')
      .select('response_json, model_used, cost_usd')
      .eq('task_id', task!.id)
      .eq('agent_type', agent)
      .eq('prompt_hash', hash)
      .maybeSingle()

    if (cached) {
      return NextResponse.json({
        text: (cached.response_json as { output_text: string }).output_text,
        model: cached.model_used,
        cost_usd: cached.cost_usd,
        cached: true,
      })
    }
  }

  let prompt = ''
  let model = PRIMARY_MODEL
  let imageBlock: Anthropic.ImageBlockParam | null = null
  let fileBlock: Anthropic.DocumentBlockParam | null = null
  let maxTokensOverride: number | null = null
  let enableThinking = false

  switch (agent) {

    // ─────────────────────────────────────────────────────────────────────────
    case 'task_analyzer':
      prompt = `You are a senior project analyst at NOVAX, a social media agency. Apply the SMART criteria framework and creative brief quality assessment to analyse this task.

TASK CONTEXT
Title: ${task?.title}
Description: ${task?.description}
Pipeline Stage: ${task?.pipeline_stage}
Client: ${clientName}
Brand Voice: ${brandVoice}
Target Audience: ${audience}
Key Messages: ${keyMessages}

EVALUATION FRAMEWORK

**Brief Summary**
2-3 sentences. What is being made, for what strategic purpose, by when, for whom. Be specific — reference actual words from the brief.

**SMART Brief Assessment**
Score the brief on each criterion (Complete / Partial / Missing):
- Specific: Is the deliverable clearly defined (format, quantity, platform)?
- Measurable: Is there a success metric or KPI attached?
- Achievable: Is the scope realistic for this pipeline stage?
- Relevant: Does it connect to the client's key messages and brand goals?
- Time-bound: Is a due date or deadline referenced?

**Missing Information**
Bullet each gap that must be resolved before work begins. Prioritise by impact. Write "None — brief is complete." if nothing is missing.

**Suggested Execution Approach**
3-4 numbered steps, ordered by dependency. Each step should be one concrete action (e.g. "Draft 3 caption variants using the Benefit-led framework before seeking client approval" not "Write captions").

**Risk Matrix**
For each risk: [Risk] — Probability: Low/Medium/High — Impact: Low/Medium/High — Mitigation.
Write "No significant risks identified." if clean.

No hashtags. No emojis. Be direct and specific.`
      break

    // ─────────────────────────────────────────────────────────────────────────
    case 'copywriter': {
      const isArCopy = requestLang === 'ar'
      const copyDialectGuide = isArCopy ? await fetchDialectRules(clientDialect, db) : ''
      const copyHumanRules = isArCopy ? HUMANIZATION_RULES_AR : HUMANIZATION_RULES_EN
      const copyLangNote = isArCopy
        ? 'LANGUAGE: Generate ALL THREE VARIANTS in Arabic using the dialect specified above. The "text" and "hook" fields must be in Arabic. The "label", "tone", and "framework" fields stay in English for UI display.'
        : 'LANGUAGE: Generate all variants in English.'

      prompt = `You are a behavioural copywriter at NOVAX agency. You apply neuroscience and persuasion science to write social media copy that maximises scroll-stop rate, emotional engagement, and conversion.

TASK CONTEXT
Task: ${task?.title}
Description: ${task?.description}
Pipeline Stage: ${task?.pipeline_stage}
Client: ${clientName}
Brand Voice: ${brandVoice}
Target Audience: ${audience}
Key Messages: ${keyMessages}
${copyDialectGuide}

SCIENTIFIC COPY FRAMEWORKS — generate one variant per framework:

VARIANT 1 — AIDA (Attention → Interest → Desire → Action)
Scientific basis: Classic response hierarchy model. First line must fire a pre-attentive interrupt — something unexpected, counterintuitive, or emotionally loaded that halts scroll in under 1 second.
Hook (Attention): Pattern-interrupt. Unexpected angle, specific number, or counterintuitive statement.
Body (Interest + Desire): Build emotional investment. Use sensory language and future-self visualisation — place the reader in the moment after purchase. Apply loss aversion naturally ("don't let..." / "before it's gone").
CTA (Action): Specific and frictionless. One clear directive.
Tone: ${brandVoice}

VARIANT 2 — PAS (Problem → Agitation → Solution)
Scientific basis: High-arousal negative emotions (anxiety, frustration) increase sharing by 2x (Berger & Milkman, 2012). Amplifying pain before presenting relief creates stronger desire.
Hook (Problem): Open with the target audience's exact pain point in their own language. Uncomfortably specific.
Body (Agitation): Intensify the consequence of not solving it. Make the status quo feel untenable.
Solution: Present the product as the inevitable resolution. Use social proof language ("thousands of..." / "the same formula that...").
Tone: Empathetic but urgent.

VARIANT 3 — SOCIAL CURRENCY + STORY (Berger's STEPPS Framework)
Scientific basis: People share content that makes them look good or feel part of an in-group (Social Currency). Stories are processed 22x more memorably than facts (Stanford). Practical value drives saves.
Hook: Position reader inside an aspirational in-group identity or open with a surprising story/fact they'd want to pass on.
Body: Embed practical value or a narrative the reader wants to share — the "share motivation" must be intrinsic to the content, not added on.
CTA: Identity-affirming ("This is for people who..." / "Join the...").
Tone: Peer-to-peer, warm, conversational — never brand-to-consumer.

RULES FOR ALL VARIANTS:
- No hashtags or emojis unless the task description explicitly requests them
- First line must work standalone (visible before "see more" on Instagram/Facebook — max 125 characters)
- Each variant must use a different emotional lever — not just tone variation
- Match ${clientName}'s brand voice throughout

${copyHumanRules}

${copyLangNote}

Return ONLY a valid JSON array, no markdown, no code fences, no explanation:
[
  {"id":"v1","label":"AIDA — Aspirational","tone":"Elegant & story-driven","framework":"AIDA","hook":"<first line only, max 125 chars>","text":"<full copy>"},
  {"id":"v2","label":"PAS — Problem-led","tone":"Urgent & empathetic","framework":"PAS","hook":"<first line only, max 125 chars>","text":"<full copy>"},
  {"id":"v3","label":"Social Currency","tone":"Peer-to-peer","framework":"STEPPS","hook":"<first line only, max 125 chars>","text":"<full copy>"}
]`
      break
    }

    // ─────────────────────────────────────────────────────────────────────────
    case 'researcher':
      model = ADVANCED_MODEL
      prompt = `You are a strategic intelligence analyst at NOVAX, a social media agency. Apply competitive intelligence methodology, virality science, and platform algorithm research.

TASK CONTEXT
Task: ${task?.title}
Description: ${task?.description}
Client: ${clientName}
Industry: ${industry}
Competitors: ${competitors}
Brand Voice: ${brandVoice}
Target Audience: ${audience}

**MARKET CONTEXT — Quantified Trend Intelligence**
3-4 trends directly relevant to this task. Each must include: specific data point, approximate source (e.g. "Mintel 2025", "Meta Business Insights Q1 2025"), and the content opportunity it opens. Not generic industry facts — specific openings.

**COMPETITIVE GAP MATRIX — Blue Ocean Analysis**
Apply Blue Ocean Strategy (Kim & Mauborgne): map where competitors compete on the SAME axis, then identify the axis they are ALL ignoring.
For each competitor named:
- Dominant content strategy (what they post, what tone, what format)
- Primary weakness / content blind spot
Then: The uncontested territory ${clientName} can own.

**VIRALITY EMOTION MAP — Arousal-Valence Analysis**
Scientific basis: Berger & Milkman (2012) — high-arousal emotions (awe, excitement, anger, anxiety) drive 2x more sharing than low-arousal (contentment, sadness). Positive high-arousal outperforms negative for brand content.
- Identify the single highest-arousal emotion accessible to ${audience} in this context
- Explain WHY this emotion is accessible (what in their life creates it)
- How to trigger it within the first 3 seconds of content

**HASHTAG ARCHITECTURE — Tiered Strategy**
Research-backed: 3-5 targeted hashtags outperform 30 generic ones. Tier by reach vs engagement tradeoff:
- Mega (1M+ posts) — 1 tag: reach play, low discovery probability, brand awareness only
- Macro (100K–1M posts) — 2-3 tags: balance of reach and discoverability
- Micro (10K–100K posts) — 3-4 tags: highest engagement rate per impression
- Niche (<10K posts) — 1-2 tags: highest relevance, community-building
Format each as: #Tag — [Tier] (~XK posts) — [specific reason to use for this campaign]

**CONTENT ANGLES — Ranked by Viral Potential**
4 angles, ranked 1–4 by estimated viral potential. For each:
- Angle title
- Format: Reel / Carousel / Static / Story (with specific reason)
- Psychological mechanism driving engagement (specific — e.g. "triggers autonomy bias in the target demo", not "resonates with audience")
- Opening hook (first line or first frame concept, specific to this task)`
      break

    // ─────────────────────────────────────────────────────────────────────────
    case 'asset_finder':
      prompt = `You are a visual direction specialist at NOVAX, a social media agency. Apply visual saliency science, colour psychology, and composition theory to recommend assets.

TASK CONTEXT
Task: ${task?.title}
Description: ${task?.description}
Client: ${clientName}
Industry: ${industry}
Brand Colors: ${client?.brand_identity?.primary_color ?? 'unspecified'} (primary), ${client?.brand_identity?.secondary_color ?? 'unspecified'} (secondary)
Target Audience: ${audience}

**GOOGLE DRIVE SEARCH TERMS**
List 5 specific search terms to find relevant assets in the client's Google Drive.
For each, specify:
**[N]. "[Precise search term]"** — [File type: image/video/document]
→ Use case: [Specific post type from this task]
→ Visual direction: [Lighting, composition, colour temperature]

**AI GENERATION PROMPTS**
5-6 Higgsfield/Flux prompts for this task. Each prompt must specify:
- Subject + action
- Lighting (golden hour / soft studio / high contrast rim light / etc.)
- Camera angle and distance (close-up / eye-level / 45-degree overhead / etc.)
- Colour palette alignment to brand
- Mood/emotion to trigger
Format: "[Full generation prompt]" — [Emotional target: what feeling this evokes in ${audience}]

**VISUAL HIERARCHY RECOMMENDATION**
Apply Gestalt principles: which single visual element should dominate 60% of the frame and why. What should be secondary (30%) and tertiary (10%). How text overlay (if any) should be positioned based on F-pattern eye tracking.`
      break

    // ─────────────────────────────────────────────────────────────────────────
    case 'presentation_builder':
      prompt = `You are a management consultant building a client-facing presentation for NOVAX agency. Apply the Minto Pyramid Principle: lead with the insight, support with data, end with action.

TASK CONTEXT
Task: ${task?.title}
Description: ${task?.description}
Client: ${clientName}
Project: ${project?.name ?? 'current campaign'}

Structure a 12-slide presentation using BLUF (Bottom Line Up Front) — every slide title should state the conclusion, not just the topic (e.g. "Instagram Drove 73% of Total Reach" not "Platform Breakdown").

For each slide format as:
**Slide [N]: [Insight-led title — states the finding, not the category]**
- [Key data point or insight bullet 1]
- [Key data point or insight bullet 2]
- Visualisation: [Specific chart type — e.g. grouped bar chart, horizontal waterfall, screenshot grid — and WHY this chart type best encodes this data per Cleveland & McGill visual hierarchy]

Apply MECE principle (Mutually Exclusive, Collectively Exhaustive) — no slide content should overlap with another.

Slide order:
1. Executive Summary (BLUF — 3 key findings in 30 seconds)
2. Campaign Objective vs Actual
3. Total Reach & Impression Trend (30-day line chart)
4. Platform Performance Matrix
5. Top 5 Posts — Why They Won (screenshot grid + metric overlay)
6. Audience Growth & Quality
7. Content Pillar Performance (value vs promotional vs brand)
8. Competitor Share of Voice
9. Hashtag ROI Analysis
10. Community Sentiment Summary
11. Budget Efficiency — Cost Per Engagement
12. Next 30 Days: 3 Recommended Actions (decision-ready)

End the response with exactly this line:
**File:** ${clientName.replace(/\s+/g, '')}_${new Date().toISOString().slice(0, 7)}_Report.pptx — Ready to download`
      break

    // ─────────────────────────────────────────────────────────────────────────
    case 'moderation_reply': {
      const isArMod = requestLang === 'ar' || isArabicClient
      const modDialectGuide = isArMod ? await fetchDialectRules(clientDialect, db) : ''
      const modLangNote = isArMod
        ? `\nLANGUAGE: Reply in Arabic using the dialect specified above. Sound like a human community manager, not a corporate account.`
        : ''

      prompt = `You are a community manager for ${clientName}. Apply the Service Recovery Paradox: a well-handled complaint generates MORE brand loyalty than a complaint-free experience (McCollough & Bharadwaj, 1992). This reply is an opportunity, not a problem.

CONTEXT
Platform: ${body.platform ?? 'social media'}
Commenter: ${body.commenterName}
Their comment: "${body.commentText}"
Post they commented on: "${(body.postCaption ?? '').slice(0, 150)}"
Brand voice: ${brandVoice}
Target audience: ${audience}
${modDialectGuide}${modLangNote}

SENTIMENT CLASSIFICATION
Classify the comment internally: Positive / Question / Complaint / Criticism / Neutral

APPLY THE HEARD FRAMEWORK:
- Hear: Acknowledge what they said specifically — mirror their words back (linguistic mirroring builds rapport)
- Empathize: Validate the emotion without admitting fault
- Apologize: If negative — genuine, non-defensive, not over-apologetic
- Resolve: Answer the question or offer a path forward
- Diagnose: (only if needed publicly) What would help resolve this

RESPONSE RULES:
- 1-3 sentences maximum — every word earns its place
- No hashtags, no emojis, no exclamation marks for negative comments
- Match ${clientName}'s brand voice exactly — not "brand voice adjacent"
- Sound like a senior human, not a customer service bot
- Never use: "We're sorry to hear that", "We apologise for any inconvenience", "Please DM us" as the entire reply — these are trust-destroyers
- If positive: reciprocate warmth genuinely, add a brand-relevant detail
- If it's a question: answer it directly in the reply — do not deflect

Return ONLY the reply text. No quotes, no labels, no explanation.`
      break
    }

    // ─────────────────────────────────────────────────────────────────────────
    case 'content_calendar': {
      model = ADVANCED_MODEL
      const [yr, mo] = (body.month ?? '2026-05').split('-').map(Number)
      const daysInMonth = new Date(yr, mo, 0).getDate()
      const postsPerWeek = parseInt(body.frequency ?? '3')
      const totalPosts = Math.round(postsPerWeek * (daysInMonth / 7))
      const monthName = new Date(yr, mo - 1, 1).toLocaleString('en', { month: 'long' })
      const calLang = body.language ?? 'en'
      const langInstruction = calLang === 'ar'
        ? '\nLANGUAGE: Generate ALL post titles, content types, and anchor event names in Arabic (Modern Standard Arabic). Return the JSON with Arabic text in the "title" and "type" fields. Keep "platform" values in English (instagram, facebook, etc.).'
        : '\nLANGUAGE: Generate all content in English.'

      prompt = `You are a content strategy scientist at NOVAX agency. Apply platform algorithm research, audience circadian data, narrative sequencing theory, and cultural intelligence to build a high-performance content calendar.

CLIENT CONTEXT
Client: ${clientName}
Industry: ${industry}
Brand Voice: ${brandVoice}
Target Audience: ${audience}
Key Messages: ${keyMessages}
Campaign Brief: ${body.brief}
Month: ${monthName} ${yr} (${daysInMonth} days)
Posts Per Week: ${postsPerWeek}
Total Posts Target: ${totalPosts}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — IDENTIFY ANCHOR DATES FOR ${monthName.toUpperCase()} ${yr}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before building the calendar, identify every relevant date in this month across three categories:

A) ISLAMIC CALENDAR DATES
Research the accurate Gregorian equivalents for ${monthName} ${yr}. Include all relevant Islamic observances such as:
- Ramadan (start/end)
- Eid al-Fitr
- Eid al-Adha
- Arafah (Day of Arafat — the day before Eid al-Adha)
- Muharram / Islamic New Year (Hijri New Year)
- Ashura (10th Muharram)
- Mawlid al-Nabi (Prophet's Birthday)
- Laylat al-Qadr (Night of Power — last 10 nights of Ramadan)
- Isra' and Mi'raj
- Sha'ban 15 (Mid-Sha'ban)
Only list Islamic dates that ACTUALLY FALL in ${monthName} ${yr}. If none fall this month, state that explicitly. These are priority anchor posts — the whole week's content should build toward them.

B) GLOBAL AWARENESS DAYS & INTERNATIONAL EVENTS relevant to ${industry}
Examples: World Health Day (Apr 7), International Women's Day (Mar 8), World Mental Health Day (Oct 10), Earth Day (Apr 22), Black Friday, back-to-school season, Valentine's Day, etc.
Only include dates RELEVANT to this client's industry and audience. Do not list generic unrelated days.

C) REGIONAL / NATIONAL EVENTS
Include any known public holidays, national days, or cultural moments relevant to the target audience (${audience}) that fall in ${monthName} ${yr}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — BUILD THE CALENDAR WITH ANCHOR POSTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ANCHOR DATE RULES:
- Every identified anchor date MUST have a post on that exact day (or 1 day before for Islamic events like Eid, since "day of" audiences are offline praying)
- Build a lead-up post 3-5 days before major Islamic events (teaser/anticipation)
- Do NOT post promotional content on the day of Eid, Arafah, or major Islamic observances — only heartfelt, respectful, community content
- For Ramadan: shift posting times to after Iftar (7:30pm–9:30pm) and after Suhoor (4am–5am) — these are peak engagement windows during Ramadan
- Mark anchor posts with anchor_type: "islamic", "global", or "regional"

NARRATIVE ARC SEQUENCING (non-anchor posts follow this arc):
Week 1 — Awareness: curiosity gaps, teasers, problem-establishment
Week 2 — Consideration: education, behind-the-scenes, social proof
Week 3 — Conversion: offers, urgency, testimonials, demos
Week 4 — Community: recaps, UGC, loyalty content, next chapter teaser

PLATFORM ALGORITHM TIMING:
Instagram Feed: 9am, 6pm
Instagram Reels: 9am, 12pm, 7pm
TikTok: 7am, 7pm
Facebook: 9am, 1pm (weekdays)
LinkedIn: 8am–10am Tue–Thu ONLY
During Ramadan: shift all times 2-3 hours later (post-Iftar peak)

CONTENT PILLAR RATIO (5-3-2):
50% Value/Education — highest save rate
30% Soft brand/storytelling — highest share rate
20% Direct promotion — highest conversion
Never place a direct promotion post on an Islamic anchor date.

VIRALITY SEQUENCING:
High-arousal post → follow within 48h with social proof
Carousel → follow next week with Reel of same topic

RULES:
- Post titles must be specific to the brief and the anchor event — never generic
- Spread regular posts evenly (Tue–Thu weighted)
- Anchor posts override normal spacing rules — they must be on the anchor date

${langInstruction}

Return ONLY a valid JSON array, no markdown, no code fences. Each post object must include all fields:
[
  {
    "day": 1,
    "time": "09:00",
    "platform": "instagram",
    "type": "Awareness — Curiosity Teaser",
    "title": "<specific title referencing the brief>",
    "anchor": null
  },
  {
    "day": 5,
    "time": "19:30",
    "platform": "instagram",
    "type": "Eid al-Adha — Community",
    "title": "<heartfelt Eid greeting tied to the brand>",
    "anchor": "Eid al-Adha"
  }
]
The "anchor" field is null for regular posts and a string (event name) for anchor posts.`
      break
    }

    // ─────────────────────────────────────────────────────────────────────────
    case 'creative_eval': {
      maxTokensOverride = 4000
      model = ADVANCED_MODEL
      const fileType = body.fileType ?? 'image'
      const evalPlatforms: string[] = Array.isArray(body.platforms) && body.platforms.length > 0
        ? body.platforms as string[]
        : []
      const platformStr = evalPlatforms.length > 0 ? evalPlatforms.join(', ') : 'General social media'

      const isPdfMode = fileType === 'pdf' || (!!body.fileBase64 && body.fileMimeType?.includes('pdf'))

      // Build PDF file block for Anthropic (Claude)
      if (isPdfMode && body.fileBase64 && body.fileMimeType?.includes('pdf')) {
        console.log(`[creative_eval] PDF received, base64 size: ${Math.round(body.fileBase64.length / 1024)}KB`)
        fileBlock = {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: body.fileBase64 },
        }
      }

      // Build image block for Anthropic (image/video thumbnail)
      if (!isPdfMode && body.imageBase64 && body.mimeType) {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
        const mt = validTypes.includes(body.mimeType as typeof validTypes[number])
          ? (body.mimeType as typeof validTypes[number])
          : 'image/jpeg'
        imageBlock = {
          type: 'image',
          source: { type: 'base64', media_type: mt, data: body.imageBase64 },
        }
      }

      const assetTypeLabel = isPdfMode
        ? 'Script / copy document (PDF — read and evaluate the full content)'
        : fileType === 'video'
          ? 'Video (first-frame thumbnail analysis)'
          : 'Static image'

      prompt = `You are a senior creative strategist and performance scientist. You evaluate social media content the way a rigorous, experienced strategist would — with calibrated standards, evidence-based reasoning, and willingness to give low scores when the work doesn't earn high ones.

You do NOT inflate scores to be encouraging. You do NOT give 75+ just because a piece looks "professional." You score against world-class benchmarks, not "for a brand this size."

═══════════════════════════════════════════════════════
CLIENT CONTEXT
═══════════════════════════════════════════════════════
Client: ${clientName}
Industry: ${industry}
Brand Voice / Tone: ${brandVoice}
Target Audience: ${audience}
Key Messages: ${keyMessages || 'Not specified'}
Competitors: ${competitors}
Target Platforms: ${platformStr}
Asset Type: ${assetTypeLabel}
${isPdfMode ? 'The creative content is in the attached PDF — read it fully before scoring.' : ''}

═══════════════════════════════════════════════════════
CALIBRATION MANDATE — READ BEFORE SCORING
═══════════════════════════════════════════════════════
The global distribution of brand social media content scores like this:
- 90–100: Benchmark-setting. World-class creative agencies produce this 1 in 50 attempts.
- 75–89: Genuinely strong. Clear strategic intent, well-executed. Top 15% of content.
- 60–74: Competent. Does the job, forgettable in 24h. Most professionally-produced content lands here.
- 45–59: Below average. Generic, interchangeable, scrolled past by the majority.
- Below 45: Actively harmful to brand — confusing, off-brand, or technically broken.

Before assigning any score above 75, you MUST cite the specific named element that earns it.
Before assigning any score above 85, you MUST reference a specific industry benchmark this content matches or surpasses.
If you cannot produce that evidence, score lower.

═══════════════════════════════════════════════════════
STEP 1 — RED FLAG SCAN (run before scoring)
═══════════════════════════════════════════════════════
Check for these automatic score-capping conditions. If present, the affected dimension CANNOT exceed 65:
- Stock photo aesthetic or generic lifestyle imagery → caps thumb_stop_rate
- Brand name or logo as the primary visual element → caps thumb_stop_rate
- Copy that starts with the brand name → caps message_clarity
- Zero CTA or vague CTA ("learn more", "check us out") → caps share_save_potential
- Copy that talks about the brand rather than to the audience → caps emotional_resonance
- Visual aspect ratio wrong for stated platform → caps platform_fit
- Claim the brand cannot credibly make (credibility gap) → caps brand_coherence

List any red flags found in "red_flags" array. Apply caps to affected dimensions.

═══════════════════════════════════════════════════════
STEP 2 — ATTENTION ARCHITECTURE ANALYSIS
═══════════════════════════════════════════════════════
Evaluate in three windows (critical for reels/video; adapt for static/text):

WINDOW 1 — 0 to 1.7 seconds (Pre-attentive hook)
Meta research: average mobile scroll dwell time is 1.7s. The visual must trigger a pre-attentive response — colour contrast, human face/eye contact, motion energy, size anomaly, pattern interruption — before the viewer consciously decides to stop.
What specifically fires in this window? What fails?

WINDOW 2 — 1.7 to 7 seconds (Retention driver)
The viewer has stopped. Now they need a reason to continue. This window must answer: "Why should I keep watching/reading this?"
What is the retention mechanism here? Curiosity gap, promised value, story tension, social proof setup?

WINDOW 3 — 7 seconds+ (Payoff architecture)
What does the viewer get for their attention? Is there a payoff that makes them feel the time was worth it — information, emotion, entertainment, identity affirmation?
For text content, treat as: Opening / Middle / Resolution.

═══════════════════════════════════════════════════════
STEP 3 — SEVEN CORE DIMENSIONS (score 0–100 each)
═══════════════════════════════════════════════════════

1. THUMB-STOP RATE
Basis: Meta/Facebook 1.7s scroll-dwell research. Pre-attentive attributes: colour contrast, human face/eye contact, motion energy, pattern interruption, size anomaly. Novelty-familiarity balance.
90–100: Halts >80% of target audience. Cites a specific pre-attentive trigger.
70–89: Strong hook, minor friction, clear visual priority.
50–69: Generic or blend-in — majority scrolls past.
<50: Invisible in feed. No pre-attentive trigger present.

2. EMOTIONAL RESONANCE
Basis: Berger & Milkman (2012) — high-arousal emotions drive sharing at 2× the rate of low-arousal. Optimal for brand: positive high-arousal (awe, excitement, amusement). Presence of a human face = highest-salience pre-attentive trigger.
Name the specific Plutchik emotion activated. Assess intensity and valence. Score arousal level AND appropriateness for ${clientName}'s voice.

3. BRAND COHERENCE
Basis: Consistent brand presentation increases revenue 23% (Lucidpress 2019). Visual inconsistency creates cognitive dissonance.
Assess: colour match, compositional style, subject matter alignment to brand archetype (${brandVoice}), credibility of claim vs. earned brand authority. Would a loyal customer instantly recognise this as ${clientName}? Would they be surprised? That surprise is a coherence failure.

4. MESSAGE CLARITY — 3-SECOND TEST
Basis: Sweller's Cognitive Load Theory. Working memory: 7±2 chunks. Visual hierarchy must surface the single most important message at highest contrast/largest scale.
90–100: Core message extracted in <1.5s, zero ambiguity.
70–89: Clear in 3 seconds, minor decoding effort.
50–69: Requires active reading effort, competing visual priorities.
<50: Ambiguous, confused, or absent message.

5. VISUAL QUALITY
Assess: technical sharpness, exposure and colour grading, composition (rule of thirds / golden ratio / negative space / leading lines), subject-background contrast, text legibility, depth of field. For text content: typographic hierarchy, whitespace, readability score.

6. SHARE & SAVE POTENTIAL
Basis: Berger's STEPPS — Social Currency, Triggers, Emotion, Public signal, Practical Value, Stories. Saves = practical value. Shares = social currency + arousal.
Name which STEPPS elements are present. Score density of triggers. No triggers = score <50.

7. PLATFORM FIT
Platforms: ${platformStr}
${isPdfMode
  ? 'Assess: copy length vs platform norms, caption structure, CTA format, tone-of-voice fit per platform, opening line vs character limits.'
  : 'Assess: aspect ratio fit (9:16 for Reels/TikTok, 1:1 or 4:5 for Instagram feed), text overlay density (Facebook penalises >20%), sound-off clarity (85% of Facebook video watched muted — Nielsen), mobile-first composition, platform-native vs cross-posted feel.'}

═══════════════════════════════════════════════════════
STEP 4 — THREE STRATEGIC DIMENSIONS (score 0–100 each)
═══════════════════════════════════════════════════════

8. STRATEGIC CONTRIBUTION
Does this piece contribute to long-term brand memory structure (Byron Sharp: mental availability), or is it pure activation? Is that the right call for the funnel stage implied? Does it reinforce a consistent distinctive brand asset — a colour, phrase, visual motif — or could it have been posted by any brand in this industry?
90–100: Unmistakably ${clientName}. Reinforces a specific brand asset. Strategic role is explicit.
70–89: Clear brand voice, but could be replicated by a careful competitor.
50–69: Interchangeable. No distinctiveness. Tactical only.
<50: Actively erodes brand identity.

9. AUDIENCE TRUTH
Is this piece built on a real human insight — a specific tension, aspiration, or unspoken truth the audience holds — or is it built on demographic assumptions?
"25–35F interested in beauty" is NOT an insight.
"She's spent years believing skincare is complicated, and secretly suspects it's all a marketing myth" IS an insight.
Score how deep the audience understanding goes. Shallow = score <55. Real tension articulated = score 75+. Audience feels seen = score 85+.

10. CREDIBILITY GAP
Can ${clientName} credibly make this claim based on its earned authority in the market? Does the visual match the verbal promise? Would a cynical consumer believe this, or would they roll their eyes?
100 = zero gap. Claim is fully earned. 0 = massive gap, brand has no authority to make this claim.
Note: This dimension inverts — a HIGH score means LOW credibility gap (good). Score <50 means the brand is reaching beyond its authority and eroding trust.

═══════════════════════════════════════════════════════
STEP 5 — STRESS TEST (adversarial review)
═══════════════════════════════════════════════════════
Argue AGAINST this content. Write the strongest objection a skeptical senior strategist with 20 years of experience would make after seeing this piece. Be specific and evidence-based.
Then decide: is that objection fatal (it kills the piece) or manageable (the piece works despite it)?
Then write the rebuttal: why the piece works anyway, or why it doesn't.

═══════════════════════════════════════════════════════
STEP 6 — CONCRETE REWRITE SUGGESTIONS (top 3 only)
═══════════════════════════════════════════════════════
For the 3 highest-impact improvements, provide a specific rewrite — not advice, an actual rewrite.
Each suggestion must name: the element, what it currently says/shows, the exact replacement, the expected lift, and why it works.
If the content is text, provide the rewritten line verbatim. If visual, describe the specific change to composition/subject/treatment.

═══════════════════════════════════════════════════════
WEIGHTED OVERALL SCORE
═══════════════════════════════════════════════════════
overall = (thumb_stop_rate × 0.20) + (emotional_resonance × 0.15) + (brand_coherence × 0.12) + (message_clarity × 0.13) + (visual_quality × 0.08) + (share_save_potential × 0.10) + (platform_fit × 0.07) + (strategic_contribution × 0.08) + (audience_truth × 0.05) + (credibility_gap × 0.02)

virality_score = (thumb_stop_rate × 0.35) + (emotional_resonance × 0.35) + (share_save_potential × 0.30)

engagement_prediction rules:
- "viral": overall >= 82 AND virality_score >= 80
- "high": overall >= 70 OR virality_score >= 72
- "medium": overall >= 55
- "low": everything else

═══════════════════════════════════════════════════════
LANGUAGE MANDATE — CRITICAL
═══════════════════════════════════════════════════════
Write ALL text fields in plain, direct English. Do NOT cite academic authors or paper years (no "Berger 2012", no "Byron Sharp", no "Sweller"). Do NOT use framework acronyms in output text (no STEPPS, AIDA, PAS, BLUF, MECE, STEPPS). Explain everything as if briefing a talented content creator — be specific about what you see, why it works or doesn't, and exactly what to change. No fake precision on percentages (don't say "+40% scroll-stop rate" — say "this will grab attention much faster").

═══════════════════════════════════════════════════════
OUTPUT — return ONLY valid JSON, no markdown, no fences
═══════════════════════════════════════════════════════
{
  "overall": <number>,
  "thumb_stop_rate": <number>,
  "emotional_resonance": <number>,
  "brand_coherence": <number>,
  "message_clarity": <number>,
  "visual_quality": <number>,
  "share_save_potential": <number>,
  "platform_fit": <number>,
  "strategic_contribution": <number>,
  "audience_truth": <number>,
  "credibility_gap": <number>,
  "virality_score": <number>,
  "engagement_prediction": "low" | "medium" | "high" | "viral",
  "attention_architecture": {
    "hook_window": <0-100 score for the first 3 seconds>,
    "retention_driver": <0-100 score for the middle section>,
    "payoff_quality": <0-100 score for the ending payoff>,
    "verdict": "<one plain sentence: what works and what doesn't at each stage>"
  },
  "stress_test": {
    "skeptic_objection": "<the strongest plain-language objection a tough critic would raise>",
    "is_objection_fatal": <true|false>,
    "rebuttal": "<plain explanation: why it works despite the objection, or why it doesn't>"
  },
  "rewrite_suggestions": [
    {
      "element": "<Opening hook | Headline | CTA | Visual treatment | Body copy>",
      "current": "<what it currently says or shows>",
      "suggested": "<the exact rewrite or specific visual change — be concrete>",
      "expected_lift": "<plain description of what will improve — e.g. 'much stronger opening' not '+40%'>",
      "reasoning": "<plain English: why this specific change will work better>"
    }
  ],
  "red_flags": ["<specific issue found in plain language, or empty array>"],
  "score_evidence": [
    {
      "dimension": "<dimension name>",
      "score": <number>,
      "evidence": "<what you specifically see in this content that justifies this score>",
      "benchmark": "<in plain terms, what great content looks like for this dimension>"
    }
  ],
  "psychological_triggers": ["<plain English description of the emotional or behavioral hook this uses — e.g. 'makes viewers feel like insiders' not 'Social Currency (STEPPS)'>"],
  "viral_elements": ["<specific element driving virality, explained simply>"],
  "missing_elements": ["<what's missing and why adding it would help, in plain terms>"],
  "platform_recommendations": ["<Platform name: plain reason this content fits or doesn't for that platform>"],
  "ab_test_suggestion": "<what to test and what you'd expect to learn — in plain terms>",
  "strengths": ["<specific, plain observation about what works and why>"],
  "improvements": ["<clear, actionable improvement — what to change and why it will help, no jargon>"]${fileType === 'video' ? ',\n  "hook_analysis": "<Plain description of what happens in the first 3 seconds — what grabs attention, what doesn\'t, and what to fix>"' : isPdfMode ? ',\n  "hook_analysis": "<Plain analysis of the opening line — does it make the reader want to continue? What would make it stronger?>"' : ''}
}`
      break
    }

    // ─────────────────────────────────────────────────────────────────────────
    case 'strategy_eval': {
      maxTokensOverride = 16000
      enableThinking = true
      model = ADVANCED_MODEL
      // Build file block if a PDF was uploaded (Claude path)
      if (body.fileBase64 && body.fileMimeType === 'application/pdf') {
        console.log(`[strategy_eval] PDF received, base64 size: ${Math.round(body.fileBase64.length / 1024)}KB`)
        fileBlock = {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: body.fileBase64 },
        }
      }
      const strategyText = body.textContent ?? ''
      const hasPdf = !!body.fileBase64 && !!body.fileMimeType?.includes('pdf')

      prompt = `You are a senior brand strategist with 20 years of experience across global agencies. You evaluate strategies the way a rigorous CMO or strategy director would — looking for logical coherence, real audience insight, executable plans, and genuine differentiation. You do not flatter weak strategy with polite language.

Your standard: a strategy that earns 80+ could be presented to a Fortune 500 CMO without embarrassment. Most strategies score 55–70. Truly world-class strategies are rare.

═══════════════════════════════════════════════════════
CLIENT CONTEXT
═══════════════════════════════════════════════════════
Client: ${clientName}
Industry: ${industry}
Brand Voice: ${brandVoice}
Target Audience: ${audience}
Key Messages: ${keyMessages || 'Not specified'}
Competitors: ${competitors}

STRATEGY TO EVALUATE:
${hasPdf
  ? 'The strategy document is attached as a PDF. Read its full content carefully before evaluating.'
  : `"""\n${strategyText}\n"""`
}

═══════════════════════════════════════════════════════
CALIBRATION MANDATE
═══════════════════════════════════════════════════════
Score distribution for real-world brand strategies:
- 85–100: Genuinely differentiated, insight-driven, executable. Rare.
- 70–84: Solid thinking, clear POV, some gaps. Top 20% of agency work.
- 55–69: Competent but generic. Could apply to any brand in the category. Most strategies.
- 40–54: Weak. Surface-level. Built on demographic assumptions, not real tension.
- Below 40: Should be restarted. No coherent POV, no insight, no logic.

Any score above 75 requires citing the specific strategic element that earns it. If you cannot, score lower.

═══════════════════════════════════════════════════════
EIGHT STRATEGIC DIMENSIONS (score 0–100 each)
═══════════════════════════════════════════════════════

1. CLARITY OF POV
Does this strategy have a single, defensible strategic point-of-view? A clear POV says: "We believe X about the world / our audience / our category, and therefore we will do Y." Vague strategies that "aim to increase brand awareness and drive engagement" have no POV. Score ruthlessly.
90–100: One clear, surprising, defensible POV that reframes the competitive space.
70–89: Clear direction, but POV could be sharper or more differentiated.
55–69: Multiple directions pulled in parallel — no real commitment.
<55: No discernible POV. Could have been written for any brand.

2. AUDIENCE INSIGHT DEPTH
Is this strategy built on a real human tension — a specific unspoken aspiration, fear, or contradiction the audience holds? Or is it built on demographic descriptions?
"UAE women 25-40 who are interested in luxury" = demographic. Score <50.
"She wants the confidence of luxury without the guilt of spending — so she frames skincare as self-care, not indulgence" = insight. Score 80+.
A strategy built on real tension is inherently more creative, more differentiated, and more effective.

3. COMPETITIVE DIFFERENTIATION
Does this strategy do something meaningfully different from what competitors are already doing? A strategy that recommends "educational content + behind-the-scenes + user stories" is not differentiated — every brand in every category uses this playbook.
To score above 70: name at least one specific decision this strategy makes that competitors are NOT making, and explain why that gap exists to be exploited.

4. PLATFORM CALIBRATION
Is the strategy genuinely adapted per platform, or is it one content strategy posted everywhere?
Platform-specific strategy means: different objectives per platform, different content formats, different audience segments, different measurement. "Post reels on Instagram and carousels on LinkedIn" is not platform strategy — it's distribution.
90–100: Clear, differentiated strategy per platform with distinct role for each.
70–89: Good platform awareness, some differentiation.
55–69: Minimal platform-specificity — same message, different format.
<55: Platform-agnostic strategy dressed up with platform names.

5. EXECUTIONAL FEASIBILITY
Can ${clientName}'s team realistically deliver this strategy with their likely resource level? A strategy requiring daily original video production, influencer partnerships, and real-time trend response simultaneously is unexecutable for most teams.
Assess: content production volume, skill requirements, budget assumptions, timeline realism, dependency chain.
Score high only if the strategy could be delivered by a team of 2–4 people or clearly accounts for resource constraints.

6. MEASURABILITY
Are success metrics clear, specific, and tracked to strategic intent? "Grow engagement" is not measurable. "Increase save rate from 0.8% to 1.5% on carousel posts by Q3" is measurable.
90–100: Each strategic pillar has a KPI, baseline, and target date.
70–89: General metrics named, some specificity.
55–69: Metrics are listed but not tied to specific tactics or timelines.
<55: No metrics, or metrics are vanity (follower count alone).

7. CULTURAL INTELLIGENCE
Assess the strategy's fit for the MENA / regional market context (UAE, KSA, Egypt, or wherever ${clientName} operates). Does it demonstrate understanding of: local cultural calendar (Ramadan, National Days, etc.), language and dialect nuance, platform penetration differences (WhatsApp-first comms, TikTok dominance among youth, LinkedIn for B2B), and regional consumer behaviour patterns?
Score <50 if the strategy reads as a Western template applied without modification. Score 80+ if there is clear evidence of regional market intelligence.

8. STRATEGIC LOGIC
Does the strategy hold together as a logical argument? Is the chain of reasoning sound: insight → strategic choice → tactic → expected outcome?
Test: pick any recommended tactic. Can you trace it back to a specific audience insight, and forward to a measurable outcome? If you cannot, the logic is broken.
Score the coherence of the argument as a whole.

═══════════════════════════════════════════════════════
STRESS TEST — THE CORE ASSUMPTION
═══════════════════════════════════════════════════════
Identify the single most important assumption this strategy rests on. If that assumption is wrong, the strategy fails. State it explicitly. Then: what is the failure mode? What would make the strategy more resilient to that assumption being wrong?

═══════════════════════════════════════════════════════
GAPS AND QUICK WINS
═══════════════════════════════════════════════════════
critical_gaps: The 2–3 missing pieces that make execution risky right now. Be specific.
quick_wins: The 2–3 things this strategy could activate immediately (this week) for fast, visible results that would validate the strategic direction.
competitor_blind_spots: What are competitors doing well that this strategy has not accounted for or addressed?

═══════════════════════════════════════════════════════
VERDICT
═══════════════════════════════════════════════════════
One of: "world_class" | "strong" | "solid" | "needs_work" | "start_over"
And a 2–3 sentence verdict rationale: what this strategy gets right, what is broken, and the single most important thing to fix.

OVERALL SCORE = weighted average:
(clarity_of_pov × 0.18) + (audience_insight_depth × 0.18) + (competitive_differentiation × 0.15) + (platform_calibration × 0.12) + (executional_feasibility × 0.12) + (measurability × 0.10) + (cultural_intelligence × 0.10) + (strategic_logic × 0.05)

═══════════════════════════════════════════════════════
LANGUAGE MANDATE — CRITICAL
═══════════════════════════════════════════════════════
Write ALL text fields in plain, direct English. Do NOT cite academic authors or use framework acronyms (no "Byron Sharp", no "Mark Ritson", no MECE, no BLUF, no STEPPS). Explain every finding as if briefing a smart marketing team member who doesn't study strategy theory. Be specific, direct, and practical.

═══════════════════════════════════════════════════════
OUTPUT — return ONLY valid JSON, no markdown, no fences
═══════════════════════════════════════════════════════
{
  "overall": <number>,
  "clarity_of_pov": <number>,
  "audience_insight_depth": <number>,
  "competitive_differentiation": <number>,
  "platform_calibration": <number>,
  "executional_feasibility": <number>,
  "measurability": <number>,
  "cultural_intelligence": <number>,
  "strategic_logic": <number>,
  "strategic_stress_test": {
    "core_assumption": "<plain statement of the key assumption this strategy depends on>",
    "failure_mode": "<what specifically goes wrong if that assumption is false>",
    "mitigation": "<concrete change that would make the strategy work even if the assumption is wrong>"
  },
  "critical_gaps": ["<specific missing piece explained in plain terms — what's absent and why it matters>"],
  "quick_wins": ["<specific action the team can take this week — be concrete>"],
  "competitor_blind_spots": ["<what competitors are doing well that this strategy ignores — be specific>"],
  "verdict": "world_class" | "strong" | "solid" | "needs_work" | "start_over",
  "verdict_rationale": "<2-3 plain sentences: what the strategy gets right, what is broken, and the single most important thing to fix>"
}`
      break
    }

    // ─────────────────────────────────────────────────────────────────────────
    case 'post_caption': {
      const captionLang = body.language ?? 'en'
      const isArCaption = captionLang === 'ar'
      const clientDialect = getClientDialect((client?.brand_identity ?? {}) as Record<string, unknown>)
      const dialectGuide = isArCaption ? getArabicDialectGuide(clientDialect) : ''
      const humanRules = isArCaption ? HUMANIZATION_RULES_AR : HUMANIZATION_RULES_EN
      const langNote = isArCaption
        ? 'Write ALL three caption variants in Arabic. Use the dialect specified above. The "text" and "hook" fields must be in Arabic. The "label", "tone", and "framework" fields stay in English for UI display.'
        : 'Write all caption variants in English.'

      const mediaUrl = body.media_url
      const isVideoUrl = mediaUrl && /\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i.test(mediaUrl)
      const isImageUrl = mediaUrl && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(mediaUrl)
      const isStorageUrl = mediaUrl && (mediaUrl.includes('supabase') || mediaUrl.includes('/api/proxy/drive'))
      const isProxyDrive = mediaUrl?.includes('/api/proxy/drive')

      // Attach image as vision block — Claude can see images but not video frames.
      if (mediaUrl && !isVideoUrl && (isImageUrl || isStorageUrl)) {
        imageBlock = {
          type: 'image',
          source: { type: 'url', url: mediaUrl } as Anthropic.ImageBlockParam['source'],
        }
      }

      // Build media context line — images get vision, videos get descriptive text hints.
      let mediaContext = ''
      if (mediaUrl && isVideoUrl) {
        // Extract filename from URL for context hints (e.g. "product-launch-reel.mp4")
        const filename = mediaUrl.split('/').pop()?.split('?')[0] ?? ''
        const nameHint = filename && !filename.match(/^\d+$/)
          ? ` The video filename is "${filename}" — use this as a content hint.`
          : ''
        mediaContext = `\nMEDIA: This post contains a VIDEO (not an image — Claude cannot view video frames).${nameHint} Write captions that suit a video post: strong hook for the first 3 seconds, build curiosity or tell a story, and drive saves/shares. Do NOT describe visuals you cannot see — write as if the video is dynamic and engaging content aligned with the brief.`
      } else if (mediaUrl && (imageBlock || isProxyDrive)) {
        mediaContext = `\nMEDIA: The post includes the image attached. Write captions that directly describe, reference, or respond to what is shown — do not write generic brand copy.`
      } else if (mediaUrl) {
        mediaContext = `\nMEDIA: This post includes media. Write captions that reference and complement the visual content.`
      }

      prompt = `You are a behavioural copywriter at NOVAX, a social media agency. Apply neuroscience and persuasion science to write social media captions that maximise scroll-stop rate, emotional engagement, and conversion.

CLIENT CONTEXT
Client: ${clientName}
Industry: ${industry}
Brand Voice: ${brandVoice}
Target Audience: ${audience}
Key Messages: ${keyMessages}

POST BRIEF
${body.brief ?? 'Create an engaging social media post for this brand.'}${mediaContext}
${dialectGuide}

Generate three caption variants, one per framework:

VARIANT 1 — AIDA (Attention → Interest → Desire → Action)
First line must interrupt the scroll in under 1 second — counterintuitive, specific number, or emotionally loaded. Build desire with sensory language and future-self visualisation. End with one frictionless CTA.

VARIANT 2 — PAS (Problem → Agitation → Solution)
Open with the audience's exact pain point in their own words. Intensify the consequence of inaction. Present this post's message as the inevitable resolution.

VARIANT 3 — SOCIAL CURRENCY (Berger's STEPPS)
Position the reader inside an aspirational in-group or open with a shareable story/fact. Embed practical value. CTA is identity-affirming.

RULES FOR ALL VARIANTS:
- No hashtags or emojis
- First line must be under 125 characters (visible before "see more")
- Each variant must use a different emotional lever — not just tone variation
- Match ${clientName}'s brand voice throughout

${humanRules}

${langNote}

Return ONLY a valid JSON array, no markdown, no code fences, no explanation:
[
  {"id":"v1","label":"AIDA — Aspirational","tone":"Elegant & story-driven","framework":"AIDA","hook":"<first line only, max 125 chars>","text":"<full caption>"},
  {"id":"v2","label":"PAS — Problem-led","tone":"Urgent & empathetic","framework":"PAS","hook":"<first line only, max 125 chars>","text":"<full caption>"},
  {"id":"v3","label":"Social Currency","tone":"Peer-to-peer","framework":"STEPPS","hook":"<first line only, max 125 chars>","text":"<full caption>"}
]`
      break
    }

    // ─────────────────────────────────────────────────────────────────────────
    case 'humanizer': {
      const hLang = body.language ?? 'en'
      const isArH = hLang === 'ar'
      const clientDialectH = getClientDialect((client?.brand_identity ?? {}) as Record<string, unknown>)
      const dialectGuideH = isArH ? getArabicDialectGuide(clientDialectH) : ''

      if (isArH) {
        prompt = `أنت محرر محتوى بارع في جعل النصوص العربية تبدو طبيعية وإنسانية بالكامل.

مهمّتك: أعد كتابة النص التالي ليبدو كأنه كتبه مسوّق بشري ماهر — لا نموذج ذكاء اصطناعي.
${dialectGuideH}

النص الأصلي:
${body.brief}

${HUMANIZATION_RULES_AR}

قواعد إضافية:
- احتفظ بالرسالة والمنتج والعرض كما هو — غيّر فقط الأسلوب
- صوت العميل: ${brandVoice}
- الجمهور: ${audience}
- لا هاشتاقات، لا إيموجي

أعد النص فقط. بلا شرح، بلا اقتباسات، بلا عناوين.`
      } else {
        prompt = `You are a professional content editor specialised in making AI-generated text undetectable.

Your task: rewrite the text below so it reads like it was written by a skilled human copywriter — not a language model. It must pass AI detection tools (GPTZero, Originality.ai, Copyleaks).

ORIGINAL TEXT:
${body.brief}

${HUMANIZATION_RULES_EN}

ADDITIONAL RULES:
- Preserve the product, offer, brand, and core message exactly — only change HOW it's expressed
- Brand voice: ${brandVoice}
- Target audience: ${audience}
- No hashtags, no emojis
- Output length should match the input length (±20%)

Return ONLY the rewritten text. No labels, no explanation, no quotes around it.`
      }
      break
    }

    // ─────────────────────────────────────────────────────────────────────────
    case 'content_eval': {
      maxTokensOverride = 16000
      enableThinking = true
      model = ADVANCED_MODEL
      // Build file block if a document was uploaded directly (PDF etc.)
      if (body.fileBase64 && body.fileMimeType === 'application/pdf') {
        fileBlock = {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: body.fileBase64 },
        }
      }
      const evalPlatform = body.platform ?? 'unspecified'
      const isDataEval = body.contentType === 'data'

      if (isDataEval) {
        // ── Data / Analytics intelligence mode ───────────────────────────────
        prompt = `You are a world-class social media data analyst — the calibre of Sprout Social's intelligence team, HubSpot's content research division, and Hootsuite's global analytics unit. You analyse raw performance data with the rigor of McKinsey and the platform depth of Later Media.

CLIENT CONTEXT
Client: ${clientName}
Industry: ${industry}
Platform Focus: ${evalPlatform}

RAW DATA TO ANALYSE:
${body.brief ?? ''}

─────────────────────────────────────────────────────────────────
ANALYSIS FRAMEWORK — apply ALL lenses below:
─────────────────────────────────────────────────────────────────

STEP 1 — IDENTIFY what type of data this is:
- Social media performance export (ER, reach, impressions, likes, comments, saves, shares)
- Content calendar data (dates, formats, captions, platforms)
- Audience or demographics data
- Competitor data
- A mix of the above
Note what is clearly present and what is inferred.

STEP 2 — CONTENT PERFORMANCE PATTERNS (if ER/engagement data present):
- What content types, formats, or captions drive the highest engagement rate?
- What is the mean, median, and top-decile ER across the dataset?
- 2024 INDUSTRY BENCHMARKS (Sprout Social / Hootsuite):
  * Instagram: 0.70% avg ER (range 0.54–1.22% by industry)
  * TikTok: 2.65% avg ER (range 1.5–5.96% by niche)
  * Facebook: 0.15% avg ER
  * LinkedIn: 2.74% avg ER per impression
  * YouTube: 4.0–8.0% avg ER (views-based)
- Flag content that is 2× above average — what makes those posts different?
- Flag content that is 50% below average — what do they have in common?

STEP 3 — POSTING PATTERN ANALYSIS:
- What days/times correlate with higher performance?
- Is posting frequency consistent? (HubSpot recommends 3–5x/week for Instagram, 1–2x/day for TikTok)
- Is there a drop-off in quality vs. quantity correlation?

STEP 4 — AUDIENCE SIGNAL EXTRACTION:
- Which posts drive saves (utility/value signal) vs. shares (identity signal) vs. comments (community signal)?
- What does the saves-to-reach ratio reveal about content resonance?
- Are there virality signals — posts where reach greatly exceeded follower count?

STEP 5 — BENCHMARK COMPARISON (HubSpot / Sprout Social / Hootsuite 2024):
- Compare client metrics to platform averages above
- Calculate how far above/below benchmark the dataset is performing
- Identify the single largest performance gap vs. best-in-class

STEP 6 — STRATEGIC INTELLIGENCE GAPS:
- What crucial metrics are MISSING that would complete the picture?
- What formats or content pillars are underrepresented?
- What would the McKinsey "so what" be — the single insight that changes strategy?

─────────────────────────────────────────────────────────────────
SCORING (0–100, be calibrated — 85+ is genuinely exceptional):
─────────────────────────────────────────────────────────────────
- data_quality: Completeness, consistency, structural usability. Can you extract reliable patterns?
- insight_depth: How rich are the extractable patterns? Does this data tell a strategic story?
- benchmark_alignment: How does performance compare to the 2024 industry standards above?
- strategic_clarity: How clearly does the data point to a single strategic direction?
- actionability: How easy is it to derive specific, prioritised next actions from this data?
- completeness: What % of the key metrics for a full intelligence picture are present?

overall = (insight_depth × 0.30) + (benchmark_alignment × 0.25) + (actionability × 0.20) + (data_quality × 0.15) + (strategic_clarity × 0.05) + (completeness × 0.05)

─────────────────────────────────────────────────────────────────

Return ONLY a valid JSON object, no markdown, no code fences:
{
  "overall": <0-100 weighted composite>,
  "data_quality": <0-100>,
  "insight_depth": <0-100>,
  "benchmark_alignment": <0-100>,
  "strategic_clarity": <0-100>,
  "actionability": <0-100>,
  "completeness": <0-100>,
  "content_type_detected": "<describe what type of data this is — e.g. 'Instagram performance export with reach, ER, saves'>",
  "key_findings": [
    "<specific, evidence-based finding with numbers from the actual data — e.g. 'Carousel posts average 4.2% ER vs 1.1% for static images'>",
    "<next finding — minimum 5 findings, maximum 8>"
  ],
  "benchmark_gaps": [
    "<Metric: client value (X%) vs. industry benchmark (Y%) — implication for strategy>",
    "<minimum 3, maximum 5>"
  ],
  "top_performers": [
    "<describe the pattern shared by best-performing content — format, caption style, posting time, etc.>",
    "<minimum 3, maximum 5>"
  ],
  "underperformers": [
    "<describe lowest-performing content patterns and what they have in common>",
    "<minimum 3, maximum 5>"
  ],
  "strategic_recommendations": [
    "<data-driven recommendation with specific expected impact — e.g. 'Shift 60% of posts to carousel format — projected +2.1pp ER improvement based on current pattern'>",
    "<minimum 4, maximum 6>"
  ],
  "missing_data_points": [
    "<important metric absent from the dataset that would materially improve analysis — e.g. 'Story views/exits ratio missing'>",
    "<minimum 3>"
  ],
  "priority_actions": [
    {
      "action": "<specific, concrete action>",
      "expected_impact": "<quantified expected improvement — e.g. '+1.5pp avg ER'>",
      "timeline": "<e.g. 'Next 2 weeks' or 'Q3 2025'>"
    }
  ],
  "verdict": "exceptional" | "strong" | "adequate" | "insufficient" | "unusable",
  "verdict_rationale": "<4-5 sentences: what the data reveals, how it benchmarks, the single most important strategic implication, and what the team should do next>"
}`
      } else {
        // ── Social copy evaluation mode ───────────────────────────────────────
        prompt = `You are a senior content performance analyst — the calibre of HubSpot's content team, Sprout Social's insights division, and the world's top direct-response copywriters. You evaluate social media content with the precision of a behavioural scientist and the eye of a conversion optimizer.

Apply these research frameworks with rigour:
— Fogg Behavior Model (Motivation × Ability × Trigger)
— Cialdini's 6 Principles of Persuasion (social proof, scarcity, authority, liking, reciprocity, commitment)
— Berger-Milkman Emotional Arousal Theory (high-arousal emotions = 2× shares)
— Jobs-to-be-Done Theory (what emotional or functional job does this content do?)
— Sweller's Cognitive Load Theory (working memory 7±2 chunks)
— Meta's 1.7-second mobile scroll dwell time research
— HubSpot CTA Optimization Research (specificity + friction reduction = +300% CTR)
— Nielsen's Attention Economy research (reading pattern = F-shape; opening line = 80% of value)

CLIENT CONTEXT
Client: ${clientName}
Industry: ${industry}
Brand Voice: ${brandVoice}
Target Audience: ${audience}
Platform: ${evalPlatform}

CONTENT TO EVALUATE:
${body.brief ?? ''}

─────────────────────────────────────────────────────────────────
SCORING DIMENSIONS — score each 0–100.
Calibration: 90+ = top 5% globally. 80 = strong. 70 = good but improvable. 50 = average, below-median performance. <50 = would largely be ignored.
─────────────────────────────────────────────────────────────────

1. HOOK / OPENING STRENGTH
Scientific basis: Meta research — 1.7-second average mobile scroll dwell. Nielsen: 80% of the content's value is determined by whether the opening gets read.
Evaluation criteria:
• Does the opening create a pattern interrupt (curiosity gap, counterintuitive claim, emotionally charged statement, specific number)?
• Is it under 125 characters (Instagram/Facebook "see more" threshold)?
• Does it address the reader directly or speak about a relatable scenario?
• Is it specific (numbers, names, concrete scenarios) or vague and generic?
NOTE: If this is long-form content (email, article, strategy doc) rather than a social post caption, evaluate the opening paragraph's ability to hook the reader into reading the full piece — not as a 1.7-second scroll hook but as a reader engagement mechanism.
90–100: Would halt >80% of target audience. Creates immediate investment.
70–89: Strong with minor friction — most would continue reading.
50–69: Generic opener — majority would not continue.
<50: No mechanism to capture attention — invisible in feed.

2. EMOTIONAL AROUSAL (Berger-Milkman Framework)
High-arousal emotions (awe, excitement, anger, amusement, anxiety) drive 2× more sharing than low-arousal (sadness, contentment). Positive high-arousal is the apex.
Evaluate: Which specific emotion is activated? What is the arousal intensity (low/medium/high)? Is arousal maintained throughout or front-loaded then dropped? Is this the right emotion for the content goal?

3. NARRATIVE ARC (Structural Quality)
Evaluate: Is there a clear progression — Problem → Tension → Resolution, or Hook → Story → Payoff, or Challenge → Stakes → Relief?
Does each sentence earn its place? Does content build investment before the payoff? Is there a satisfying, purposeful close?
Is the JTBD (Job-to-be-Done) fulfilled — functional or emotional job stated and resolved?

4. MESSAGE CLARITY (Cognitive Load Assessment)
Sweller: working memory holds 7±2 chunks. Overloaded copy kills conversion and sharing.
Evaluate: Can the single core message be extracted in under 3 seconds? Are sentences direct? Is vocabulary appropriate for ${audience}? Is there one primary CTA/message or multiple competing ones?

5. BRAND VOICE MATCH
Evaluate against "${brandVoice}": Does the language, formality, and vocabulary feel native to ${clientName}? Are there tonal inconsistencies? Does it feel authentic to the brand or like generic agency copy?

6. CTA EFFECTIVENESS (HubSpot Action Architecture)
HubSpot research: specific CTAs outperform vague ones by 202%. Frictionless CTAs outperform friction-heavy by 3×.
Evaluate: Is there a clear next step? Is it specific (exactly what to do)? Is it placed after value delivery (not at the top)? Does it match the content's emotional tone? Is friction minimized?

7. PLATFORM FIT (${evalPlatform} Native Format)
Evaluate: First line under 125 chars? Length appropriate for ${evalPlatform}? Line breaks used for mobile readability? Tone native to ${evalPlatform} culture? Avoids cross-posting signals? Hashtag strategy (if any) appropriate?

8. PERSUASION ARCHITECTURE (Cialdini Analysis)
Evaluate which of the 6 principles are present and how effectively deployed:
• Social Proof: numbers, testimonials, peer behaviour references
• Scarcity/Urgency: limited time, limited quantity, FOMO triggers
• Authority: expertise signals, credentials, data citations
• Liking: shared identity, empathy, warmth, humour
• Reciprocity: value given before ask
• Commitment: micro-yes moments before the main ask
Score reflects both breadth (how many present) and depth (how skillfully used).

─────────────────────────────────────────────────────────────────
WEIGHTED OVERALL:
overall = (hook_strength × 0.25) + (emotional_arousal × 0.20) + (narrative_arc × 0.15) + (message_clarity × 0.15) + (persuasion_architecture × 0.10) + (brand_voice_match × 0.08) + (cta_effectiveness × 0.05) + (platform_fit × 0.02)

virality_score: hook_strength × 0.40 + emotional_arousal × 0.35 + narrative_arc × 0.25
engagement_prediction: "viral" if overall >= 87 AND virality_score >= 82, "high" if overall >= 74, "medium" if >= 56, "low" if < 56

─────────────────────────────────────────────────────────────────

Return ONLY a valid JSON object, no markdown, no code fences:
{
  "overall": <number>,
  "hook_strength": <number>,
  "narrative_arc": <number>,
  "brand_voice_match": <number>,
  "cta_effectiveness": <number>,
  "platform_fit": <number>,
  "emotional_arousal": <number>,
  "message_clarity": <number>,
  "persuasion_architecture": <number>,
  "virality_score": <number>,
  "engagement_prediction": "low" | "medium" | "high" | "viral",
  "emotional_trigger": "<the single dominant emotion activated — be specific: 'anticipatory excitement' not 'excitement', 'righteous indignation' not 'anger'>",
  "hook_analysis": "<Analyse what fires in the opening — what is the attention mechanism? What specific words or phrases create the pattern interrupt? If no hook exists, explain what the opening does and doesn't do. How would you rewrite line 1 for maximum scroll-halt? 3-4 sentences.>",
  "cialdini_principles_used": ["<Principle Name: how it's used and effectiveness — e.g. 'Social Proof: references 10,000 customers — moderate effectiveness, too generic'>"],
  "strengths": [
    "<evidence-based strength, quoting or referencing specific words/phrases from the content — minimum 3>",
    "<min 3, max 5>"
  ],
  "improvements": [
    "<specific, actionable improvement with expected performance impact — e.g. 'Replace opening with a curiosity gap: estimated +40% scroll-stop rate'>",
    "<min 3, max 5>"
  ],
  "missing_elements": [
    "<specific missing element that would materially improve performance — be concrete and prescriptive>",
    "<min 3>"
  ],
  "platform_recommendations": [
    "<Platform (${evalPlatform}): specific technical reason this content fits or doesn't — reference character limits, algorithm signals, native format standards>"
  ],
  "ab_test_suggestion": "<Control: [quote the specific current element] vs Variant: [describe the proposed change] — Primary metric: [specific KPI] — Expected impact: [quantified projection]>",
  "hubspot_benchmark_note": "<How does this content compare to HubSpot's best practices for ${evalPlatform}? Reference their 2024 research where relevant. 2-3 sentences.>"
}`
      }
      break
    }

    default:
      return NextResponse.json({ error: `Unknown agent type: ${agent}` }, { status: 400 })
  }

  // Append client intelligence (context bank + corrections + quarter strategy) to every prompt
  if (client?.id && db) {
    try {
      const block = await buildClientIntelligenceBlock(client.id, agent, db)
      if (block) prompt = prompt + block
    } catch { /* non-critical — don't block generation */ }
  }

  try {
    let text = ''
    let usedModel = model
    let cost_usd = 0
    let tokensIn = 0
    let tokensOut = 0

    if (useAnthropic) {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

      // Build content blocks: file/image first, then prompt text
      const contentBlocks: Anthropic.MessageParam['content'] = fileBlock
        ? [fileBlock, { type: 'text', text: prompt }]
        : imageBlock
          ? [imageBlock, { type: 'text', text: prompt }]
          : prompt

      const createParams: Anthropic.MessageCreateParamsNonStreaming = {
        model,
        max_tokens: maxTokensOverride ?? 4096,
        messages: [{ role: 'user', content: contentBlocks }],
      }

      // Extended thinking — adds internal reasoning before producing output
      if (enableThinking) {
        const budget = Math.floor((maxTokensOverride ?? 4096) * 0.6) // 60% of max for thinking
        Object.assign(createParams, { thinking: { type: 'enabled', budget_tokens: budget } })
      }

      const response = await anthropic.messages.create(createParams)

      // Extract text blocks only — skip thinking blocks
      text = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.TextBlock).text)
        .join('')
      tokensIn = response.usage.input_tokens
      tokensOut = response.usage.output_tokens
      cost_usd = (tokensIn * 0.000003) + (tokensOut * 0.000015)
    } else {
      // Gemini: pass file as inline_data (supports PDF + images)
      const geminiFile: GeminiImage | undefined =
        body.fileBase64 && body.fileMimeType
          ? { base64: body.fileBase64, mimeType: body.fileMimeType }
          : body.imageBase64 && body.mimeType
            ? { base64: body.imageBase64, mimeType: body.mimeType }
            : undefined
      text = await callGemini(prompt, geminiFile)
      usedModel = GEMINI_MODEL
    }

    // Persist to Supabase (fire-and-forget — don't block response)
    if (db) {
      if (canCache && task?.id) {
        void db.from('ai_responses').upsert({
          task_id: task.id,
          agent_type: agent,
          prompt_hash: hash,
          response_json: { output_text: text },
          cost_usd,
          model_used: usedModel,
          is_cached: false,
        }, { onConflict: 'task_id,agent_type,prompt_hash' })
      }

      void db.from('api_usage').insert({
        service: useAnthropic ? 'claude' : 'gemini',
        endpoint: agent,
        task_id: task?.id ?? null,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        cost_usd,
        was_cached: false,
      })
    }

    return NextResponse.json({ text, model: usedModel, cost_usd, cached: false })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI generation failed.'
    console.error(`[AI route] agent=${agent} error:`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
