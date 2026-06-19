// ============================================================
// Strategy PDF — react-pdf/renderer v4 — 20-page template
// All measurements in PDF points. A4 = 595 × 842 pts.
// ============================================================

import React from 'react'
import {
  Document, Page, Text, View, Svg,
  Path, Rect, Circle,
} from '@react-pdf/renderer'
import type {
  StrategyDocument,
  StrategyContentPillar,
  StrategyPlatformRole,
  StrategyMonthTactic,
  StrategyArcPhase,
  StrategyFormatRoles,
  StrategyFlowBeat,
  BossBrief,
} from '@/lib/studio-types'

// ── Palette ──────────────────────────────────────────────────────────────────

const C = {
  dark:       '#0C1610',
  novax:      '#1B3D38',
  accent:     '#5BB4AE',
  accentDim:  '#2A6B62',
  gold:       '#C4956A',
  white:      '#FFFFFF',
  g900:       '#0F172A',
  g700:       '#374151',
  g500:       '#64748B',
  g400:       '#94A3B8',
  g200:       '#E2E8F0',
  g100:       '#F1F5F9',
  g50:        '#F8FAFC',
  border:     '#DDE6E5',
}

// ── Fonts are Helvetica (built-in) — no registration needed ──────────────────
// react-pdf wraps text automatically inside Text, but View containers with
// explicit heights or overflow:hidden will clip. All content views use
// paddingBottom to stay clear of the footer, and Text nodes always flex:1.


// ── Helpers ───────────────────────────────────────────────────────────────────

function s(v: unknown): string { return v ? String(v) : '' }
function a(v: unknown): string[] { return Array.isArray(v) ? v.map(String).filter(Boolean) : [] }

function brand(clientColor?: string) {
  return clientColor && /^#[0-9A-Fa-f]{6}$/.test(clientColor) ? clientColor : C.novax
}

// ── Platform SVG logos (react-pdf/renderer Svg components) ───────────────────

function PlatformLogo({ platform, size = 20 }: { platform: string; size?: number }) {
  const p = platform.toLowerCase().replace(/[^a-z]/g, '')

  if (p === 'instagram' || p === 'ig') return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="1" y="1" width="22" height="22" rx="6" fill="#E1306C" />
      <Rect x="6.5" y="6.5" width="11" height="11" rx="3.5" stroke="#FFFFFF" strokeWidth="1.6" fill="none" />
      <Circle cx="12" cy="12" r="2.9" stroke="#FFFFFF" strokeWidth="1.5" fill="none" />
      <Circle cx="16.5" cy="7.5" r="1.1" fill="#FFFFFF" />
    </Svg>
  )

  if (p === 'facebook' || p === 'fb') return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="1" y="1" width="22" height="22" rx="5" fill="#1877F2" />
      <Path d="M14.3 7H12.5C11.6 7 11 7.7 11 8.6V10.5H9.5V13H11V21H13.5V13H15.2L15.7 10.5H13.5V9C13.5 8.7 13.7 8.5 14 8.5H15.7V7H14.3Z" fill="#FFFFFF" />
    </Svg>
  )

  if (p === 'linkedin') return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="1" y="1" width="22" height="22" rx="5" fill="#0A66C2" />
      <Path d="M7 10.5H9.5V17H7V10.5ZM8.25 9.25C7.56 9.25 7 8.69 7 8C7 7.31 7.56 6.75 8.25 6.75C8.94 6.75 9.5 7.31 9.5 8C9.5 8.69 8.94 9.25 8.25 9.25Z" fill="#FFFFFF" />
      <Path d="M12 10.5H14.4V11.8C14.8 11.1 15.7 10.3 17 10.3C19.6 10.3 20 12.1 20 14.4V17H17.5V14.8C17.5 13.6 17.5 12.2 16 12.2C14.5 12.2 14.3 13.4 14.3 14.7V17H12V10.5Z" fill="#FFFFFF" />
    </Svg>
  )

  if (p === 'tiktok' || p === 'tt') return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="1" y="1" width="22" height="22" rx="5" fill="#010101" />
      <Path d="M17 8.3C16.2 8.1 15.5 7.6 15 7C14.4 6.3 14.1 5.4 14.1 4.5H12V15.2C12 16.1 11.3 16.8 10.4 16.8C9.5 16.8 8.8 16.1 8.8 15.2C8.8 14.3 9.5 13.6 10.4 13.6C10.6 13.6 10.8 13.6 11 13.7V11.4C10.8 11.4 10.6 11.3 10.4 11.3C8.3 11.3 6.5 13.1 6.5 15.2C6.5 17.3 8.3 19.1 10.4 19.1C12.5 19.1 14.3 17.3 14.3 15.2V9.6C15.2 10.2 16.1 10.5 17 10.5V8.3Z" fill="#FFFFFF" />
      <Path d="M17 8.3C16.7 9.2 16 9.8 15 9.9V8.3C15.4 8.4 15.7 8.4 17 8.3Z" fill="#25F4EE" />
    </Svg>
  )

  if (p === 'youtube' || p === 'yt') return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="1" y="1" width="22" height="22" rx="5" fill="#FF0000" />
      <Path d="M19.6 8.3C19.4 7.5 18.8 6.9 18 6.7C16.6 6.3 12 6.3 12 6.3C12 6.3 7.4 6.3 6 6.7C5.2 6.9 4.6 7.5 4.4 8.3C4 9.7 4 12.5 4 12.5C4 12.5 4 15.3 4.4 16.7C4.6 17.5 5.2 18.1 6 18.3C7.4 18.7 12 18.7 12 18.7C12 18.7 16.6 18.7 18 18.3C18.8 18.1 19.4 17.5 19.6 16.7C20 15.3 20 12.5 20 12.5C20 12.5 20 9.7 19.6 8.3Z" fill="#FFFFFF" />
      <Path d="M10 15.5V9.5L15.2 12.5L10 15.5Z" fill="#FF0000" />
    </Svg>
  )

  if (p === 'snapchat' || p === 'snap') return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="1" y="1" width="22" height="22" rx="5" fill="#FFFC00" />
      <Path d="M12 4.5C9.5 4.5 7.5 6.5 7.5 9V10C7 10 6 10.2 5.9 10.7C5.8 11.2 6.3 11.4 6.8 11.5C6.5 12 5.7 13 4.5 13.5C5.2 13.9 6.4 14 7.5 13.5C7.8 14 8.2 14.5 9.5 14.7C9.7 14.9 9.5 15.5 9 15.5V16.5C10.5 17 11 17 12 17C13 17 13.5 17 15 16.5V15.5C14.5 15.5 14.3 14.9 14.5 14.7C15.8 14.5 16.2 14 16.5 13.5C17.6 14 18.8 13.9 19.5 13.5C18.3 13 17.5 12 17.2 11.5C17.7 11.4 18.2 11.2 18.1 10.7C18 10.2 17 10 16.5 10V9C16.5 6.5 14.5 4.5 12 4.5Z" fill="#1A1A1A" />
    </Svg>
  )

  if (p === 'twitter' || p === 'x' || p === 'xtwitterxtwitter') return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="1" y="1" width="22" height="22" rx="5" fill="#000000" />
      <Path d="M17.5 5H20.1L14.5 11.4L21 19H15.9L11.7 13.7L6.9 19H4.3L10.3 12.2L4 5H9.2L13.1 9.8L17.5 5ZM16.6 17.4H18.1L8.5 6.6H6.8L16.6 17.4Z" fill="#FFFFFF" />
    </Svg>
  )

  // Generic platform badge
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="1" y="1" width="22" height="22" rx="5" fill={C.novax} />
      <Path d="M12 7L14.5 10.5H17.5L15 13.5L16.2 17L12 15L7.8 17L9 13.5L6.5 10.5H9.5L12 7Z" fill="#FFFFFF" />
    </Svg>
  )
}

