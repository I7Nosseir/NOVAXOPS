// ============================================================
// POST /api/studio/copy/inspiration/harvest
//
// Phase 2 of the Pinterest Inspiration Engine:
//   1. Loads session + cluster_feedback from DB
//   2. AI generates 10 targeted queries biased toward approved clusters
//   3. Apify scrapes Pinterest (~100 raw pins)
//   4. AI scores each pin (visual / caption / structural) in parallel batches
//   5. Filters to composite_score >= 6.0, returns top 50 sorted by score
//
// Synchronous â€” client waits. Expect 35-50 seconds. maxDuration = 60.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchPinterestPinsCustom } from '@/lib/data-providers/pinterest'
import type { PinterestQueryInput } from '@/lib/data-providers/pinterest'
import { aiGuard } from '@/lib/ai-guard'

export const maxDuration = 60

// â”€â”€ Types shared with the client â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ScoredPin {
  id:              string    // pinterest_pins UUID
  imageUrl:        string
  title:           string
  description:     string
  saveCount:       number
  compositeScore:  number    // 0.0â€“10.0
  scoreRationale:  string
  styleClusterId?: string
}

export interface HarvestResponse {
  sessionId: string
  pins: ScoredPin[]
  rawCount: number
  filteredCount: number
}

// â”€â”€ Supabase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// â”€â”€ AI: generate targeted harvest queries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface HarvestQuery { angle: string; query: string }

async function generateHarvestQueries(
  briefText: string,
  platform: string,
  approvedClusters: { label: string; description: string }[],
  anthropicKey: string | undefined,
  geminiKey: string | undefined,
): Promise<HarvestQuery[]> {
  const clusterBlock = approvedClusters
    .map((c, i) => `${i + 1}. "${c.label}" â€” ${c.description}`)
    .join('\n')

  const prompt = `You are a creative research director at a social media agency.

A copywriter approved these creative directions for their ${platform} copy project:
${clusterBlock}

BRIEF: ${briefText}

Generate exactly 10 Pinterest search queries that will surface MORE examples of these approved styles.
Each query must be specifically aimed at finding content that matches one of the approved directions above.
Distribute the 10 queries across the approved directions (2-4 per direction if multiple approved).

For each query:
- Make it specific enough to surface stylistically relevant pins
- Vary vocabulary to avoid duplicate results from the probe phase
- Append aesthetic descriptors: "aesthetic", "inspo", "style board", "editorial", "mood" â€” only where they help

Return ONLY this JSON â€” no markdown:
{
  "queries": [
    { "angle": "...", "query": "..." }
  ]
}`

  let raw = ''
  try {
    if (anthropicKey) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey: anthropicKey })
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      })
      raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
    } else if (geminiKey) {
      const { geminiGenerate } = await import('@/lib/gemini')
      raw = await geminiGenerate(prompt, undefined, { temperature: 0.4, maxOutputTokens: 800 })
    }
  } catch (err) {
    console.error('[harvest] query generation failed:', err)
  }

  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try {
    const parsed = JSON.parse(raw) as { queries: HarvestQuery[] }
    return parsed.queries?.slice(0, 10) ?? []
  } catch {
    return []
  }
}

// â”€â”€ AI: score a batch of pins â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface PinScore {
  idx:              number
  visual_score:     number
  caption_score:    number
  structural_score: number
  rationale:        string
}

async function scorePinBatch(
  briefText: string,
  platform: string,
  approvedDirections: string,
  pinBatch: { idx: number; title: string; description: string; saveCount: number }[],
  anthropicKey: string | undefined,
  geminiKey: string | undefined,
): Promise<PinScore[]> {
  const pinList = pinBatch
    .map(p => {
      const desc = p.description.slice(0, 150).replace(/\n/g, ' ')
      return `${p.idx}. ${p.title.slice(0, 60)} | ${desc} | ${p.saveCount} saves`
    })
    .join('\n')

  const prompt = `You are scoring Pinterest pins for copywriting inspiration value.

BRIEF: ${briefText}
PLATFORM: ${platform}
APPROVED CREATIVE DIRECTIONS: ${approvedDirections}

Score each pin on three dimensions (0.0â€“10.0 with one decimal):
- visual_score: How well does the aesthetic/visual style match the approved directions?
- caption_score: How well-written and structurally rich is the description? Does it have hook + body + close?
- structural_score: How borrowable is the caption's STRUCTURE (hook mechanic, sentence rhythm, CTA pattern)?

PINS TO SCORE:
${pinList}

Rules:
- Score ALL ${pinBatch.length} pins (every idx present in input must appear in output)
- Be discriminating â€” use the full 0â€“10 range. Empty or generic descriptions â†’ below 3 on caption/structural
- rationale: one phrase (max 10 words) explaining the structural value or lack thereof

Return ONLY a JSON array â€” no markdown:
[
  { "idx": 0, "visual_score": 8.0, "caption_score": 7.5, "structural_score": 9.0, "rationale": "..." }
]`

  let raw = ''
  try {
    if (anthropicKey) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey: anthropicKey })
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      })
      raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
    } else if (geminiKey) {
      const { geminiGenerate } = await import('@/lib/gemini')
      raw = await geminiGenerate(prompt, undefined, { temperature: 0.2, maxOutputTokens: 4000 })
    }
  } catch (err) {
    console.error('[harvest] scoring batch failed:', err)
    return []
  }

  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const arrMatch = raw.match(/\[[\s\S]*\]/)
  if (!arrMatch) return []

  try {
    return JSON.parse(arrMatch[0]) as PinScore[]
  } catch {
    return []
  }
}

