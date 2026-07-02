import 'server-only'
import React from 'react'
import { Document, Page, Text, View } from '@react-pdf/renderer'
import type { DeckDocument, DeckSlide, DeckBranding } from './deck-types'
import { toPdfFont } from './design-system'

// ── Shared components ────────────────────────────────────────────────────────

function PageFooter({ b, clientName }: { b: DeckBranding; clientName: string }) {
  return (
    <View style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 36, paddingVertical: 9,
      borderTopWidth: 0.5, borderTopColor: b.accent + '30',
    }}>
      <Text style={{ fontSize: 7, fontFamily: toPdfFont(b.bodyFont), color: b.muted, flex: 1 }}>
        {clientName}
      </Text>
      <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: b.accent, letterSpacing: 2 }}>
        NOVAX
      </Text>
    </View>
  )
}

function SectionLabel({ text, color }: { text: string; color: string }) {
  return (
    <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, color, marginBottom: 6 }}>
      {text.toUpperCase()}
    </Text>
  )
}

function AccentStrip({ b }: { b: DeckBranding }) {
  return <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: b.accent }} />
}

function BulletRow({ text, b }: { text: string; b: DeckBranding }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 5, alignItems: 'flex-start' }}>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: b.accent, marginTop: 4, flexShrink: 0 }} />
      <Text style={{ fontSize: 10, fontFamily: toPdfFont(b.bodyFont), color: b.body, lineHeight: 1.55, flex: 1 }}>
        {text}
      </Text>
    </View>
  )
}

// ── Slide renderers ──────────────────────────────────────────────────────────

function CoverSlide({ slide, b, clientName }: { slide: DeckSlide; b: DeckBranding; clientName: string }) {
  const titleFont = toPdfFont(b.titleFont)
  return (
    <View style={{ flex: 1, backgroundColor: b.background, position: 'relative' }}>
      {/* Left accent strip */}
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: b.accent }} />
      {/* Decorative large circle — bottom right */}
      <View style={{
        position: 'absolute', bottom: -60, right: -60,
        width: 260, height: 260, borderRadius: 130,
        backgroundColor: b.accent, opacity: 0.1,
      }} />
      {/* Smaller circle — top right */}
      <View style={{
        position: 'absolute', top: -20, right: 60,
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: b.accent, opacity: 0.07,
      }} />

      {/* Content — centered vertically */}
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 64, paddingVertical: 60 }}>
        {slide.tag && (
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: b.accent, letterSpacing: 2.5, marginBottom: 20 }}>
            {slide.tag.toUpperCase()}
          </Text>
        )}
        <View style={{ width: 40, height: 2.5, backgroundColor: b.accent, borderRadius: 2, marginBottom: 20 }} />
        <Text style={{
          fontSize: 36, fontFamily: titleFont, fontWeight: 'bold',
          color: b.surface, lineHeight: 1.1, marginBottom: 16,
        }}>
          {slide.title}
        </Text>
        {slide.subtitle && (
          <Text style={{ fontSize: 14, fontFamily: toPdfFont(b.bodyFont), color: b.accent, lineHeight: 1.5 }}>
            {slide.subtitle}
          </Text>
        )}
      </View>

      {/* Bottom — client + NOVAX */}
      <View style={{
        paddingHorizontal: 64, paddingBottom: 32,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Text style={{ fontSize: 8, fontFamily: toPdfFont(b.bodyFont), color: b.accent + '80' }}>
          {clientName}
        </Text>
        <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: b.accent + '60', letterSpacing: 2 }}>
          NOVAX
        </Text>
      </View>
    </View>
  )
}