// ── Shared page components ────────────────────────────────────────────────────

// Thin breadcrumb bar at the top of light pages
function PageHeader({ label, accentColor }: { label: string; accentColor: string }) {
  return (
    <View style={{ backgroundColor: accentColor, paddingHorizontal: 40, paddingVertical: 9, flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ color: '#FFFFFF', fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5 }}>{label.toUpperCase()}</Text>
    </View>
  )
}

// Thin left accent strip for dark pages
function AccentStrip({ color }: { color: string }) {
  return <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: color }} />
}

// Small section label (all-caps, letter-spaced)
function SectionLabel({ text, color = C.g400 }: { text: string; color?: string }) {
  return <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 2, color, marginBottom: 6 }}>{text.toUpperCase()}</Text>
}

// Horizontal rule
function HRule({ color = C.g200, marginVertical = 12 }: { color?: string; marginVertical?: number }) {
  return <View style={{ height: 0.75, backgroundColor: color, marginVertical }} />
}

// Bullet list
function BulletList({ items, color = C.g700, dotColor = C.accent, fontSize = 9.5 }: { items: string[]; color?: string; dotColor?: string; fontSize?: number }) {
  return (
    <View style={{ gap: 4 }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: dotColor, marginTop: fontSize * 0.35, flexShrink: 0 }} />
          <Text style={{ fontSize, fontFamily: 'Helvetica', color, lineHeight: 1.5, flex: 1 }}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

// Page number footer
function PageFooter({ clientName, pageNum, total, accentColor }: { clientName: string; pageNum: number; total: number; accentColor: string }) {
  return (
    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 40, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: C.g200 }}>
      <Text style={{ fontSize: 7, fontFamily: 'Helvetica', color: C.g400, flex: 1 }}>{clientName}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 20, height: 1.5, backgroundColor: accentColor }} />
        <Text style={{ fontSize: 7, fontFamily: 'Helvetica', color: C.g400 }}>{pageNum} / {total}</Text>
      </View>
    </View>
  )
}

// ── Page: COVER ───────────────────────────────────────────────────────────────

