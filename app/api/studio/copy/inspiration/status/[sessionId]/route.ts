// ============================================================
// GET /api/studio/copy/inspiration/status/[sessionId]
//
// Returns current session state. Used to resume a session
// after page refresh, and to check harvest completion.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { StyleCluster } from '@/app/api/studio/copy/inspiration/probe/route'
import type { ScoredPin }    from '@/app/api/studio/copy/inspiration/harvest/route'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }

  const supabase = db()

  const { data: session, error } = await supabase
    .from('pinterest_scrape_sessions')
    .select(`
      id, status, brief_text, platform, content_type, language,
      probe_raw_count, harvest_raw_count, filtered_count,
      style_clusters, cluster_feedback
    `)
    .eq('id', sessionId)
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const status = session.status as string

  // If scored, load the scored harvest pins
  let pins: ScoredPin[] | undefined
  if (status === 'scored' || status === 'complete') {
    const { data: pinRows } = await supabase
      .from('pinterest_pins')
      .select('id, image_url, title, description, save_count, composite_score, score_rationale, style_cluster_id')
      .eq('session_id', sessionId)
      .eq('scrape_phase', 'harvest')
      .eq('kept_after_filter', true)
      .order('composite_score', { ascending: false })
      .limit(50)

    if (pinRows) {
      pins = pinRows.map(p => ({
        id:             p.id as string,
        imageUrl:       p.image_url as string,
        title:          (p.title as string | null) ?? '',
        description:    (p.description as string | null) ?? '',
        saveCount:      (p.save_count as number | null) ?? 0,
        compositeScore: (p.composite_score as number | null) ?? 0,
        scoreRationale: (p.score_rationale as string | null) ?? '',
        styleClusterId: (p.style_cluster_id as string | null) ?? undefined,
      }))
    }
  }

  // Build clusters with sample pins for awaiting_feedback resume
  let clusters: StyleCluster[] | undefined
  if (status === 'awaiting_feedback' || status === 'harvest_pending') {
    const rawClusters = (session.style_clusters ?? []) as {
      id: 'A' | 'B' | 'C' | 'D'
      label: string
      description: string
      pin_ids: string[]
    }[]

    if (rawClusters.length > 0) {
      clusters = await Promise.all(
        rawClusters.map(async c => {
          const { data: sampleRows } = await supabase
            .from('pinterest_pins')
            .select('id, image_url, title, description, save_count')
            .in('id', (c.pin_ids ?? []).slice(0, 6))
            .limit(3)

          const samplePins = (sampleRows ?? []).map(p => ({
            id:          p.id as string,
            imageUrl:    p.image_url as string,
            title:       (p.title as string | null) ?? '',
            description: (p.description as string | null) ?? '',
            saveCount:   (p.save_count as number | null) ?? 0,
          }))

          return {
            id:          c.id,
            label:       c.label,
            description: c.description,
            samplePins,
            pinIds:      c.pin_ids ?? [],
          } satisfies StyleCluster
        })
      )
    }
  }

  return NextResponse.json({
    sessionId,
    status,
    briefText:     session.brief_text,
    platform:      session.platform,
    probeCount:    session.probe_raw_count,
    harvestCount:  session.harvest_raw_count,
    filteredCount: session.filtered_count,
    feedback:      session.cluster_feedback,
    clusters,
    pins,
  })
}
