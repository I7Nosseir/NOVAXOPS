// ============================================================
// POST /api/studio/copy/inspiration/probe
//
// Phase 1 of the Pinterest Inspiration Engine:
//   1. AI generates 8 diverse search queries from the copywriting brief
//   2. Apify scrapes Pinterest with those queries (~45 pins)
//   3. AI clusters the pins into 4 distinct creative style groups
//   4. Returns session_id + 4 clusters with 3 representative pins each
//
// This route runs synchronously — client waits for the full response.
// Expect ~30-45 seconds. export const maxDuration = 60.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchPinterestPinsCustom } from '@/lib/data-providers/pinterest'
import type { PinterestQueryInput } from '@/lib/data-providers/pinterest'
import { aiGuard } from '@/lib/ai-guard'

export const maxDuration = 60

// ── Types shared with the client ──────────────────────────────

export interface SamplePin {
  id: string          // DB UUID (pinterest_pins.id)
  imageUrl: string
  title: string
  description: string
  saveCount: number
}

export interface StyleCluster {
  id: 'A' | 'B' | 'C' | 'D'
  label: string
  description: string
  samplePins: SamplePin[]   // 3 representative pins shown in the UI
  pinIds: string[]          // all pinterest_pins UUIDs in this cluster
}

export interface ProbeResponse {
  sessionId: string
  clusters: StyleCluster[]
  probeCount: number
}

// ── Supabase admin ─────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ── AI helpers ─────────────────────────────────────────────────

interface QueryPlanItem {
  angle: string
  query: string
}

async function generateSearchQueries(
  briefText: string,
  platform: string,
  contentType: string,
  language: string,
  clientCategory: string,
  clientAudience: string,
  anthropicKey: string | undefined,
  geminiKey: string | undefined,
): Promise<QueryPlanItem[]> {
  const arabicNote = (language === 'ar' || language === 'both')
    ? 'For angles 5 and 7, write the query in Arabic script (Arabic Pinterest search) since the client uses Arabic content.'
    : ''

  const prompt = `You are a creative research director at a social media agency.
A copywriter needs Pinterest inspiration for writing ${contentType} copy for ${platform}.

CLIENT CATEGORY: ${clientCategory || 'general'}
AUDIENCE: ${clientAudience || 'general consumer'}
BRIEF: ${briefText}
${arabicNote}

Generate exactly 8 Pinterest search queries — one per creative angle listed below.
Each query must be genuinely different so the 8 together surface a true range of styles.

Angles (return one query per angle in this exact order):
1. "direct" — the product/service category itself (what it IS)
2. "lifestyle" — the aspirational world of the target audience
3. "emotion" — the feeling or transformation the product creates
4. "aesthetic" — the visual mood/style that fits this brand
5. "caption_first" — text-heavy pins, quote posts, caption-forward content (people who write long descriptions)
6. "narrative" — pins with a story arc in the description (beginning, tension, resolution)
7. "community" — social proof, peer endorsement, UGC-style content
8. "conceptual" — metaphorical or abstract interpretation of the brand's core idea

Return ONLY this JSON — no markdown, no explanation:
{
  "queries": [
    { "angle": "direct", "query": "..." },
    { "angle": "lifestyle", "query": "..." },
    { "angle": "emotion", "query": "..." },
    { "angle": "aesthetic", "query": "..." },
    { "angle": "caption_first", "query": "..." },
    { "angle": "narrative", "query": "..." },
    { "angle": "community", "query": "..." },
    { "angle": "conceptual", "query": "..." }
  ]
}`

  let raw = ''

  if (anthropicKey) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: anthropicKey })
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })
    raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  } else if (geminiKey) {
    const { geminiGenerate } = await import('@/lib/gemini')
    raw = await geminiGenerate(prompt, undefined, { temperature: 0.4, maxOutputTokens: 1000 })
  }

  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try {
    const parsed = JSON.parse(raw) as { queries: QueryPlanItem[] }
    return parsed.queries?.slice(0, 8) ?? []
  } catch {
    return []
  }
}