function CoverPage({ clientName, doc, clientColor, platforms, quarter, year }: {
  clientName: string
  doc: StrategyDocument
  clientColor?: string
  platforms: string[]
  quarter?: string
  year?: number
}) {
  const bc = brand(clientColor)
  const campaignLine = s(doc.campaign_line)
  const positioningStatement = s(doc.positioning_statement)

  return (
    <Page size="A4" style={{ backgroundColor: C.dark, fontFamily: 'Helvetica', position: 'relative' }}>
      <AccentStrip color={bc} />

      {/* Top decorative grid dots */}
      <View style={{ position: 'absolute', top: 0, right: 0, width: 240, height: 240, opacity: 0.05 }}>
        {Array.from({ length: 8 }).map((_, row) =>
          Array.from({ length: 8 }).map((__, col) => (
            <View key={`${row}-${col}`} style={{
              position: 'absolute',
              left: col * 30,
              top: row * 30,
              width: 2,
              height: 2,
              borderRadius: 1,
              backgroundColor: C.accent,
            }} />
          ))
        )}
      </View>

      {/* NOVAX wordmark */}
      <View style={{ position: 'absolute', top: 42, left: 60 }}>
        <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: C.accent, letterSpacing: 4 }}>NOVAX</Text>
        <View style={{ width: 36, height: 2, backgroundColor: C.accent, marginTop: 5, opacity: 0.6 }} />
      </View>

      {/* Strategy label */}
      <View style={{ position: 'absolute', top: 80, left: 60, right: 60 }}>
        <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica', color: '#4A6A65', letterSpacing: 3 }}>
          QUARTERLY SOCIAL MEDIA STRATEGY
        </Text>
      </View>

      {/* Client name — center of page */}
      <View style={{ position: 'absolute', top: 220, left: 60, right: 60 }}>
        {/* Thin accent line above name */}
        <View style={{ width: 48, height: 2, backgroundColor: bc, marginBottom: 20 }} />
        <Text style={{ fontSize: 46, fontFamily: 'Helvetica-Bold', color: C.white, lineHeight: 1.1, letterSpacing: -0.5 }}>
          {clientName}
        </Text>
        {campaignLine ? (
          <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Oblique', color: C.gold, marginTop: 18, lineHeight: 1.5 }}>
            {`"${campaignLine}"`}
          </Text>
        ) : null}
        {positioningStatement ? (
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica', color: '#7A9A96', marginTop: 14, lineHeight: 1.6, maxWidth: 380 }}>
            {positioningStatement}
          </Text>
        ) : null}
      </View>

      {/* Quarter + platforms row */}
      <View style={{ position: 'absolute', top: 500, left: 60, right: 60 }}>
        <View style={{ height: 0.75, backgroundColor: '#2A4A44', marginBottom: 20 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {(quarter || year) && (
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#9BB8B4' }}>
              {[quarter, year].filter(Boolean).join(' ')}
            </Text>
          )}
          {platforms.slice(0, 6).map(p => (
            <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#182E28', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
              <PlatformLogo platform={p} size={12} />
              <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica', color: '#9BB8B4' }}>{p}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Bottom — NOVAX attribution */}
      <View style={{ position: 'absolute', bottom: 40, left: 60, right: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 7, fontFamily: 'Helvetica', color: '#3A5A56' }}>Confidential — Prepared exclusively for {clientName}</Text>
        <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#4A6A65', letterSpacing: 2 }}>NOVAX</Text>
      </View>
    </Page>
  )
}

// ── Page: TABLE OF CONTENTS ───────────────────────────────────────────────────

function TOCPage({ doc, clientName, accentColor, totalPages }: { doc: StrategyDocument; clientName: string; accentColor: string; totalPages: number }) {
  const sections = [
    { n: '01', title: 'Strategic Foundation', sub: 'Positioning, campaign line, quarter role', page: 4 },
    { n: '02', title: 'Brand Identity', sub: 'Identity shift, persona direction', page: 6 },
    { n: '03', title: 'Content Pillars', sub: `${a(doc.content_pillars).length || (doc.content_pillars?.length ?? 0)} pillars defined`, page: 8 },
    { n: '04', title: 'Platform Strategy', sub: `${(doc.platform_roles ?? []).length} platform roles`, page: 10 },
    { n: '05', title: 'Monthly Roadmap', sub: `${(doc.monthly_tactics ?? []).length} months detailed`, page: 12 },
    { n: '06', title: 'Strategy Arc', sub: 'Narrative phases', page: 16 },
    { n: '07', title: 'Creative Formats', sub: 'Reels, motion, static playbook', page: 18 },
  ]

  return (
    <Page size="A4" style={{ backgroundColor: C.g50, fontFamily: 'Helvetica' }}>
      <PageHeader label="Table of Contents" accentColor={accentColor} />
      <View style={{ paddingHorizontal: 50, paddingTop: 40 }}>
        <Text style={{ fontSize: 26, fontFamily: 'Helvetica-Bold', color: C.g900, marginBottom: 8 }}>Contents</Text>
        <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica', color: C.g500, marginBottom: 36 }}>
          {clientName} · Social Media Strategy
        </Text>
        <View style={{ gap: 0 }}>
          {sections.map(({ n, title, sub, page }, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, borderBottomWidth: 0.75, borderBottomColor: C.g200 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: accentColor, width: 32 }}>{n}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.g900 }}>{title}</Text>
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica', color: C.g500, marginTop: 2 }}>{sub}</Text>
              </View>
              <View style={{ width: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                <View style={{ flex: 1, height: 0.75, backgroundColor: C.g200 }} />
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica', color: C.g400 }}>p.{page}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      <PageFooter clientName={clientName} pageNum={2} total={totalPages} accentColor={accentColor} />
    </Page>
  )
}

// ── Page: SECTION DIVIDER (dark) ──────────────────────────────────────────────

function SectionDividerPage({ number, title, description, accentColor }: {
  number: string
  title: string
  description?: string
  accentColor: string
}) {
  return (
    <Page size="A4" style={{ backgroundColor: C.dark, fontFamily: 'Helvetica', position: 'relative' }}>
      <AccentStrip color={accentColor} />
      {/* Giant section number as background element */}
      <View style={{ position: 'absolute', bottom: 40, right: 40, opacity: 0.04 }}>
        <Text style={{ fontSize: 200, fontFamily: 'Helvetica-Bold', color: C.accent }}>{number}</Text>
      </View>
      <View style={{ position: 'absolute', top: 280, left: 60, right: 100 }}>
        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: accentColor, letterSpacing: 3, marginBottom: 16 }}>
          {`${number} ─`}
        </Text>
        <Text style={{ fontSize: 36, fontFamily: 'Helvetica-Bold', color: C.white, lineHeight: 1.15, letterSpacing: -0.5 }}>
          {title}
        </Text>
        {description && (
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica', color: '#7A9A96', marginTop: 16, lineHeight: 1.6 }}>
            {description}
          </Text>
        )}
      </View>
    </Page>
  )
}

// ── Page: EXECUTIVE SUMMARY ───────────────────────────────────────────────────

function ExecutiveSummaryPage({ doc, clientName, accentColor, pageNum, totalPages }: {
  doc: StrategyDocument; clientName: string; accentColor: string; pageNum: number; totalPages: number
}) {
  const pos  = s(doc.positioning_statement)
  const camp = s(doc.campaign_line)
  const qrole = s(doc.quarter_role)
  const obstacle = s(doc.obstacle)

  return (
    <Page size="A4" style={{ backgroundColor: C.g50, fontFamily: 'Helvetica' }}>
      <PageHeader label="01 — Strategic Foundation" accentColor={accentColor} />
      <View style={{ paddingHorizontal: 50, paddingTop: 32, paddingBottom: 72 }}>
        <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.g900, marginBottom: 24 }}>Strategic Foundation</Text>

        {/* Positioning statement — hero block */}
        {pos && (
          <View style={{ backgroundColor: accentColor, borderRadius: 8, padding: 24, marginBottom: 22 }}>
            <SectionLabel text="Positioning Statement" color="rgba(255,255,255,0.6)" />
            <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white, lineHeight: 1.65 }}>{pos}</Text>
          </View>
        )}

        {/* Campaign line + Quarter role — 2 columns */}
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 20 }}>
          {camp && (
            <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 8, padding: 20, borderLeftWidth: 4, borderLeftColor: C.gold }}>
              <SectionLabel text="Campaign Line" color={C.g400} />
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-BoldOblique', color: C.gold, lineHeight: 1.5 }}>
                {`"${camp}"`}
              </Text>
            </View>
          )}
          {qrole && (
            <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 8, padding: 20, borderLeftWidth: 4, borderLeftColor: accentColor }}>
              <SectionLabel text="Quarter Role" color={C.g400} />
              <Text style={{ fontSize: 10.5, fontFamily: 'Helvetica', color: C.g700, lineHeight: 1.65 }}>{qrole}</Text>
            </View>
          )}
        </View>

        {/* Executive summary text if present */}
        {doc.executive_summary && (
          <View style={{ backgroundColor: C.white, borderRadius: 8, padding: 20, marginBottom: 16 }}>
            <SectionLabel text="Executive Summary" color={C.g400} />
            <Text style={{ fontSize: 10.5, fontFamily: 'Helvetica', color: C.g700, lineHeight: 1.7 }}>{s(doc.executive_summary)}</Text>
          </View>
        )}

        {/* Deep-strategy intelligence row */}
        {(doc.north_star || doc.audience_insight || doc.competitive_gap || doc.creative_tension) && (
          <View style={{ marginBottom: 16 }}>
            <SectionLabel text="Strategic Intelligence" color={C.g400} />
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {doc.north_star && (
                <View style={{ flex: 1, minWidth: 200, backgroundColor: C.dark, borderRadius: 8, padding: 14 }}>
                  <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, color: C.accent + 'BB', marginBottom: 5 }}>NORTH STAR</Text>
                  <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica', color: C.white, lineHeight: 1.55 }}>{s(doc.north_star)}</Text>
                </View>
              )}
              {doc.audience_insight && (
                <View style={{ flex: 1, minWidth: 200, backgroundColor: accentColor, borderRadius: 8, padding: 14 }}>
                  <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, color: 'rgba(255,255,255,0.65)', marginBottom: 5 }}>AUDIENCE INSIGHT</Text>
                  <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: C.white, lineHeight: 1.55 }}>{s(doc.audience_insight)}</Text>
                </View>
              )}
            </View>
            {(doc.competitive_gap || doc.creative_tension) && (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                {doc.competitive_gap && (
                  <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 8, padding: 14, borderLeftWidth: 3, borderLeftColor: C.accentDim }}>
                    <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, color: C.g400, marginBottom: 5 }}>COMPETITIVE GAP CLAIMED</Text>
                    <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica', color: C.g700, lineHeight: 1.55 }}>{s(doc.competitive_gap)}</Text>
                  </View>
                )}
                {doc.creative_tension && (
                  <View style={{ flex: 1, backgroundColor: '#FFF7ED', borderRadius: 8, padding: 14, borderLeftWidth: 3, borderLeftColor: C.gold }}>
                    <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, color: '#92400E', marginBottom: 5 }}>CREATIVE TENSION</Text>
                    <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica', color: '#78350F', lineHeight: 1.55 }}>{s(doc.creative_tension)}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Obstacle if present */}
        {obstacle && (
          <View style={{ backgroundColor: '#FEF3C7', borderRadius: 8, padding: 16, borderLeftWidth: 3, borderLeftColor: C.gold }}>
            <SectionLabel text="Main Obstacle to Overcome" color="#92400E" />
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica', color: '#78350F', lineHeight: 1.6 }}>{obstacle}</Text>
          </View>
        )}
      </View>
      <PageFooter clientName={clientName} pageNum={pageNum} total={totalPages} accentColor={accentColor} />
    </Page>
  )
}

