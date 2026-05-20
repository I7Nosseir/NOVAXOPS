import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { getArabicDialectGuide, getClientDialect, HUMANIZATION_RULES_EN, HUMANIZATION_RULES_AR } from '@/lib/arabic-dialect'

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

interface GeminiImage { base64: string; mimeType: string }

async function callGemini(prompt: string, image?: GeminiImage): Promise<string> {
  const key = process.env.GEMINI_API_KEY!
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`
  const parts: object[] = []
  if (image) parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } })
  parts.push({ text: prompt })
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.status.toString())
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
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
  imageBase64?: string; mimeType?: string; fileType?: 'image' | 'video'
}

// Agents that operate on a specific task and benefit from caching
const CACHEABLE_AGENTS = new Set(['task_analyzer', 'copywriter', 'researcher', 'asset_finder', 'presentation_builder'])

export async function POST(req: NextRequest) {
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
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { agent, client, task, project } = body
  const clientName = client?.name ?? 'the client'
  const brandVoice = client?.brand_identity?.tone_of_voice ?? 'professional'
  const audience = client?.brand_identity?.target_audience ?? 'general audience'
  const keyMessages = client?.brand_identity?.key_messages?.join(', ') ?? ''
  const competitors = client?.competitor_context?.join(', ') ?? 'not specified'
  const industry = client?.brand_identity?.industry ?? 'unspecified'

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
    case 'copywriter':
      prompt = `You are a behavioural copywriter at NOVAX agency. You apply neuroscience and persuasion science to write social media copy that maximises scroll-stop rate, emotional engagement, and conversion.

TASK CONTEXT
Task: ${task?.title}
Description: ${task?.description}
Pipeline Stage: ${task?.pipeline_stage}
Client: ${clientName}
Brand Voice: ${brandVoice}
Target Audience: ${audience}
Key Messages: ${keyMessages}

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

Return ONLY a valid JSON array, no markdown, no code fences, no explanation:
[
  {"id":"v1","label":"AIDA — Aspirational","tone":"Elegant & story-driven","framework":"AIDA","hook":"<first line only, max 125 chars>","text":"<full copy>"},
  {"id":"v2","label":"PAS — Problem-led","tone":"Urgent & empathetic","framework":"PAS","hook":"<first line only, max 125 chars>","text":"<full copy>"},
  {"id":"v3","label":"Social Currency","tone":"Peer-to-peer","framework":"STEPPS","hook":"<first line only, max 125 chars>","text":"<full copy>"}
]`
      break

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
    case 'moderation_reply':
      prompt = `You are a community manager for ${clientName}. Apply the Service Recovery Paradox: a well-handled complaint generates MORE brand loyalty than a complaint-free experience (McCollough & Bharadwaj, 1992). This reply is an opportunity, not a problem.

CONTEXT
Platform: ${body.platform ?? 'social media'}
Commenter: ${body.commenterName}
Their comment: "${body.commentText}"
Post they commented on: "${(body.postCaption ?? '').slice(0, 150)}"
Brand voice: ${brandVoice}
Target audience: ${audience}

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
      const fileType = body.fileType ?? 'image'
      if (body.imageBase64 && body.mimeType) {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
        const mt = validTypes.includes(body.mimeType as typeof validTypes[number])
          ? (body.mimeType as typeof validTypes[number])
          : 'image/jpeg'
        imageBlock = {
          type: 'image',
          source: { type: 'base64', media_type: mt, data: body.imageBase64 },
        }
      }

      prompt = `You are a creative performance scientist specialising in social media virality. Apply neuroscience, behavioural psychology, and platform algorithm research to evaluate this creative asset with clinical precision.

CLIENT CONTEXT
Client: ${clientName}
Brand Voice: ${brandVoice}
Target Audience: ${audience}
Asset Type: ${fileType}${fileType === 'video' ? '\nNote: You are analysing the first frame of the video — evaluate hook strength and opening composition.' : ''}

SCORING DIMENSIONS — score each 0–100 based strictly on what you observe. Be calibrated: 85+ is genuinely exceptional. A score of 70 means "good, above average." A score of 50 means "average, would be scrolled past by most."

1. THUMB-STOP RATE
   Scientific basis: Meta/Facebook research shows average mobile scroll dwell time is 1.7 seconds. Content must interrupt this within the first viewing glance.
   Evaluate: Pre-attentive attributes present (colour contrast, human face/eye contact, motion energy, pattern interruption, size anomaly). Novelty vs familiarity balance — too familiar = ignored, too unfamiliar = confusing.
   90-100: Would halt >80% of target audience scrolls immediately
   70-89: Strong hook, minor friction
   50-69: Generic, blend-in content — majority scrolls past
   <50: Invisible in feed

2. EMOTIONAL RESONANCE
   Scientific basis: Berger & Milkman (2012) — high-arousal emotions (awe, excitement, anger, amusement) drive sharing at 2× the rate of low-arousal emotions (contentment, sadness). Positive high-arousal is optimal for brand content.
   Evaluate: Which specific emotion from Plutchik's wheel does this activate? Intensity of that activation. Valence (positive/negative). Whether a face or expression is present (faces are the highest-salience pre-attentive trigger).
   Score the arousal level AND appropriateness for ${clientName}'s brand.

3. BRAND COHERENCE
   Scientific basis: Consistent brand presentation across channels increases revenue by 23% (Lucidpress 2019). Visual inconsistency creates cognitive dissonance that reduces purchase intent.
   Evaluate: Primary/secondary colour match to stated brand, composition style match, subject matter alignment with brand archetype (${brandVoice}), typography/overlay text consistency if present.

4. MESSAGE CLARITY — 3-SECOND TEST
   Scientific basis: Sweller's Cognitive Load Theory — working memory holds 7±2 chunks (Miller's Law). Overloaded visuals force active reading effort which kills scroll-stop rate.
   Evaluate: Can the core message be extracted in under 3 seconds? Visual hierarchy (most important element = highest contrast/largest)? Information density? CTA visibility and specificity? Text-to-visual ratio?
   90-100: Message extracted in <1.5 seconds
   70-89: Extractable in 3 seconds
   <50: Requires active effort to decode

5. VISUAL QUALITY
   Evaluate: Technical sharpness and focus accuracy. Exposure and colour grading quality. Composition adherence (rule of thirds, golden ratio, negative space, leading lines). Subject-to-background contrast ratio. Depth of field appropriateness.

6. SHARE & SAVE POTENTIAL
   Scientific basis: Jonah Berger's STEPPS framework — Social currency (sharer looks good), Triggers (memory cue exists), Emotion (high arousal), Public (visible use signal), Practical value (useful information), Stories (narrative arc).
   Evaluate: Which STEPPS elements are present? Content that earns saves = practical value. Content that earns shares = social currency + emotional arousal. Score based on density of STEPPS triggers present.

7. PLATFORM FIT
   Evaluate: Aspect ratio optimisation (9:16 for Reels/TikTok, 1:1 or 4:5 for Instagram feed), text density (Facebook penalises >20% text overlay), sound-off clarity (85% of Facebook video watched muted — Nielsen), mobile-first composition, platform-native style (does it look native or cross-posted?).

WEIGHTED OVERALL SCORE
overall = (thumb_stop_rate × 0.25) + (emotional_resonance × 0.20) + (brand_coherence × 0.15) + (message_clarity × 0.15) + (visual_quality × 0.10) + (share_save_potential × 0.10) + (platform_fit × 0.05)

ADDITIONAL INTELLIGENCE:
- psychological_triggers: Which specific Cialdini principles or behavioural triggers are visible (Social Proof, Scarcity, Authority, Curiosity Gap, Loss Aversion, Reciprocity, Liking, Unity)?
- viral_elements: List specific visual or content elements present that are known virality drivers
- missing_elements: Specific elements that, if added, would materially increase virality score (be concrete — not "add more emotion" but "adding a human face in the upper-left quadrant would increase thumb-stop rate by an estimated 15-25%")
- platform_recommendations: Which 2-3 platforms this creative is best suited for and the specific technical reason
- ab_test_suggestion: One specific element to A/B test — describe both the control and the variant precisely

Return ONLY a valid JSON object, no markdown, no code fences:
{
  "overall": <number>,
  "thumb_stop_rate": <number>,
  "emotional_resonance": <number>,
  "brand_coherence": <number>,
  "message_clarity": <number>,
  "visual_quality": <number>,
  "share_save_potential": <number>,
  "platform_fit": <number>,
  "virality_score": <composite 0-100 based on emotional_resonance + share_save_potential + thumb_stop_rate, weighted equally>,
  "engagement_prediction": "low" | "medium" | "high" | "viral",
  "psychological_triggers": ["<specific trigger present>"],
  "viral_elements": ["<specific element driving virality>"],
  "missing_elements": ["<specific element with estimated impact>"],
  "platform_recommendations": ["<Platform: specific technical reason>"],
  "ab_test_suggestion": "<Control: X vs Variant: Y — what to measure>",
  "strengths": ["<evidence-based observation referencing what you see>"],
  "improvements": ["<specific, measurable improvement with expected outcome>"]${body.fileType === 'video' ? ',\n  "hook_analysis": "<Frame-by-frame: what fires in 0-3s, what fails, scroll-stop probability estimate>"' : ''}
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

    default:
      return NextResponse.json({ error: `Unknown agent type: ${agent}` }, { status: 400 })
  }

  try {
    let text = ''
    let usedModel = model
    let cost_usd = 0
    let tokensIn = 0
    let tokensOut = 0

    if (useAnthropic) {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const content: Anthropic.MessageParam['content'] = imageBlock
        ? [imageBlock, { type: 'text', text: prompt }]
        : prompt

      const response = await anthropic.messages.create({
        model,
        max_tokens: 2048,
        messages: [{ role: 'user', content }],
      })

      text = response.content[0].type === 'text' ? response.content[0].text : ''
      tokensIn = response.usage.input_tokens
      tokensOut = response.usage.output_tokens
      cost_usd = (tokensIn * 0.000003) + (tokensOut * 0.000015)
    } else {
      const geminiImage: GeminiImage | undefined =
        body.imageBase64 && body.mimeType
          ? { base64: body.imageBase64, mimeType: body.mimeType }
          : undefined
      text = await callGemini(prompt, geminiImage)
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
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
