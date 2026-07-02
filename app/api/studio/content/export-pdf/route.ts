import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import {
  Document, Page, View, Text, StyleSheet, renderToBuffer, Font,
} from '@react-pdf/renderer'
import type { ContentDocument, ContentPiece, BossBrief } from '@/lib/studio-types'

// ── Arabic font — registered once at module level ─────────────────────────────
Font.register({
  family: 'Cairo',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/cairo/files/cairo-arabic-400-normal.woff', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/cairo/files/cairo-arabic-700-normal.woff', fontWeight: 700 },
  ],
})

// Detect Arabic script (U+0600–U+06FF + extended blocks + presentation forms)
const hasAr = (txt?: string | null): boolean =>
  /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(txt ?? '')

// Arabic style override — always returns same shape (no union), spread into base styles
// Undefined values are silently dropped when spread, giving consistent compile-time type
const arTx = (txt?: string | null) => {
  const ar = hasAr(txt)
  return { fontFamily: ar ? 'Cairo' : undefined, direction: ar ? 'rtl' as const : undefined, textAlign: ar ? 'right' as const : undefined }
}
const arBd = (txt?: string | null) => {
  const ar = hasAr(txt)
  return { fontFamily: ar ? 'Cairo' : undefined, fontWeight: ar ? 700 as const : undefined, direction: ar ? 'rtl' as const : undefined, textAlign: ar ? 'right' as const : undefined }
}

// ── Palette ───────────────────────────────────────────────────────────────────
const P = {
  novax:  '#1B3D38', muted:  '#2A6B62', accent: '#5BB4AE', border: '#9DCCC8',
  light:  '#EBF4F3', white:  '#FFFFFF', g900:   '#0F172A', g700:   '#374155',
  g500:   '#64748B', g300:   '#CBD5E1', g100:   '#F1F5F9', g50:    '#F8FAFC',
  tierS:  '#0F7B5B', tierA:  '#1E6EB5', tierB:  '#92400E', tierC:  '#6B7280',
  amber:  '#F59E0B', amberBg: '#FFF7ED',
}