// ── Cluster shape returned by AI ──────────────────────────────

interface ClusterPlan {
  clusters: {
    id: 'A' | 'B' | 'C' | 'D'
    label: string
    description: string
    representative_indices: number[]   // 0-based, 3 pins for preview
    all_indices: number[]              // 0-based, all pins in this cluster
  }[]
}

async function clusterPins(
  briefText: string,
  platform: string,
  pinList: string,   // pre-formatted numbered list
  pinCount: number,
  clusterCount: number,
  anthropicKey: string | undefined,
  geminiKey: string | undefined,
): Promise<ClusterPlan | null> {
  const clusterIds = ['A', 'B', 'C', 'D'].slice(0, clusterCount).join(', ')

  const prompt = `You are a creative director analyzing Pinterest pins scraped for a ${platform} copywriting project.

BRIEF: ${briefText}

I scraped ${pinCount} Pinterest pins using ${clusterCount * 2} different creative angle searches.
Each pin below is: INDEX. title | description (first 120 chars) | SAVES saves

${pinList}

Group these ${pinCount} pins into exactly ${clusterCount} distinct creative direction clusters (${clusterIds}).
Each cluster must represent a meaningfully different creative style a copywriter could draw from.
Do NOT create clusters based on topic — cluster by creative approach and structural style.

Rules:
- Every pin index (0 through ${pinCount - 1}) must appear in exactly one cluster's all_indices
- representative_indices: pick the 3 pins that BEST show this cluster's style (must be from all_indices)
- Labels must be 3-4 words: e.g. "Dark Honest Testimonial", "Aspirational Lifestyle Story", "Minimal Premium Reveal"

Return ONLY this JSON — no markdown:
{
  "clusters": [
    {
      "id": "A",
      "label": "...",
      "description": "One sentence describing the creative direction and what makes it distinctive.",
      "representative_indices": [0, 4, 12],
      "all_indices": [0, 2, 4, 7, 12, 18, 22]
    }
  ]
}`

  let raw = ''

  if (anthropicKey) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: anthropicKey })
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })
    raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  } else if (geminiKey) {
    const { geminiGenerate } = await import('@/lib/gemini')
    raw = await geminiGenerate(prompt, undefined, { temperature: 0.3, maxOutputTokens: 2000 })
  }

  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try {
    return JSON.parse(raw) as ClusterPlan
  } catch {
    return null
  }
}

// ── Fallback clusterer (no AI — round-robin by index) ─────────

function fallbackCluster(pinCount: number, clusterCount: number): ClusterPlan {
  const ids = ['A', 'B', 'C', 'D'].slice(0, clusterCount) as ('A' | 'B' | 'C' | 'D')[]
  const buckets: number[][] = ids.map(() => [])
  for (let i = 0; i < pinCount; i++) {
    buckets[i % clusterCount].push(i)
  }
  return {
    clusters: ids.map((id, ci) => ({
      id,
      label: `Direction ${id}`,
      description: 'A distinct creative direction from the search results.',
      representative_indices: buckets[ci].slice(0, 3),
      all_indices: buckets[ci],
    })),
  }
}

