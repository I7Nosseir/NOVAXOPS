import { NextRequest, NextResponse } from 'next/server'
import type { CompetitorAnalysis } from '@/lib/types'

/**
 * POST /api/competitors/export-pdf
 * Body: { client_id, analysis: CompetitorAnalysis, clientName? }
 *
 * Generates a competitive intelligence PDF, saves to Supabase Storage (assets bucket),
 * creates an asset table entry, and returns { url, assetId }.
 *
 * Falls back to returning a download URL if Storage write fails.
 */
export async function POST(req: NextRequest) {
  let body: { client_id?: string; analysis?: CompetitorAnalysis; clientName?: string }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client_id, analysis, clientName } = body
  if (!client_id || !analysis) {
    return NextResponse.json({ error: 'client_id and analysis required' }, { status: 400 })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Build PDF via @react-pdf/renderer
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { createElement: h } = await import('react')
  const { Document, Page, Text, View, StyleSheet, Font } = await import('@react-pdf/renderer')

  const C = {
    bg:       '#FFFFFF',
    dark:     '#1B3D38',
    accent:   '#5BB4AE',
    muted:    '#2A6B62',
    light:    '#EBF4F3',
    border:   '#9DCCC8',
    text:     '#0f172a',
    sub:      '#475569',
    faint:    '#94a3b8',
    red:      '#ef4444',
    amber:    '#f59e0b',
    slate:    '#64748b',
    emerald:  '#10b981',
  }

  const styles = StyleSheet.create({
    page:         { backgroundColor: C.bg, fontFamily: 'Helvetica', paddingTop: 50, paddingBottom: 50, paddingHorizontal: 50 },
    coverPage:    { backgroundColor: C.dark, paddingTop: 60, paddingBottom: 60, paddingHorizontal: 60, flexDirection: 'column', justifyContent: 'flex-end', minHeight: '100%' },
    brandWord:    { fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.accent, letterSpacing: 4, marginBottom: 4 },
    brandLine:    { width: 40, height: 2, backgroundColor: C.accent, marginBottom: 40, opacity: 0.7 },
    coverTitle:   { fontSize: 28, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', lineHeight: 1.2, marginBottom: 10 },
    coverSub:     { fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 2, marginBottom: 6 },
    coverDate:    { fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 30 },
    section:      { marginBottom: 22 },
    sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: C.light },
    summaryBox:   { backgroundColor: C.light, borderRadius: 6, padding: 12, marginBottom: 20 },
    summaryLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.muted, letterSpacing: 2, marginBottom: 5 },
    summaryText:  { fontSize: 10, color: C.text, lineHeight: 1.6 },
    // Landscape card
    card:         { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, marginBottom: 8, overflow: 'hidden' },
    cardHeader:   { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    scopeBadge:   { fontSize: 7, fontFamily: 'Helvetica-Bold', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, marginRight: 8 },
    handleText:   { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.text, flex: 1 },
    platformText: { fontSize: 8, color: C.faint, marginLeft: 4 },
    metricRow:    { flexDirection: 'row', gap: 16, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.bg },
    metricBox:    { alignItems: 'flex-start' },
    metricVal:    { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.text },
    metricLbl:    { fontSize: 7, color: C.faint },
    stratText:    { fontSize: 9, color: C.sub, fontStyle: 'italic', paddingHorizontal: 10, paddingBottom: 8 },
    // Threat
    threatCard:   { borderWidth: 1, borderRadius: 6, marginBottom: 8, overflow: 'hidden' },
    threatHeader: { flexDirection: 'row', alignItems: 'center', padding: 10 },
    threatBadge:  { fontSize: 7, fontFamily: 'Helvetica-Bold', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, marginRight: 8 },
    threatHandle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.text, flex: 1 },
    threatBody:   { paddingHorizontal: 10, paddingBottom: 10 },
    reasonItem:   { fontSize: 9, color: C.sub, marginBottom: 3, paddingLeft: 8 },
    responseBox:  { backgroundColor: '#F8FAFC', borderRadius: 4, padding: 8, marginTop: 6 },
    responseText: { fontSize: 9, color: C.text },
    // Lists
    listItem:     { flexDirection: 'row', gap: 6, marginBottom: 5 },
    bullet:       { fontSize: 9, color: C.accent },
    listText:     { fontSize: 9, color: C.sub, flex: 1, lineHeight: 1.5 },
    // Actions
    actionRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
    actionNum:    { width: 18, height: 18, borderRadius: 9, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center' },
    actionNumTxt: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
    actionText:   { fontSize: 9, color: C.sub, flex: 1, lineHeight: 1.5, paddingTop: 3 },
  })

  const THREAT_BORDER: Record<string, string> = { high: '#FECACA', medium: '#FDE68A', low: '#E2E8F0' }
  const THREAT_BADGE_BG: Record<string, string> = { high: '#FEE2E2', medium: '#FEF3C7', low: '#F1F5F9' }
  const THREAT_BADGE_CLR: Record<string, string> = { high: '#B91C1C', medium: '#92400E', low: C.slate }
  const SIGNAL_CLR: Record<string, string> = { accelerating: C.emerald, stable: '#3B82F6', declining: C.red, unknown: C.faint }

  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(n)

  const doc = h(Document, {},
    // Cover
    h(Page, { size: 'A4', style: styles.coverPage },
      h(View, {},
        h(Text, { style: styles.brandWord }, 'NOVAX'),
        h(View, { style: styles.brandLine }),
        h(Text, { style: styles.coverSub }, 'COMPETITIVE INTELLIGENCE REPORT'),
        h(Text, { style: styles.coverTitle }, clientName ?? 'Client Analysis'),
        h(Text, { style: styles.coverDate }, `Generated ${new Date(analysis.generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`),
      )
    ),

    // Main content
    h(Page, { size: 'A4', style: styles.page },

      // Summary
      h(View, { style: styles.summaryBox },
        h(Text, { style: styles.summaryLabel }, 'INTELLIGENCE SUMMARY'),
        h(Text, { style: styles.summaryText }, analysis.summary),
      ),

      // Landscape
      h(View, { style: styles.section },
        h(Text, { style: styles.sectionTitle }, 'Competitive Landscape'),
        ...analysis.landscape.map(c =>
          h(View, { style: styles.card },
            h(View, { style: styles.cardHeader },
              h(Text, { style: { ...styles.scopeBadge, backgroundColor: c.scope === 'global' ? '#EFF6FF' : '#FFFBEB', color: c.scope === 'global' ? '#1D4ED8' : '#92400E' } }, (c.scope ?? 'global').toUpperCase()),
              h(Text, { style: styles.handleText }, c.handle),
              h(Text, { style: styles.platformText }, c.platform),
              h(Text, { style: { fontSize: 8, color: SIGNAL_CLR[c.growth_signal ?? 'unknown'], fontFamily: 'Helvetica-Bold' } }, (c.growth_signal ?? '').toUpperCase()),
            ),
            h(View, { style: styles.metricRow },
              h(View, { style: styles.metricBox }, h(Text, { style: styles.metricVal }, fmt(c.followers)), h(Text, { style: styles.metricLbl }, 'followers')),
              h(View, { style: styles.metricBox }, h(Text, { style: styles.metricVal }, `${c.avg_er.toFixed(1)}%`), h(Text, { style: styles.metricLbl }, 'avg ER')),
              h(View, { style: styles.metricBox }, h(Text, { style: styles.metricVal }, `${c.posting_frequency}×/wk`), h(Text, { style: styles.metricLbl }, 'frequency')),
              ...(c.best_performing_format ? [h(View, { style: { ...styles.metricBox, flex: 1 } }, h(Text, { style: { ...styles.metricVal, fontSize: 8 } }, c.best_performing_format), h(Text, { style: styles.metricLbl }, 'best format'))] : []),
            ),
            ...(c.platform_strategy ? [h(Text, { style: styles.stratText }, c.platform_strategy)] : []),
          )
        ),
      ),

      // Opportunities
      analysis.opportunities.length > 0 && h(View, { style: styles.section },
        h(Text, { style: styles.sectionTitle }, 'Content Opportunities'),
        ...analysis.opportunities.map((opp, i) =>
          h(View, { key: i, style: styles.listItem },
            h(Text, { style: styles.bullet }, '+'),
            h(Text, { style: styles.listText }, opp),
          )
        ),
      ),

      // Threats
      analysis.threats.length > 0 && h(View, { style: styles.section },
        h(Text, { style: styles.sectionTitle }, 'Threat Assessment'),
        ...analysis.threats.map((t, i) =>
          h(View, { key: i, style: { ...styles.threatCard, borderColor: THREAT_BORDER[t.threat_level] ?? '#E2E8F0' } },
            h(View, { style: { ...styles.threatHeader, backgroundColor: THREAT_BADGE_BG[t.threat_level] ?? '#F8FAFC' } },
              h(Text, { style: { ...styles.threatBadge, backgroundColor: THREAT_BADGE_BG[t.threat_level], color: THREAT_BADGE_CLR[t.threat_level] ?? C.slate } }, t.threat_level.toUpperCase()),
              h(Text, { style: styles.threatHandle }, t.handle),
              h(Text, { style: { fontSize: 8, color: C.faint } }, t.platform),
            ),
            h(View, { style: styles.threatBody },
              ...t.reasons.map((r, j) => h(Text, { key: j, style: styles.reasonItem }, `• ${r}`)),
              h(View, { style: styles.responseBox },
                h(Text, { style: { ...styles.responseText, color: C.faint, fontSize: 7, fontFamily: 'Helvetica-Bold', marginBottom: 3 } }, 'RECOMMENDED RESPONSE'),
                h(Text, { style: styles.responseText }, t.recommended_response),
              ),
            ),
          )
        ),
      ),

      // Monthly actions
      analysis.monthly_actions.length > 0 && h(View, { style: styles.section },
        h(Text, { style: styles.sectionTitle }, "This Month's Actions"),
        ...analysis.monthly_actions.map((action, i) =>
          h(View, { key: i, style: styles.actionRow },
            h(View, { style: styles.actionNum }, h(Text, { style: styles.actionNumTxt }, String(i + 1))),
            h(Text, { style: styles.actionText }, action),
          )
        ),
      ),

      // Footer
      h(View, { style: { position: 'absolute', bottom: 30, left: 50, right: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } },
        h(Text, { style: { fontSize: 7, color: C.faint } }, 'NOVAX Competitive Intelligence'),
        h(Text, { style: { fontSize: 7, color: C.faint } }, new Date().getFullYear().toString()),
      ),
    ),
  ) as React.ReactElement

  let pdfBuffer: Buffer
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfBuffer = await renderToBuffer(doc as any)
  } catch (err) {
    console.error('[competitors/export-pdf] PDF render failed', err)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }

  // Upload to Supabase Storage
  const fileName = `competitor-analysis-${client_id}-${Date.now()}.pdf`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('assets')
    .upload(`reports/${fileName}`, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) {
    console.error('[competitors/export-pdf] Storage upload failed', uploadError.message)
    // Return the PDF directly as a download instead
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from('assets').getPublicUrl(uploadData.path)
  const publicUrl = urlData.publicUrl

  // Create asset record
  const { data: assetRow } = await supabase.from('assets').insert({
    client_id,
    file_name:    fileName,
    file_url:     publicUrl,
    file_type:    'application/pdf',
    file_size:    pdfBuffer.length,
    storage_path: uploadData.path,
    source:       'generated',
    tags:         ['competitive-analysis', 'report'],
  }).select('id').single()

  return NextResponse.json({
    url:     publicUrl,
    assetId: assetRow?.id ?? null,
  })
}