function SectionHeaderSlide({ slide, b, clientName }: { slide: DeckSlide; b: DeckBranding; clientName: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: b.surface, position: 'relative', justifyContent: 'center', alignItems: 'center' }}>
      {/* Top accent bar */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: b.accent }} />
      {/* Faded background symbol */}
      <View style={{ position: 'absolute', bottom: 10, right: 20, opacity: 0.04 }}>
        <Text style={{ fontSize: 180, fontFamily: 'Helvetica-Bold', color: b.primary }}>{'§'}</Text>
      </View>

      <View style={{ alignItems: 'center', paddingHorizontal: 60 }}>
        <View style={{ width: 36, height: 2.5, backgroundColor: b.accent, borderRadius: 2, marginBottom: 20 }} />
        <Text style={{
          fontSize: 28, fontFamily: toPdfFont(b.titleFont), fontWeight: 'bold',
          color: b.primary, textAlign: 'center', lineHeight: 1.2,
        }}>
          {slide.title}
        </Text>
      </View>
      <PageFooter b={b} clientName={clientName} />
    </View>
  )
}

function ExecutiveSummarySlide({ slide, b, clientName }: { slide: DeckSlide; b: DeckBranding; clientName: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: b.surface, position: 'relative' }}>
      <AccentStrip b={b} />
      <View style={{ flex: 1, paddingHorizontal: 48, paddingLeft: 56, paddingTop: 40, paddingBottom: 52 }}>
        <SectionLabel text="Overview" color={b.muted} />
        <Text style={{
          fontSize: 22, fontFamily: toPdfFont(b.titleFont), fontWeight: 'bold',
          color: b.primary, marginBottom: 20, lineHeight: 1.2,
        }}>
          {slide.title}
        </Text>
        {slide.body && (
          <View style={{ backgroundColor: b.accent + '10', borderRadius: 8, padding: 20, borderLeftWidth: 4, borderLeftColor: b.accent, marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontFamily: toPdfFont(b.bodyFont), color: b.body, lineHeight: 1.7 }}>
              {slide.body}
            </Text>
          </View>
        )}
        {(slide.bullets ?? []).map((bullet, i) => (
          <BulletRow key={i} text={bullet} b={b} />
        ))}
      </View>
      <PageFooter b={b} clientName={clientName} />
    </View>
  )
}