// ── Route handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const guard = await aiGuard()
  if (guard) return guard

  let body: {
    client_id?: string
    brief_text: string
    platform: string
    content_type: string
    language: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { client_id, brief_text, platform, content_type, language } = body

  if (!brief_text?.trim()) {
    return NextResponse.json({ error: 'brief_text is required' }, { status: 400 })
  }
  if (!process.env.APIFY_API_KEY) {
    return NextResponse.json({ error: 'Pinterest scraping is not configured (APIFY_API_KEY missing)' }, { status: 503 })
  }

  const supabase = db()
  const anthropicKey = process.env.ANTHROPIC_API_KEY || undefined
  const geminiKey    = process.env.GEMINI_API_KEY    || undefined

  if (!anthropicKey && !geminiKey) {
    return NextResponse.json({ error: 'No AI key configured' }, { status: 503 })
  }

  // ── 1. Load client context for query generation ──────────────
  let clientCategory = ''
  let clientAudience = ''
  if (client_id) {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('normalized_profile')
      .eq('id', client_id)
      .single()

    if (clientRow?.normalized_profile) {
      const p = clientRow.normalized_profile as Record<string, string>
      clientCategory = p.primary_offering ?? p.industry ?? ''
      clientAudience = [p.audience_age_range, p.audience_gender_skew, p.audience_location]
        .filter(Boolean).join(', ')
    }
  }

  // ── 2. Create session record ──────────────────────────────────
  const { data: sessionRow, error: sessionErr } = await supabase
    .from('pinterest_scrape_sessions')
    .insert({
      client_id:    client_id ?? null,
      brief_text:   brief_text.trim(),
      platform:     platform   || 'instagram',
      content_type: content_type || 'single',
      language:     language   || 'ar',
      status:       'probing',
    })
    .select('id')
    .single()

  if (sessionErr || !sessionRow) {
    console.error('[probe] session insert failed:', sessionErr?.message)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  const sessionId = sessionRow.id as string

  // ── 3. AI: generate 8 search queries ─────────────────────────
  let queryPlan: QueryPlanItem[] = []
  try {
    queryPlan = await generateSearchQueries(
      brief_text.trim(),
      platform || 'Instagram',
      content_type || 'single',
      language || 'ar',
      clientCategory,
      clientAudience,
      anthropicKey,
      geminiKey,
    )
  } catch (err) {
    console.error('[probe] query generation failed:', err)
  }

  // Fallback: generic queries if AI failed
  if (queryPlan.length < 4) {
    const fallbackTerm = clientCategory || brief_text.split(' ').slice(0, 3).join(' ')
    queryPlan = [
      { angle: 'direct',      query: fallbackTerm },
      { angle: 'lifestyle',   query: `${fallbackTerm} lifestyle aesthetic` },
      { angle: 'emotion',     query: `${fallbackTerm} transformation inspiration` },
      { angle: 'aesthetic',   query: `${fallbackTerm} mood board aesthetic` },
      { angle: 'caption_first', query: `${fallbackTerm} quote caption` },
      { angle: 'narrative',   query: `${fallbackTerm} story journey` },
      { angle: 'community',   query: `${fallbackTerm} testimonial review` },
      { angle: 'conceptual',  query: `${fallbackTerm} concept metaphor` },
    ]
  }

  // Save queries to session
  await supabase
    .from('pinterest_scrape_sessions')
    .update({ probe_queries: queryPlan })
    .eq('id', sessionId)

  // ── 4. Apify: scrape Pinterest (sync, ~40s timeout) ───────────
  const queryInputs: PinterestQueryInput[] = queryPlan.map(q => ({
    query: q.query,
    angle: q.angle,
  }))

  let rawPins: Awaited<ReturnType<typeof fetchPinterestPinsCustom>> = []
  try {
    rawPins = await fetchPinterestPinsCustom(queryInputs, 56, 42)
  } catch (err) {
    console.error('[probe] Apify scrape failed:', err)
  }

  // Filter: must have image URL + some meaningful text
  const usablePins = rawPins.filter(
    p => p.imageUrl.length > 0 && (p.description.length > 20 || p.title.length > 10)
  )

  if (usablePins.length < 4) {
    await supabase
      .from('pinterest_scrape_sessions')
      .update({ status: 'probe_pending', probe_raw_count: rawPins.length })
      .eq('id', sessionId)
    return NextResponse.json(
      { error: 'Pinterest returned insufficient results. Try a more specific brief.' },
      { status: 422 }
    )
  }

  // ── 5. Save pins to DB ────────────────────────────────────────
  const pinInserts = usablePins.map(p => ({
    session_id:      sessionId,
    client_id:       client_id ?? null,
    pin_external_id: p.id,
    pin_url:         p.url,
    image_url:       p.imageUrl,
    title:           p.title.slice(0, 255),
    description:     p.description.slice(0, 2000),
    pinner_username: p.authorHandle,
    save_count:      p.saveCount,
    scrape_phase:    'probe',
    query_used:      '',   // Apify returns flat results; per-URL attribution unavailable
    query_angle:     '',
  }))

  const { data: insertedPins, error: pinsErr } = await supabase
    .from('pinterest_pins')
    .insert(pinInserts)
    .select('id, pin_external_id, image_url, title, description, save_count')

  if (pinsErr || !insertedPins) {
    console.error('[probe] pin insert failed:', pinsErr?.message)
    await supabase
      .from('pinterest_scrape_sessions')
      .update({ status: 'probe_pending', probe_raw_count: rawPins.length })
      .eq('id', sessionId)
    return NextResponse.json({ error: 'Failed to save pins' }, { status: 500 })
  }

  // Update probe count
  await supabase
    .from('pinterest_scrape_sessions')
    .update({ probe_raw_count: insertedPins.length })
    .eq('id', sessionId)

  // ── 6. AI: cluster pins into creative style groups ────────────
  const clusterCount = insertedPins.length >= 20 ? 4 : insertedPins.length >= 10 ? 3 : 2

  // Build compact pin list for the AI prompt (text only — no images)
  const pinListForAI = insertedPins
    .map((p, i) => {
      const desc = (p.description as string | null)?.slice(0, 120).replace(/\n/g, ' ') ?? ''
      const title = (p.title as string | null)?.slice(0, 60) ?? ''
      const saves = p.save_count as number ?? 0
      return `${i}. ${title} | ${desc} | ${saves} saves`
    })
    .join('\n')

  let clusterPlan: ClusterPlan | null = null
  try {
    clusterPlan = await clusterPins(
      brief_text.trim(),
      platform || 'Instagram',
      pinListForAI,
      insertedPins.length,
      clusterCount,
      anthropicKey,
      geminiKey,
    )
  } catch (err) {
    console.error('[probe] clustering failed:', err)
  }

  if (!clusterPlan || clusterPlan.clusters.length === 0) {
    clusterPlan = fallbackCluster(insertedPins.length, clusterCount)
  }

  // ── 7. Apply cluster assignments & build response ─────────────
  type InsertedPin = {
    id: string
    pin_external_id: string | null
    image_url: string
    title: string | null
    description: string | null
    save_count: number | null
  }

  const outputClusters: StyleCluster[] = []

  for (const cluster of clusterPlan.clusters) {
    const allIndices = (cluster.all_indices ?? []).filter(
      i => i >= 0 && i < insertedPins.length
    )
    const repIndices = (cluster.representative_indices ?? [])
      .filter(i => i >= 0 && i < insertedPins.length)
      .slice(0, 3)

    // Assign cluster ID to pins in DB (fire-and-forget)
    const clusterPinIds = allIndices.map(i => (insertedPins[i] as InsertedPin).id)
    void supabase
      .from('pinterest_pins')
      .update({ style_cluster_id: cluster.id })
      .in('id', clusterPinIds)

    const samplePins: SamplePin[] = repIndices.map(i => {
      const p = insertedPins[i] as InsertedPin
      return {
        id:          p.id,
        imageUrl:    p.image_url,
        title:       (p.title ?? '').slice(0, 100),
        description: (p.description ?? '').slice(0, 200),
        saveCount:   p.save_count ?? 0,
      }
    })

    outputClusters.push({
      id:          cluster.id,
      label:       cluster.label,
      description: cluster.description,
      samplePins,
      pinIds:      clusterPinIds,
    })
  }

  // ── 8. Update session: awaiting feedback ──────────────────────
  await supabase
    .from('pinterest_scrape_sessions')
    .update({
      status:         'awaiting_feedback',
      style_clusters: outputClusters.map(c => ({
        id:          c.id,
        label:       c.label,
        description: c.description,
        pin_ids:     c.pinIds,
      })),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  return NextResponse.json({
    sessionId,
    clusters: outputClusters,
    probeCount: insertedPins.length,
  } satisfies ProbeResponse)
}