// ── Page: BRAND IDENTITY ──────────────────────────────────────────────────────

function BrandIdentityPage({ doc, clientName, accentColor, pageNum, totalPages }: {
  doc: StrategyDocument; clientName: string; accentColor: string; pageNum: number; totalPages: number
}) {
  const shift     = s(doc.identity_shift)
  const campTheme = s(doc.campaign_theme)
  const qrole     = s(doc.quarter_role)
  const tenants   = a(doc.tenant_integration)

  return (
    <Page size="A4" style={{ backgroundColor: C.g50, fontFamily: 'Helvetica' }}>
      <PageHeader label="02 — Brand Identity" accentColor={accentColor} />
      <View style={{ paddingHorizontal: 50, paddingTop: 32, paddingBottom: 60 }}>
        <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.g900, marginBottom: 24 }}>Brand Identity & Direction</Text>

        {/* Identity shift */}
        {shift && (
          <View style={{ backgroundColor: C.dark, borderRadius: 8, padding: 24, marginBottom: 20 }}>
            <SectionLabel text="Identity Shift This Quarter" color={C.accent + '88'} />
            <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white, lineHeight: 1.65 }}>{shift}</Text>
          </View>
        )}

        {/* Campaign theme */}
        {campTheme && (
          <View style={{ backgroundColor: C.white, borderRadius: 8, padding: 20, marginBottom: 16, borderWidth: 1.5, borderColor: C.gold + '55' }}>
            <SectionLabel text="Campaign Theme" color={C.g400} />
            <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Oblique', color: C.gold, lineHeight: 1.6 }}>{campTheme}</Text>
          </View>
        )}

        {/* Tenant integration */}
        {tenants.length > 0 && (
          <View style={{ backgroundColor: C.white, borderRadius: 8, padding: 20, marginBottom: 16 }}>
            <SectionLabel text="Partner / Tenant Integration Rules" color={C.g400} />
            <BulletList items={tenants} dotColor={accentColor} />
          </View>
        )}

        {/* Quarter role summary if not already shown */}
        {qrole && !doc.positioning_statement && (
          <View style={{ backgroundColor: C.white, borderRadius: 8, padding: 20, borderLeftWidth: 4, borderLeftColor: accentColor }}>
            <SectionLabel text="Quarter Strategic Role" color={C.g400} />
            <Text style={{ fontSize: 10.5, fontFamily: 'Helvetica', color: C.g700, lineHeight: 1.7 }}>{qrole}</Text>
          </View>
        )}
      </View>
      <PageFooter clientName={clientName} pageNum={pageNum} total={totalPages} accentColor={accentColor} />
    </Page>
  )
}

// ── Page: CONTENT PILLARS ─────────────────────────────────────────────────────