function CampaignSlide({ slide, b, clientName }: { slide: DeckSlide; b: DeckBranding; clientName: string }) {
  const isWhy = slide.tag === 'why'
  const tovBullets = (slide.bullets ?? []).filter(bl => bl.startsWith('TOV:')).map(bl => bl.replace(/^TOV:\s*/, ''))
  const whyBullets = (slide.bullets ?? []).filter(bl => bl.startsWith('WHY:')).map(bl => bl.replace(/^WHY:\s*/, ''))
  const normalBullets = isWhy ? [] : (slide.bullets ?? [])

  if (isWhy) {
    return (
      <View style={{ flex: 1, backgroundColor: b.surface, position: 'relative' }}>
        <AccentStrip b={b} />
        <View style={{ flex: 1, paddingHorizontal: 48, paddingLeft: 56, paddingTop: 36, paddingBottom: 52 }}>
          <Text style={{
            fontSize: 14, fontFamily: toPdfFont(b.titleFont), fontWeight: 'bold',
            color: b.primary, marginBottom: 20,
          }}>
            {slide.title}
          </Text>
          <View style={{ flexDirection: 'row', gap: 20, flex: 1 }}>
            <View style={{ flex: 1 }}>
              <SectionLabel text="Tone of Voice" color={b.accent} />
              {tovBullets.map((line, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                  <View style={{ width: 3, borderRadius: 2, backgroundColor: b.accent, flexShrink: 0, alignSelf: 'stretch', minHeight: 12 }} />
                  <Text style={{ fontSize: 9.5, fontFamily: toPdfFont(b.bodyFont), color: b.body, lineHeight: 1.5, flex: 1 }}>{line}</Text>
                </View>
              ))}
            </View>
            <View style={{ width: 0.75, backgroundColor: b.muted + '30', alignSelf: 'stretch' }} />
            <View style={{ flex: 1 }}>
              <SectionLabel text="Why It Works" color={b.accent} />
              {whyBullets.map((line, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                  <View style={{ width: 3, borderRadius: 2, backgroundColor: b.accent, flexShrink: 0, alignSelf: 'stretch', minHeight: 12 }} />
                  <Text style={{ fontSize: 9.5, fontFamily: toPdfFont(b.bodyFont), color: b.body, lineHeight: 1.5, flex: 1 }}>{line}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <PageFooter b={b} clientName={clientName} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: b.surface, position: 'relative' }}>
      <AccentStrip b={b} />
      <View style={{ flex: 1, paddingHorizontal: 48, paddingLeft: 56, paddingTop: 36, paddingBottom: 52 }}>
        {slide.tag && slide.tag !== 'why' && (
          <View style={{ flexDirection: 'row', marginBottom: 10 }}>
            <View style={{ backgroundColor: b.accent + '18', borderWidth: 1, borderColor: b.accent + '40', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: b.accent, letterSpacing: 1 }}>
                {slide.tag.toUpperCase()}
              </Text>
            </View>
          </View>
        )}
        <Text style={{
          fontSize: 20, fontFamily: toPdfFont(b.titleFont), fontWeight: 'bold',
          color: b.primary, lineHeight: 1.2, marginBottom: 6,
        }}>
          {slide.title}
        </Text>
        {slide.subtitle && (
          <Text style={{ fontSize: 11, fontFamily: toPdfFont(b.bodyFont), color: b.muted, fontStyle: 'italic', marginBottom: 14 }}>
            {slide.subtitle}
          </Text>
        )}
        {(slide.body || normalBullets.length > 0) && (
          <View style={{ width: 24, height: 2, backgroundColor: b.accent, borderRadius: 1, marginBottom: 12 }} />
        )}
        {slide.body && (
          <Text style={{ fontSize: 10.5, fontFamily: toPdfFont(b.bodyFont), color: b.body, lineHeight: 1.65, marginBottom: normalBullets.length > 0 ? 12 : 0 }}>
            {slide.body}
          </Text>
        )}
        {normalBullets.map((bullet, i) => (
          <BulletRow key={i} text={bullet} b={b} />
        ))}
      </View>
      <PageFooter b={b} clientName={clientName} />
    </View>
  )
}

function PillarSlide({ slide, b, clientName }: { slide: DeckSlide; b: DeckBranding; clientName: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: b.surface, position: 'relative' }}>
      <AccentStrip b={b} />
      <View style={{ flex: 1, paddingHorizontal: 48, paddingLeft: 56, paddingTop: 36, paddingBottom: 52 }}>
        {slide.tag && <SectionLabel text={slide.tag} color={b.muted} />}
        <Text style={{
          fontSize: 20, fontFamily: toPdfFont(b.titleFont), fontWeight: 'bold',
          color: b.primary, lineHeight: 1.2, marginBottom: 14,
        }}>
          {slide.title}
        </Text>
        {slide.body && (
          <Text style={{ fontSize: 10.5, fontFamily: toPdfFont(b.bodyFont), color: b.body, lineHeight: 1.65, marginBottom: 14 }}>
            {slide.body}
          </Text>
        )}
        {(slide.bullets ?? []).map((bullet, i) => (
          <BulletRow key={i} text={bullet} b={b} />
        ))}
      </View>
      <PageFooter b={b} clientName={clientName} />
    </View>
  )
}