// â”€â”€ Route handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function POST(req: NextRequest) {
  const guard = await aiGuard(req)
  if (guard) return guard

  let body: { session_id: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { session_id } = body
  if (!session_id) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }

  if (!process.env.APIFY_API_KEY && !process.env.PINTEREST_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'Pinterest is not configured â€” set PINTEREST_ACCESS_TOKEN or APIFY_API_KEY' }, { status: 503 })
  }

  const supabase = db()
  const anthropicKey = process.env.ANTHROPIC_API_KEY || undefined
  const geminiKey    = process.env.GEMINI_API_KEY    || undefined

  // â”€â”€ 1. Load session â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { data: session, error: sessErr } = await supabase
    .from('pinterest_scrape_sessions')
    .select('id, brief_text, platform, client_id, style_clusters, cluster_feedback, status')
    .eq('id', session_id)
    .single()

  if (sessErr || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (session.status !== 'harvest_pending' && session.status !== 'harvesting') {
    return NextResponse.json(
      { error: `Session status is "${session.status}" â€” run feedback first` },
      { status: 409 }
    )
  }

  // Mark as harvesting
  await supabase
    .from('pinterest_scrape_sessions')
    .update({ status: 'harvesting', updated_at: new Date().toISOString() })
    .eq('id', session_id)

  // Identify approved clusters (feedback = 'more')
  const feedback = (session.cluster_feedback ?? {}) as Record<string, string>
  const allClusters = (session.style_clusters ?? []) as {
    id: string; label: string; description: string
  }[]

  const approvedClusters = allClusters.filter(c => feedback[c.id] === 'more')

  if (approvedClusters.length === 0) {
    return NextResponse.json(
      { error: 'No approved clusters â€” save feedback before harvesting' },
      { status: 422 }
    )
  }

  // â”€â”€ 2. AI: generate 10 targeted queries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let harvestQueries: HarvestQuery[] = []
  try {
    harvestQueries = await generateHarvestQueries(
      session.brief_text as string,
      session.platform as string,
      approvedClusters,
      anthropicKey,
      geminiKey,
    )
  } catch (err) {
    console.error('[harvest] query gen failed:', err)
  }

  // Fallback: reuse approved cluster labels as queries
  if (harvestQueries.length < 3) {
    harvestQueries = approvedClusters.flatMap(c => [
      { angle: c.id, query: `${c.label} aesthetic inspiration` },
      { angle: c.id, query: `${c.label} social media content` },
      { angle: c.id, query: `${c.label} mood board` },
    ]).slice(0, 10)
  }

  // Save harvest queries
  await supabase
    .from('pinterest_scrape_sessions')
    .update({ harvest_queries: harvestQueries })
    .eq('id', session_id)

  // â”€â”€ 3. Apify: scrape with targeted queries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const queryInputs: PinterestQueryInput[] = harvestQueries.map(q => ({
    query: q.query,
    angle: q.angle,
  }))

  let rawPins: Awaited<ReturnType<typeof fetchPinterestPinsCustom>> = []
  try {
    rawPins = await fetchPinterestPinsCustom(queryInputs, 100)
  } catch (err) {
    console.error('[harvest] Pinterest scrape failed:', err)
  }

  // Filter usable pins
  const usablePins = rawPins.filter(
    p => p.imageUrl.length > 0 && (p.description.length > 20 || p.title.length > 10)
  )

  if (usablePins.length === 0) {
    await supabase
      .from('pinterest_scrape_sessions')
      .update({ status: 'harvest_pending' })
      .eq('id', session_id)
    return NextResponse.json(
      { error: 'Pinterest returned no usable results. Try adjusting feedback.' },
      { status: 422 }
    )
  }

  // â”€â”€ 4. Save harvest pins to DB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const pinInserts = usablePins.map((p, idx) => ({
    session_id:      session_id,
    client_id:       (session.client_id as string | null) ?? null,
    pin_external_id: p.id,
    pin_url:         p.url,
    image_url:       p.imageUrl,
    title:           p.title.slice(0, 255),
    description:     p.description.slice(0, 2000),
    pinner_username: p.authorHandle,
    save_count:      p.saveCount,
    scrape_phase:    'harvest',
    query_used:      harvestQueries[idx % harvestQueries.length]?.query ?? '',
    query_angle:     harvestQueries[idx % harvestQueries.length]?.angle ?? '',
  }))

  const { data: insertedPins, error: pinsErr } = await supabase
    .from('pinterest_pins')
    .insert(pinInserts)
    .select('id, image_url, title, description, save_count')

  if (pinsErr || !insertedPins) {
    console.error('[harvest] pin insert failed:', pinsErr?.message)
    await supabase
      .from('pinterest_scrape_sessions')
      .update({ status: 'harvest_pending' })
      .eq('id', session_id)
    return NextResponse.json({ error: 'Failed to save harvest pins' }, { status: 500 })
  }

  await supabase
    .from('pinterest_scrape_sessions')
    .update({ harvest_raw_count: insertedPins.length })
    .eq('id', session_id)

  // â”€â”€ 5. AI: score pins in parallel batches of 35 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const BATCH_SIZE = 35
  const approvedDirections = approvedClusters.map(c => `"${c.label}": ${c.description}`).join(' | ')
  const briefText = session.brief_text as string
  const platform  = session.platform  as string

  type InsertedPin = {
    id: string
    image_url: string
    title: string | null
    description: string | null
    save_count: number | null
  }

  const batches: { idx: number; title: string; description: string; saveCount: number }[][] = []
  for (let i = 0; i < insertedPins.length; i += BATCH_SIZE) {
    batches.push(
      (insertedPins.slice(i, i + BATCH_SIZE) as InsertedPin[]).map((p, j) => ({
        idx:         i + j,
        title:       (p.title ?? '').slice(0, 60),
        description: (p.description ?? '').slice(0, 150),
        saveCount:   p.save_count ?? 0,
      }))
    )
  }

  const scoringResults = await Promise.allSettled(
    batches.map(batch =>
      scorePinBatch(briefText, platform, approvedDirections, batch, anthropicKey, geminiKey)
    )
  )

  // Flatten scores, keyed by original index
  const scoreMap = new Map<number, PinScore>()
  for (const result of scoringResults) {
    if (result.status === 'fulfilled') {
      for (const score of result.value) {
        scoreMap.set(score.idx, score)
      }
    }
  }

  // â”€â”€ 6. Apply scores, filter, update DB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const SCORE_THRESHOLD = 6.0
  const scoredPins: ScoredPin[] = []
  const dbUpdates: Promise<unknown>[] = []

  ;(insertedPins as InsertedPin[]).forEach((p, i) => {
    const score = scoreMap.get(i)
    const visual     = Math.min(10, Math.max(0, score?.visual_score     ?? 5))
    const caption    = Math.min(10, Math.max(0, score?.caption_score    ?? 5))
    const structural = Math.min(10, Math.max(0, score?.structural_score ?? 5))
    const composite  = parseFloat((visual * 0.35 + caption * 0.35 + structural * 0.30).toFixed(1))
    const kept       = composite >= SCORE_THRESHOLD
    const rationale  = score?.rationale ?? ''

    dbUpdates.push(
      Promise.resolve(
        supabase
          .from('pinterest_pins')
          .update({
            visual_score:      visual,
            caption_score:     caption,
            structural_score:  structural,
            composite_score:   composite,
            score_rationale:   rationale,
            kept_after_filter: kept,
          })
          .eq('id', p.id)
      )
    )

    if (kept) {
      scoredPins.push({
        id:             p.id,
        imageUrl:       p.image_url,
        title:          (p.title ?? '').slice(0, 100),
        description:    (p.description ?? '').slice(0, 300),
        saveCount:      p.save_count ?? 0,
        compositeScore: composite,
        scoreRationale: rationale,
      })
    }
  })

  // Fire DB updates in background
  void Promise.allSettled(dbUpdates)

  // Sort by composite score descending, cap at 50
  scoredPins.sort((a, b) => b.compositeScore - a.compositeScore)
  const topPins = scoredPins.slice(0, 50)

  // â”€â”€ 7. Finalize session â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await supabase
    .from('pinterest_scrape_sessions')
    .update({
      status:         'scored',
      filtered_count: topPins.length,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', session_id)

  return NextResponse.json({
    sessionId:     session_id,
    pins:          topPins,
    rawCount:      insertedPins.length,
    filteredCount: topPins.length,
  } satisfies HarvestResponse)
}