function ContentPillarsPage({ pillars, pageIndex, clientName, accentColor, pageNum, totalPages }: {
  pillars: StrategyContentPillar[]
  pageIndex: number
  clientName: string
  accentColor: string
  pageNum: number
  totalPages: number
}) {
  const PILLAR_ACCENTS = [accentColor, C.gold, '#7C3AED', '#DB2777', '#EA580C', '#0891B2']

  return (
    <Page size="A4" style={{ backgroundColor: C.g50, fontFamily: 'Helvetica' }}>
      <PageHeader label="03 — Content Pillars" accentColor={accentColor} />
      <View style={{ paddingHorizontal: 50, paddingTop: 32, paddingBottom: 60 }}>
        {pageIndex === 0 && (
          <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.g900, marginBottom: 6 }}>Content Pillars</Text>
        )}
        {pageIndex === 0 && (
          <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica', color: C.g500, marginBottom: 24 }}>
            Each pillar serves a distinct audience need and stage of the customer journey.
          </Text>
        )}
        <View style={{ gap: 16 }}>
          {pillars.map((pillar, i) => {
            const globalIdx = pageIndex * 3 + i
            const pillarColor = PILLAR_ACCENTS[globalIdx % PILLAR_ACCENTS.length]
            return (
              <View key={i} style={{ backgroundColor: C.white, borderRadius: 10, borderWidth: 1, borderColor: C.border }}>
                {/* Header bar */}
                <View style={{ backgroundColor: pillarColor + '18', borderBottomWidth: 1, borderBottomColor: pillarColor + '40', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: pillarColor, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.white }}>{String(globalIdx + 1).padStart(2, '0')}</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.g900, flex: 1 }}>{s(pillar.name)}</Text>
                  {(pillar as StrategyContentPillar & { posting_frequency?: string }).posting_frequency && (
                    <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica', color: pillarColor, backgroundColor: pillarColor + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                      {(pillar as StrategyContentPillar & { posting_frequency?: string }).posting_frequency}
                    </Text>
                  )}
                </View>
                {/* Body */}
                <View style={{ paddingHorizontal: 20, paddingVertical: 14 }}>
                  <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica', color: C.g700, lineHeight: 1.65, marginBottom: 10 }}>{s(pillar.description)}</Text>
                  {/* Example topics if present */}
                  {((pillar as StrategyContentPillar & { example_topics?: string[] }).example_topics?.length ?? 0) > 0 && (
                    <>
                      <SectionLabel text="Example Topics" color={C.g400} />
                      <BulletList
                        items={(pillar as StrategyContentPillar & { example_topics?: string[] }).example_topics!.slice(0, 4)}
                        dotColor={pillarColor}
                        fontSize={9}
                        color={C.g500}
                      />
                    </>
                  )}
                </View>
              </View>
            )
          })}
        </View>
      </View>
      <PageFooter clientName={clientName} pageNum={pageNum} total={totalPages} accentColor={accentColor} />
    </Page>
  )
}

// ── Page: PLATFORM STRATEGY ───────────────────────────────────────────────────