function MetricsSlide({ slide, b, clientName }: { slide: DeckSlide; b: DeckBranding; clientName: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: b.background, position: 'relative' }}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: b.accent }} />
      <View style={{ position: 'absolute', bottom: -50, right: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: b.accent, opacity: 0.08 }} />

      <View style={{ flex: 1, paddingHorizontal: 56, paddingTop: 40, paddingBottom: 52, justifyContent: 'center' }}>
        <SectionLabel text="Key Results" color={b.accent + '80'} />
        <Text style={{
          fontSize: 24, fontFamily: toPdfFont(b.titleFont), fontWeight: 'bold',
          color: b.surface, lineHeight: 1.2, marginBottom: slide.body ? 12 : 24,
        }}>
          {slide.title}
        </Text>
        {slide.body && (
          <Text style={{ fontSize: 11, fontFamily: toPdfFont(b.bodyFont), color: b.surface + 'AA', lineHeight: 1.6, marginBottom: 20 }}>
            {slide.body}
          </Text>
        )}
        {(slide.bullets ?? []).map((bullet, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: b.accent, marginTop: 5, flexShrink: 0 }} />
            <Text style={{ fontSize: 11, fontFamily: toPdfFont(b.bodyFont), color: b.accent, lineHeight: 1.5, flex: 1 }}>
              {bullet}
            </Text>
          </View>
        ))}
      </View>
      <PageFooter b={b} clientName={clientName} />
    </View>
  )
}

function CtaSlide({ slide, b, clientName }: { slide: DeckSlide; b: DeckBranding; clientName: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: b.background, position: 'relative' }}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: b.accent }} />
      <View style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: b.accent, opacity: 0.07 }} />
      <View style={{ position: 'absolute', bottom: -30, right: 80, width: 100, height: 100, borderRadius: 50, backgroundColor: b.accent, opacity: 0.05 }} />

      <View style={{ flex: 1, paddingHorizontal: 56, paddingTop: 40, paddingBottom: 52, justifyContent: 'center', alignItems: 'center' }}>
        <SectionLabel text="Next Steps" color={b.accent + '80'} />
        <Text style={{
          fontSize: 26, fontFamily: toPdfFont(b.titleFont), fontWeight: 'bold',
          color: b.surface, textAlign: 'center', lineHeight: 1.2, marginBottom: slide.body ? 12 : 28,
        }}>
          {slide.title}
        </Text>
        {slide.body && (
          <Text style={{ fontSize: 11, fontFamily: toPdfFont(b.bodyFont), color: b.surface + '80', textAlign: 'center', lineHeight: 1.6, marginBottom: 24, maxWidth: 420 }}>
            {slide.body}
          </Text>
        )}
        <View style={{ gap: 10, width: '100%', maxWidth: 420 }}>
          {(slide.bullets ?? []).map((bullet, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12, backgroundColor: b.accent + '15', borderRadius: 8, padding: 14, alignItems: 'flex-start' }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: b.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: b.background }}>{i + 1}</Text>
              </View>
              <Text style={{ fontSize: 10, fontFamily: toPdfFont(b.bodyFont), color: b.accent, lineHeight: 1.55, flex: 1 }}>
                {bullet}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <PageFooter b={b} clientName={clientName} />
    </View>
  )
}

// ── Main document ────────────────────────────────────────────────────────────

export function DeckPdfDocument({ deck }: { deck: DeckDocument }) {
  const b = deck.branding
  const clientName = deck.client_name || 'NOVAX'

  function renderSlide(slide: DeckSlide) {
    switch (slide.type) {
      case 'cover':             return <CoverSlide slide={slide} b={b} clientName={clientName} />
      case 'section_header':    return <SectionHeaderSlide slide={slide} b={b} clientName={clientName} />
      case 'executive_summary': return <ExecutiveSummarySlide slide={slide} b={b} clientName={clientName} />
      case 'campaign':          return <CampaignSlide slide={slide} b={b} clientName={clientName} />
      case 'pillar':            return <PillarSlide slide={slide} b={b} clientName={clientName} />
      case 'metrics':           return <MetricsSlide slide={slide} b={b} clientName={clientName} />
      case 'cta':               return <CtaSlide slide={slide} b={b} clientName={clientName} />
      default:                  return <PillarSlide slide={slide} b={b} clientName={clientName} />
    }
  }

  return (
    <Document title={deck.title} author="NOVAX" creator="NOVAX Ops">
      {deck.slides.map(slide => (
        <Page
          key={slide.id}
          size="A4"
          orientation="landscape"
          style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
        >
          {renderSlide(slide)}
        </Page>
      ))}
    </Document>
  )
}