function brand(c?: string) { return c && /^#[0-9A-Fa-f]{6}$/.test(c) ? c : P.novax }
function tierColor(t?: string) {
  return t === 'S' ? P.tierS : t === 'A' ? P.tierA : t === 'B' ? P.tierB : P.tierC
}
const ce = React.createElement

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', paddingTop: 48, paddingLeft: 48, paddingRight: 48, paddingBottom: 64, backgroundColor: P.white },
  coverPage:   { fontFamily: 'Helvetica', backgroundColor: P.white },
  footer:      { position: 'absolute', bottom: 20, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: P.border, paddingTop: 8 },
  footerText:  { fontSize: 8, color: P.g500 },
  coverTop:    { paddingTop: 64, paddingLeft: 48, paddingRight: 48, paddingBottom: 56 },
  coverBrand:  { fontSize: 11, color: P.accent, letterSpacing: 4, fontFamily: 'Helvetica-Bold', marginBottom: 20 },
  coverTitle:  { fontSize: 28, color: P.white, fontFamily: 'Helvetica-Bold', lineHeight: 1.3, marginBottom: 10 },
  coverSub:    { fontSize: 12, color: P.border },
  coverBody:   { paddingTop: 36, paddingLeft: 48, paddingRight: 48 },
  metaGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  metaChip:    { backgroundColor: P.g100, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  metaLabel:   { fontSize: 8, color: P.g500, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  metaValue:   { fontSize: 10, color: P.g900 },
  secLabel:    { fontSize: 8, color: P.accent, fontFamily: 'Helvetica-Bold', letterSpacing: 2, marginBottom: 10 },
  h1:          { fontSize: 18, color: P.g900, fontFamily: 'Helvetica-Bold', marginBottom: 10 },
  h2:          { fontSize: 13, color: P.g900, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  body:        { fontSize: 10, color: P.g700, lineHeight: 1.6 },
  small:       { fontSize: 9,  color: P.g500, lineHeight: 1.5 },
  divider:     { borderBottomWidth: 1, borderBottomColor: P.border, marginVertical: 14 },
  // Boss brief
  bbGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  bbCard:      { width: '47%', backgroundColor: P.g50, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: P.accent, padding: 12, marginBottom: 8 },
  bbWatch:     { backgroundColor: P.amberBg, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: P.amber, padding: 12, marginBottom: 8 },
  bbLabel:     { fontSize: 8, color: P.g500, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  bbVal:       { fontSize: 10, color: P.g900, lineHeight: 1.5 },
  // Piece
  hookBadge:   { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, marginRight: 4 },
  hookBadgeTx: { fontSize: 9, color: P.white, fontFamily: 'Helvetica-Bold' },
  hookScore:   { backgroundColor: P.g100, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  hookScoreTx: { fontSize: 9, color: P.g700 },
  secRow:      { backgroundColor: P.g50, borderRadius: 6, padding: 10, marginBottom: 8 },
  secHead:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  secName:     { fontSize: 9, color: P.muted, fontFamily: 'Helvetica-Bold' },
  secDur:      { fontSize: 9, color: P.g500 },
  secLine:     { fontSize: 10, color: P.g900, lineHeight: 1.5 },
  vizNote:     { fontSize: 9, color: P.g500, fontStyle: 'italic', marginTop: 4 },
  slideCard:   { backgroundColor: P.g50, borderRadius: 6, padding: 10, marginBottom: 8, borderLeftWidth: 2, borderLeftColor: P.border },
  slideNum:    { fontSize: 9, color: P.g500, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  slideTitle:  { fontSize: 11, color: P.g900, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  slideBody:   { fontSize: 10, color: P.g700, lineHeight: 1.5 },
  captionBox:  { backgroundColor: P.light, borderRadius: 6, padding: 10, marginTop: 8 },
  captionLbl:  { fontSize: 8, color: P.muted, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  captionTx:   { fontSize: 10, color: P.g700, lineHeight: 1.5 },
  twoCol:      { flexDirection: 'row', gap: 12 },
  col:         { flex: 1 },
  infoBox:     { backgroundColor: P.g100, borderRadius: 6, padding: 10 },
  infoLbl:     { fontSize: 8, color: P.g500, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  infoTx:      { fontSize: 10, color: P.g700, lineHeight: 1.5 },
  typeBadge:   { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, marginRight: 10 },
  typeBadgeTx: { fontSize: 9, color: P.white, fontFamily: 'Helvetica-Bold' },
  pieceRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
})

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer({ clientName }: { clientName: string }) {
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  return ce(View, { style: S.footer, fixed: true },
    ce(Text, { style: S.footerText }, `NOVAX Content Studio — ${clientName}`),
    ce(Text, { style: S.footerText }, now),
  )
}

// Module-level page size (set once per render — react-pdf is synchronous)
let CONTENT_PDF_SIZE: 'A4' | 'LETTER' = 'A4'

// ── Cover Page ────────────────────────────────────────────────────────────────
function CoverPage({ clientName, clientColor, inputs, hook, date }: {
  clientName: string; clientColor?: string; inputs: InputSummary; hook?: string; date: string
}) {
  const bc = brand(clientColor)
  return ce(Page, { size: CONTENT_PDF_SIZE, style: S.coverPage },
    ce(View, { style: { ...S.coverTop, backgroundColor: bc } },
      ce(Text, { style: S.coverBrand }, 'NOVAX'),
      ce(Text, { style: S.coverTitle }, `${clientName}\nContent Plan`),
      ce(Text, { style: S.coverSub }, `${inputs.content_type.charAt(0).toUpperCase()}${inputs.content_type.slice(1)} · ${inputs.platforms.join(', ')}`),
    ),
    ce(View, { style: S.coverBody },
      ce(View, { style: S.metaGrid },
        ce(View, { style: S.metaChip }, ce(Text, { style: S.metaLabel }, 'DATE'),     ce(Text, { style: S.metaValue }, date)),
        ce(View, { style: S.metaChip }, ce(Text, { style: S.metaLabel }, 'PLATFORM'), ce(Text, { style: S.metaValue }, inputs.platforms.join(', '))),
        ce(View, { style: S.metaChip }, ce(Text, { style: S.metaLabel }, 'GOAL'),     ce(Text, { style: S.metaValue }, inputs.goal)),
        ce(View, { style: S.metaChip }, ce(Text, { style: S.metaLabel }, 'AUDIENCE'), ce(Text, { style: S.metaValue }, inputs.audience)),
        ce(View, { style: S.metaChip }, ce(Text, { style: S.metaLabel }, 'LANGUAGE'), ce(Text, { style: S.metaValue }, inputs.language === 'arabic' ? `Arabic (${inputs.dialect})` : 'English')),
        inputs.cta ? ce(View, { style: S.metaChip }, ce(Text, { style: S.metaLabel }, 'CTA'), ce(Text, { style: S.metaValue }, inputs.cta)) : null,
      ),
      inputs.brief ? ce(View, null,
        ce(Text, { style: S.secLabel }, 'BRIEF'),
        ce(Text, { style: { ...S.body, marginBottom: 16, ...arTx(inputs.brief) } }, inputs.brief),
      ) : null,
      hook ? ce(View, null,
        ce(View, { style: S.divider }),
        ce(Text, { style: S.secLabel }, 'SELECTED HOOK'),
        ce(Text, { style: { ...S.h2, ...arBd(hook) } }, hook),
      ) : null,
    ),
  )
}

// ── Boss Brief Page ───────────────────────────────────────────────────────────
function BossBriefPage({ bb, clientName }: { bb: BossBrief; clientName: string }) {
  return ce(Page, { size: CONTENT_PDF_SIZE, style: S.page },
    ce(Text, { style: S.secLabel }, 'BOSS BRIEF'),
    ce(Text, { style: { ...S.h1, marginBottom: 20 } }, '30-Second Executive Summary'),
    ce(View, { style: S.bbGrid },
      ce(View, { style: S.bbCard }, ce(Text, { style: S.bbLabel }, 'WHAT WE MADE'),  ce(Text, { style: S.bbVal }, bb.what_we_made ?? '')),
      ce(View, { style: S.bbCard }, ce(Text, { style: S.bbLabel }, 'WHY IT WORKS'), ce(Text, { style: S.bbVal }, bb.why_it_works ?? '')),
      ce(View, { style: S.bbCard }, ce(Text, { style: S.bbLabel }, 'THE ONE THING'), ce(Text, { style: S.bbVal }, bb.the_one_thing ?? '')),
      ce(View, { style: S.bbCard }, ce(Text, { style: S.bbLabel }, 'DO THIS NOW'),   ce(Text, { style: S.bbVal }, bb.do_this_now ?? '')),
    ),
    bb.watch_out_for ? ce(View, { style: S.bbWatch },
      ce(Text, { style: { ...S.bbLabel, color: '#B45309' } }, 'WATCH OUT FOR'),
      ce(Text, { style: S.bbVal }, bb.watch_out_for),
    ) : null,
    ce(Footer, { clientName }),
  )
}

// ── Content Piece Page ────────────────────────────────────────────────────────
function PiecePage({ piece, idx, total, clientName, clientColor }: {
  piece: ContentPiece; idx: number; total: number; clientName: string; clientColor?: string
}) {
  const bc    = brand(clientColor)
  const hook  = piece.hook
  const pAny  = piece as ContentPiece & { slides?: { title: string; body: string; visual_note?: string }[]; visual_direction?: string; text_overlay?: string }
  const label = `${piece.type.toUpperCase()}${total > 1 ? ` · PIECE ${idx + 1} OF ${total}` : ''}`

  return ce(Page, { size: CONTENT_PDF_SIZE, style: S.page },
    // Header row
    ce(View, { style: S.pieceRow },
      ce(View, { style: { ...S.typeBadge, backgroundColor: bc } }, ce(Text, { style: S.typeBadgeTx }, label)),
      hook ? ce(View, { style: { ...S.hookBadge, backgroundColor: tierColor(hook.tier) } }, ce(Text, { style: S.hookBadgeTx }, `${hook.tier}-TIER`)) : null,
      hook ? ce(View, { style: S.hookScore }, ce(Text, { style: S.hookScoreTx }, `${hook.score}/30`)) : null,
    ),

    // Hook
    hook ? ce(View, null,
      ce(Text, { style: S.secLabel }, 'HOOK'),
      ce(Text, { style: { ...S.h2, marginBottom: 6, ...arBd(hook.text) } }, hook.text),
      ce(View, { style: { flexDirection: 'row', gap: 8, marginBottom: 14 } },
        ce(Text, { style: S.small }, `Type: ${hook.type}`),
        hook.why_selected ? ce(Text, { style: { ...S.small, ...arTx(hook.why_selected) } }, ` · ${hook.why_selected}`) : null,
      ),
    ) : null,

    ce(View, { style: S.divider }),

    // Reel: script sections
    piece.type === 'reel' && piece.script_sections && piece.script_sections.length > 0 ? ce(View, null,
      ce(Text, { style: { ...S.secLabel, marginBottom: 8 } }, 'SCRIPT'),
      ...piece.script_sections.map((sec, i) =>
        ce(View, { key: String(i), style: S.secRow },
          ce(View, { style: S.secHead },
            ce(Text, { style: S.secName }, sec.section),
            ce(Text, { style: S.secDur }, sec.duration_estimate),
          ),
          ...sec.lines.map((line, j) => ce(Text, { key: String(j), style: { ...S.secLine, ...arTx(line) } }, line)),
          sec.visual_note ? ce(Text, { style: S.vizNote }, `[Visual: ${sec.visual_note}]`) : null,
        ),
      ),
      piece.total_duration ? ce(Text, { style: S.small }, `Total duration: ${piece.total_duration}`) : null,
    ) : null,

    // Carousel: slides
    piece.type === 'carousel' && pAny.slides && pAny.slides.length > 0 ? ce(View, null,
      ce(Text, { style: { ...S.secLabel, marginBottom: 8 } }, 'SLIDES'),
      ...pAny.slides.map((slide, i) =>
        ce(View, { key: String(i), style: S.slideCard },
          ce(Text, { style: S.slideNum }, `SLIDE ${i + 1}`),
          ce(Text, { style: { ...S.slideTitle, ...arBd(slide.title) } }, slide.title),
          ce(Text, { style: { ...S.slideBody, ...arTx(slide.body) } }, slide.body),
          slide.visual_note ? ce(Text, { style: S.vizNote }, `[Visual: ${slide.visual_note}]`) : null,
        ),
      ),
    ) : null,

    // Static: visual direction
    piece.type === 'static' && pAny.visual_direction ? ce(View, null,
      ce(Text, { style: { ...S.secLabel, marginBottom: 8 } }, 'VISUAL DIRECTION'),
      ce(View, { style: S.secRow }, ce(Text, { style: { ...S.secLine, ...arTx(pAny.visual_direction) } }, pAny.visual_direction)),
    ) : null,

    // TOV + B-roll
    (pAny.text_overlay || (piece.key_broll_list && piece.key_broll_list.length > 0)) ? ce(View, { style: { ...S.twoCol, marginTop: 10 } },
      pAny.text_overlay ? ce(View, { style: { ...S.infoBox, ...S.col } },
        ce(Text, { style: S.infoLbl }, 'TEXT ON VISUAL (TOV)'),
        ce(Text, { style: { ...S.infoTx, ...arTx(pAny.text_overlay) } }, pAny.text_overlay),
      ) : null,
      piece.key_broll_list && piece.key_broll_list.length > 0 ? ce(View, { style: { ...S.infoBox, ...S.col } },
        ce(Text, { style: S.infoLbl }, 'B-ROLL / ASSETS'),
        ...piece.key_broll_list.map((b, i) => ce(Text, { key: String(i), style: S.infoTx }, `· ${b}`)),
      ) : null,
    ) : null,

    // Caption
    piece.caption_preview ? ce(View, { style: { ...S.captionBox, marginTop: 10 } },
      ce(Text, { style: S.captionLbl }, 'CAPTION PREVIEW'),
      ce(Text, { style: { ...S.captionTx, ...arTx(piece.caption_preview) } }, piece.caption_preview),
    ) : null,

    // Brand compliance
    piece.brand_compliance_notes ? ce(View, { style: { marginTop: 10 } },
      ce(Text, { style: S.small }, `Brand compliance: ${piece.brand_compliance_notes}`),
    ) : null,

    ce(Footer, { clientName }),
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface InputSummary {
  platforms: string[]; goal: string; audience: string; cta: string
  brief: string; language: string; dialect: string; content_type: string
}

interface ExportBody {
  content:    ContentDocument
  bossBrief?: BossBrief | null
  inputs:     InputSummary
  clientName?: string
  clientColor?: string
  options?: { size?: 'A4' | 'LETTER'; theme?: 'brand' | 'light' }
}

// ── Route ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ExportBody
    const { content, bossBrief, inputs, clientName = 'Client', clientColor, options } = body
    CONTENT_PDF_SIZE = options?.size ?? 'A4'

    if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

    const pieces = content.pieces ?? [{
      type:            (content.content_type ?? 'reel') as 'reel' | 'carousel' | 'static',
      index:           0,
      hook:            content.hook ?? null,
      script_sections: content.script_sections ?? [],
      key_broll_list:  content.key_broll_list ?? [],
      caption_preview: content.caption_preview ?? '',
    } as ContentPiece]

    const date     = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    const firstHook = pieces[0]?.hook?.text ?? content.hook?.text

    const doc = ce(Document, { title: `${clientName} Content Plan` } as React.ComponentProps<typeof Document>,
      ce(CoverPage, { clientName, clientColor, inputs, hook: firstHook, date }),
      bossBrief ? ce(BossBriefPage, { bb: bossBrief, clientName }) : null,
      ...pieces.map((piece, idx) => ce(PiecePage, { piece, idx, total: pieces.length, clientName, clientColor })),
    )

    const nodeBuffer = await renderToBuffer(doc)
    const uint8 = new Uint8Array(nodeBuffer)

    const filename = `novax-content-plan-${clientName.replace(/\s+/g, '-').toLowerCase()}.pdf`
    return new NextResponse(uint8, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      String(uint8.byteLength),
      },
    })
  } catch (e) {
    console.error('[content/export-pdf]', e)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }
}