function PlatformStrategyPage({ roles, clientName, accentColor, pageNum, totalPages }: {
  roles: StrategyPlatformRole[]
  clientName: string
  accentColor: string
  pageNum: number
  totalPages: number
}) {
  return (
    <Page size="A4" style={{ backgroundColor: C.g50, fontFamily: 'Helvetica' }}>
      <PageHeader label="04 — Platform Strategy" accentColor={accentColor} />
      <View style={{ paddingHorizontal: 50, paddingTop: 32, paddingBottom: 60 }}>
        <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.g900, marginBottom: 6 }}>Platform Roles</Text>
        <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica', color: C.g500, marginBottom: 24 }}>
          Each platform has a distinct strategic role — audience stage, content format, and conversion objective.
        </Text>
        <View style={{ gap: 14 }}>
          {roles.map((role, i) => (
            <View key={i} style={{ backgroundColor: C.white, borderRadius: 10, padding: 18, flexDirection: 'row', gap: 16, borderWidth: 1, borderColor: C.border, alignItems: 'flex-start' }}>
              {/* Platform logo */}
              <View style={{ paddingTop: 2 }}>
                <PlatformLogo platform={s(role.platform)} size={32} />
              </View>
              {/* Content */}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.g900 }}>{s(role.platform)}</Text>
                  {s(role.role) && (
                    <View style={{ backgroundColor: accentColor + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                      <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: accentColor }}>{s(role.role)}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica', color: C.g700, lineHeight: 1.65 }}>{s(role.description)}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      <PageFooter clientName={clientName} pageNum={pageNum} total={totalPages} accentColor={accentColor} />
    </Page>
  )
}

// ── Page: MONTHLY ROADMAP INTRO ───────────────────────────────────────────────

function MonthlyRoadmapIntroPage({ tactics, clientName, accentColor, pageNum, totalPages }: {
  tactics: StrategyMonthTactic[]
  clientName: string
  accentColor: string
  pageNum: number
  totalPages: number
}) {
  return (
    <Page size="A4" style={{ backgroundColor: C.g50, fontFamily: 'Helvetica' }}>
      <PageHeader label="05 — Monthly Roadmap" accentColor={accentColor} />
      <View style={{ paddingHorizontal: 50, paddingTop: 32, paddingBottom: 60 }}>
        <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.g900, marginBottom: 6 }}>Monthly Execution Roadmap</Text>
        <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica', color: C.g500, marginBottom: 28 }}>
          Each month has a distinct strategic role, persona direction, and set of focus areas.
        </Text>
        {/* Compact overview table */}
        <View style={{ gap: 0, borderWidth: 1, borderColor: C.border, borderRadius: 8 }}>
          {/* Header row */}
          <View style={{ flexDirection: 'row', backgroundColor: accentColor, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Text style={{ flex: 0.6, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: 1 }}>MONTH</Text>
            <Text style={{ flex: 1, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: 1 }}>ROLE</Text>
            <Text style={{ flex: 1.5, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: 1 }}>THEME LINE</Text>
            <Text style={{ flex: 1, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: 1 }}>PERSONA</Text>
          </View>
          {tactics.map((t, i) => (
            <View key={i} style={{ flexDirection: 'row', backgroundColor: i % 2 === 0 ? C.white : C.g50, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 0.75, borderTopColor: C.g200 }}>
              <Text style={{ flex: 0.6, fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: C.g900 }}>{s(t.month)}</Text>
              <Text style={{ flex: 1, fontSize: 9, fontFamily: 'Helvetica', color: C.g700, lineHeight: 1.5 }}>{s(t.role)}</Text>
              <Text style={{ flex: 1.5, fontSize: 9, fontFamily: 'Helvetica-Oblique', color: C.gold, lineHeight: 1.5 }}>{s(t.theme_line)}</Text>
              <Text style={{ flex: 1, fontSize: 9, fontFamily: 'Helvetica', color: C.g500, lineHeight: 1.5 }}>
                {a(t.brand_persona_adjectives).slice(0, 3).join(' · ')}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <PageFooter clientName={clientName} pageNum={pageNum} total={totalPages} accentColor={accentColor} />
    </Page>
  )
}

// ── Page: MONTHLY TACTIC DETAIL ───────────────────────────────────────────────

function MonthlyTacticPage({ tactic, monthIndex, clientName, accentColor, pageNum, totalPages }: {
  tactic: StrategyMonthTactic
  monthIndex: number
  clientName: string
  accentColor: string
  pageNum: number
  totalPages: number
}) {
  const MONTH_COLORS = [accentColor, C.gold, '#7C3AED']
  const monthColor = MONTH_COLORS[monthIndex % MONTH_COLORS.length]

  return (
    <Page size="A4" style={{ backgroundColor: C.g50, fontFamily: 'Helvetica' }}>
      <PageHeader label={`05 — Monthly Roadmap · Month ${monthIndex + 1}`} accentColor={accentColor} />
      <View style={{ paddingHorizontal: 50, paddingTop: 28, paddingBottom: 60 }}>
        {/* Month header */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
          <View style={{ width: 50, height: 50, borderRadius: 10, backgroundColor: monthColor, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.white }}>{monthIndex + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.g900 }}>{s(tactic.month)}</Text>
            {tactic.role && (
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica', color: C.g500, marginTop: 2 }}>{s(tactic.role)}</Text>
            )}
          </View>
        </View>

        {/* Theme line — prominent */}
        {tactic.theme_line && (
          <View style={{ backgroundColor: monthColor + '15', borderRadius: 8, padding: 16, marginBottom: 18, borderLeftWidth: 4, borderLeftColor: monthColor }}>
            <SectionLabel text="Month Theme Line" color={monthColor} />
            <Text style={{ fontSize: 14, fontFamily: 'Helvetica-BoldOblique', color: monthColor }}>
              {`"${s(tactic.theme_line)}"`}
            </Text>
          </View>
        )}

        {/* Description */}
        {tactic.description && (
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica', color: C.g700, lineHeight: 1.7, marginBottom: 20 }}>
            {s(tactic.description)}
          </Text>
        )}

        {/* Two columns: Persona + Focus | Outcomes */}
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ flex: 1, gap: 16 }}>
            {/* Brand Persona */}
            {(a(tactic.brand_persona_adjectives).length > 0 || tactic.brand_persona_description) && (
              <View style={{ backgroundColor: C.white, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: C.border }}>
                <SectionLabel text="Brand Persona" color={C.g400} />
                {a(tactic.brand_persona_adjectives).length > 0 && (
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: tactic.brand_persona_description ? 10 : 0 }}>
                    {a(tactic.brand_persona_adjectives).map((adj, j) => (
                      <View key={j} style={{ backgroundColor: monthColor + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                        <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: monthColor }}>{adj}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {tactic.brand_persona_description && (
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica', color: C.g700, lineHeight: 1.6 }}>{s(tactic.brand_persona_description)}</Text>
                )}
              </View>
            )}
            {/* Focus Areas */}
            {a(tactic.focus).length > 0 && (
              <View style={{ backgroundColor: C.white, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: C.border }}>
                <SectionLabel text="Focus Areas" color={C.g400} />
                <BulletList items={a(tactic.focus)} dotColor={monthColor} fontSize={9.5} />
              </View>
            )}
          </View>
          {/* Outcomes */}
          {a(tactic.outcome).length > 0 && (
            <View style={{ flex: 1, backgroundColor: monthColor + '10', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: monthColor + '30' }}>
              <SectionLabel text="Expected Outcomes" color={monthColor} />
              <BulletList items={a(tactic.outcome)} dotColor={monthColor} fontSize={9.5} color={C.g700} />
            </View>
          )}
        </View>
      </View>
      <PageFooter clientName={clientName} pageNum={pageNum} total={totalPages} accentColor={accentColor} />
    </Page>
  )
}

// ── Page: STRATEGY ARC ────────────────────────────────────────────────────────

function StrategyArcPage({ arc, flow, clientName, accentColor, pageNum, totalPages }: {
  arc: StrategyArcPhase[]
  flow: StrategyFlowBeat[]
  clientName: string
  accentColor: string
  pageNum: number
  totalPages: number
}) {
  return (
    <Page size="A4" style={{ backgroundColor: C.g50, fontFamily: 'Helvetica' }}>
      <PageHeader label="06 — Strategy Arc" accentColor={accentColor} />
      <View style={{ paddingHorizontal: 50, paddingTop: 32, paddingBottom: 60 }}>
        <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.g900, marginBottom: 24 }}>Strategy Arc & Narrative Flow</Text>

        {arc.length > 0 && (
          <>
            <SectionLabel text="Narrative Arc Phases" color={C.g400} />
            <View style={{ gap: 10, marginBottom: 24 }}>
              {arc.map((phase, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
                  {/* Timeline dot + line */}
                  <View style={{ alignItems: 'center', flexShrink: 0, width: 28 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: accentColor, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.white }}>{s(phase.number)}</Text>
                    </View>
                    {i < arc.length - 1 && (
                      <View style={{ width: 1.5, height: 20, backgroundColor: C.g200, marginTop: 2 }} />
                    )}
                  </View>
                  <View style={{ flex: 1, paddingTop: 3, paddingBottom: i < arc.length - 1 ? 18 : 0 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.g900, marginBottom: 4 }}>{s(phase.phase_name)}</Text>
                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica', color: C.g700, lineHeight: 1.6 }}>{s(phase.description)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {flow.length > 0 && (
          <>
            <HRule />
            <SectionLabel text="Strategy Flow Beats" color={C.g400} />
            <View style={{ gap: 8 }}>
              {flow.map((beat, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: C.white, borderRadius: 6, padding: 12, borderWidth: 1, borderColor: C.border }}>
                  <View style={{ backgroundColor: accentColor + '20', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, flexShrink: 0 }}>
                    <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: accentColor }}>{s(beat.label) || s(beat.beat)}</Text>
                  </View>
                  <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica', color: C.g700, flex: 1, lineHeight: 1.5 }}>{s(beat.description)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
      <PageFooter clientName={clientName} pageNum={pageNum} total={totalPages} accentColor={accentColor} />
    </Page>
  )
}

// ── Page: FORMAT ROLES ────────────────────────────────────────────────────────

function FormatRolesPage({ formats, clientName, accentColor, pageNum, totalPages }: {
  formats: StrategyFormatRoles
  clientName: string
  accentColor: string
  pageNum: number
  totalPages: number
}) {
  const cols = [
    { title: 'Reels',           color: '#EF4444', items: a(formats.reels),           desc: 'Short-form video for reach and discovery' },
    { title: 'Motion Graphics', color: '#8B5CF6', items: a(formats.motion_graphics), desc: 'Animated content for brand storytelling' },
    { title: 'Static Carousel', color: accentColor, items: a(formats.static_carousel), desc: 'Save-worthy education and product showcases' },
  ].filter(c => c.items.length > 0)

  return (
    <Page size="A4" style={{ backgroundColor: C.g50, fontFamily: 'Helvetica' }}>
      <PageHeader label="07 — Creative Formats" accentColor={accentColor} />
      <View style={{ paddingHorizontal: 50, paddingTop: 32, paddingBottom: 60 }}>
        <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.g900, marginBottom: 6 }}>Creative Format Playbook</Text>
        <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica', color: C.g500, marginBottom: 24 }}>
          Each format serves a distinct role in the content mix. Use this guide to brief the creative team.
        </Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          {cols.map(({ title, color, items, desc }, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: C.white, borderRadius: 10, borderWidth: 1, borderColor: C.border }}>
              <View style={{ backgroundColor: color, padding: 14 }}>
                <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 4 }}>{title}</Text>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>{desc}</Text>
              </View>
              <View style={{ padding: 14 }}>
                <BulletList items={items.slice(0, 6)} dotColor={color} fontSize={9} color={C.g700} />
              </View>
            </View>
          ))}
        </View>
      </View>
      <PageFooter clientName={clientName} pageNum={pageNum} total={totalPages} accentColor={accentColor} />
    </Page>
  )
}

// ── Page: BOSS BRIEF ──────────────────────────────────────────────────────────

function BossBriefPage({ brief, clientName, accentColor, pageNum, totalPages }: {
  brief: BossBrief
  clientName: string
  accentColor: string
  pageNum: number
  totalPages: number
}) {
  const items = [
    { label: 'What We Built',   value: s(brief.what_we_made),  color: accentColor },
    { label: 'Why It Works',    value: s(brief.why_it_works),  color: C.gold },
    { label: 'The One Thing',   value: s(brief.the_one_thing), color: '#8B5CF6' },
    { label: 'Do This Now',     value: s(brief.do_this_now),   color: '#10B981' },
  ]
  if (brief.watch_out_for) {
    items.push({ label: 'Watch Out For', value: s(brief.watch_out_for), color: '#EF4444' })
  }
  return (
    <Page size="A4" style={{ backgroundColor: C.dark, fontFamily: 'Helvetica', position: 'relative' }}>
      <AccentStrip color={accentColor} />
      <View style={{ paddingHorizontal: 60, paddingTop: 50 }}>
        <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: accentColor, letterSpacing: 3, marginBottom: 8 }}>BOSS BRIEF — 30-SECOND VERSION</Text>
        <Text style={{ fontSize: 26, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 32 }}>The One-Page Summary</Text>
        <View style={{ gap: 16 }}>
          {items.map(({ label, value, color }, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
              <View style={{ width: 4, backgroundColor: color, borderRadius: 2, flexShrink: 0, minHeight: 20, alignSelf: 'stretch' }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: color, letterSpacing: 1.5, marginBottom: 4 }}>
                  {label.toUpperCase()}
                </Text>
                <Text style={{ fontSize: 10.5, fontFamily: 'Helvetica', color: '#C8D8D5', lineHeight: 1.65 }}>{value}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      <PageFooter clientName={clientName} pageNum={pageNum} total={totalPages} accentColor={accentColor} />
    </Page>
  )
}

// ── Page: BACK COVER ──────────────────────────────────────────────────────────

function BackCoverPage({ clientName, accentColor, quarter, year }: {
  clientName: string; accentColor: string; quarter?: string; year?: number
}) {
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <Page size="A4" style={{ backgroundColor: C.dark, fontFamily: 'Helvetica', position: 'relative' }}>
      <AccentStrip color={accentColor} />
      {/* Large decorative circle */}
      <View style={{ position: 'absolute', bottom: -80, right: -80, width: 320, height: 320, borderRadius: 160, backgroundColor: accentColor, opacity: 0.04 }} />
      <View style={{ position: 'absolute', top: 280, left: 60, right: 60, alignItems: 'center' }}>
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: accentColor, letterSpacing: 3, marginBottom: 20 }}>NOVAX</Text>
        <View style={{ width: 60, height: 1.5, backgroundColor: accentColor, marginBottom: 24 }} />
        <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 8, textAlign: 'center' }}>
          Strategy Ready. Time to Execute.
        </Text>
        <Text style={{ fontSize: 10, fontFamily: 'Helvetica', color: '#7A9A96', textAlign: 'center', lineHeight: 1.6 }}>
          {`Prepared for ${clientName}`}
          {(quarter || year) ? ` · ${[quarter, year].filter(Boolean).join(' ')}` : ''}
        </Text>
        <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica', color: '#3A5A56', marginTop: 30 }}>{dateStr}</Text>
      </View>
    </Page>
  )
}

// ── Main Document ─────────────────────────────────────────────────────────────

export interface StrategyPDFProps {
  doc: StrategyDocument
  clientName: string
  clientColor?: string
  platforms?: string[]
  bossBrief?: BossBrief | null
}

export function StrategyPDF({ doc, clientName, clientColor, platforms = [], bossBrief }: StrategyPDFProps) {
  const accentColor = brand(clientColor)
  const quarter = s(doc.quarter)
  const year    = doc.year ?? undefined

  const pillars  = (doc.content_pillars ?? []) as StrategyContentPillar[]
  const pRoles   = (doc.platform_roles  ?? []) as StrategyPlatformRole[]
  const mTactics = (doc.monthly_tactics ?? []) as StrategyMonthTactic[]
  const arc      = (doc.strategy_arc    ?? []) as StrategyArcPhase[]
  const flow     = (doc.strategy_flow   ?? []) as StrategyFlowBeat[]
  const formats  = doc.format_roles as StrategyFormatRoles | undefined
  const pAll     = platforms.length > 0 ? platforms : a(doc.platforms)

  // Compute total pages
  const pillarPages   = Math.ceil(pillars.length / 3) || 1
  const platformPages = pRoles.length > 0 ? 1 : 0
  const hasArc        = arc.length > 0 || flow.length > 0
  const hasFormats    = !!(formats && (a(formats.reels).length || a(formats.motion_graphics).length || a(formats.static_carousel).length))
  const hasBoss       = !!bossBrief

  // Page count breakdown:
  // 1  cover
  // 1  TOC
  // 1  section divider: Foundation
  // 1  executive summary
  // 1  section divider: Identity
  // 1  brand identity
  // 1  section divider: Pillars
  // N  pillar pages
  // 1  section divider: Platform
  // P  platform page
  // 1  section divider: Monthly
  // 1  monthly intro
  // M  monthly detail pages
  // 1  section divider: Arc (if exists)
  // 1  arc page (if exists)
  // 1  section divider: Formats (if exists)
  // 1  formats page (if exists)
  // B  boss brief (if exists)
  // 1  back cover
  const total =
    1 + 1 +
    1 + 1 +
    1 + 1 +
    1 + pillarPages +
    (pRoles.length > 0 ? 1 + platformPages : 0) +
    1 + 1 + mTactics.length +
    (hasArc ? 2 : 0) +
    (hasFormats ? 2 : 0) +
    (hasBoss ? 1 : 0) +
    1

  let pageNum = 0
  const p = () => { pageNum++; return pageNum }

  return (
    <Document title={`${clientName} — Social Media Strategy${quarter ? ` ${quarter}` : ''}${year ? ` ${year}` : ''}`} author="NOVAX" creator="NOVAX Ops">
      {/* 1. Cover */}
      <CoverPage doc={doc} clientName={clientName} clientColor={clientColor} platforms={pAll} quarter={quarter} year={year} key={`p${p()}`} />

      {/* 2. TOC */}
      <TOCPage doc={doc} clientName={clientName} accentColor={accentColor} totalPages={total} key={`p${p()}`} />

      {/* 3. Section divider: Foundation */}
      <SectionDividerPage number="01" title="Strategic Foundation" description="Positioning, campaign line, quarter role, and main obstacle." accentColor={accentColor} key={`p${p()}`} />

      {/* 4. Executive Summary */}
      <ExecutiveSummaryPage doc={doc} clientName={clientName} accentColor={accentColor} pageNum={p()} totalPages={total} key="exec" />

      {/* 5. Section divider: Identity */}
      <SectionDividerPage number="02" title="Brand Identity" description="Who the brand becomes this quarter and how that shift happens." accentColor={accentColor} key={`p${p()}`} />

      {/* 6. Brand Identity */}
      <BrandIdentityPage doc={doc} clientName={clientName} accentColor={accentColor} pageNum={p()} totalPages={total} key="identity" />

      {/* 7. Section divider: Pillars */}
      <SectionDividerPage number="03" title="Content Pillars" description={`${pillars.length} pillars defined — each serving a distinct audience need.`} accentColor={accentColor} key={`p${p()}`} />

      {/* 8–N. Pillars (3 per page) */}
      {Array.from({ length: pillarPages }).map((_, pi) => (
        <ContentPillarsPage
          key={`pillars-${pi}`}
          pillars={pillars.slice(pi * 3, pi * 3 + 3)}
          pageIndex={pi}
          clientName={clientName}
          accentColor={accentColor}
          pageNum={p()}
          totalPages={total}
        />
      ))}

      {/* Platform section */}
      {pRoles.length > 0 && [
        <SectionDividerPage key={`p${p()}`} number="04" title="Platform Strategy" description={`${pRoles.length} platform roles defined — each with a distinct strategic objective.`} accentColor={accentColor} />,
        <PlatformStrategyPage key="platform" roles={pRoles} clientName={clientName} accentColor={accentColor} pageNum={p()} totalPages={total} />,
      ]}

      {/* Monthly roadmap */}
      <SectionDividerPage key={`p${p()}`} number="05" title="Monthly Roadmap" description={`${mTactics.length}-month execution plan with theme lines, personas, and outcomes.`} accentColor={accentColor} />
      <MonthlyRoadmapIntroPage key="monthly-intro" tactics={mTactics} clientName={clientName} accentColor={accentColor} pageNum={p()} totalPages={total} />
      {mTactics.map((tactic, mi) => (
        <MonthlyTacticPage
          key={`month-${mi}`}
          tactic={tactic}
          monthIndex={mi}
          clientName={clientName}
          accentColor={accentColor}
          pageNum={p()}
          totalPages={total}
        />
      ))}

      {/* Strategy arc */}
      {hasArc && [
        <SectionDividerPage key={`p${p()}`} number="06" title="Strategy Arc" description="The narrative arc and content flow beats that run through the quarter." accentColor={accentColor} />,
        <StrategyArcPage key="arc" arc={arc} flow={flow} clientName={clientName} accentColor={accentColor} pageNum={p()} totalPages={total} />,
      ]}

      {/* Format roles */}
      {hasFormats && [
        <SectionDividerPage key={`p${p()}`} number="07" title="Creative Formats" description="The format playbook — what each content type does and when to use it." accentColor={accentColor} />,
        <FormatRolesPage key="formats" formats={formats!} clientName={clientName} accentColor={accentColor} pageNum={p()} totalPages={total} />,
      ]}

      {/* Boss brief */}
      {hasBoss && (
        <BossBriefPage key="boss" brief={bossBrief!} clientName={clientName} accentColor={accentColor} pageNum={p()} totalPages={total} />
      )}

      {/* Back cover */}
      <BackCoverPage key="back" clientName={clientName} accentColor={accentColor} quarter={quarter} year={year} />
    </Document>
  )
}
