import 'server-only'
import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { DeckDocument, DeckSlide, DeckBranding } from './deck-types'

function pdfFont(font: string): string {
  const map: Record<string, string> = {
    'Georgia':         'Times-Roman',
    'Times New Roman': 'Times-Roman',
    'Calibri':         'Helvetica',
    'Helvetica':       'Helvetica',
  }
  return map[font] ?? 'Helvetica'
}

function makeStyles(b: DeckBranding) {
  return StyleSheet.create({
    cover: {
      flex: 1,
      backgroundColor: b.background,
      padding: 48,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    },
    page: {
      flex: 1,
      backgroundColor: b.surface,
      padding: 40,
      display: 'flex',
      flexDirection: 'column',
    },
    darkPage: {
      flex: 1,
      backgroundColor: b.background,
      padding: 40,
      display: 'flex',
      flexDirection: 'column',
    },
    centeredPage: {
      flex: 1,
      backgroundColor: b.surface,
      padding: 40,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    },
    coverTitle: {
      fontSize: 36,
      fontWeight: 'bold',
      color: b.surface,
      textAlign: 'center',
      marginBottom: 16,
      fontFamily: pdfFont(b.titleFont),
    },
    coverSubtitle: {
      fontSize: 18,
      color: b.accent,
      textAlign: 'center',
      fontFamily: pdfFont(b.bodyFont),
    },
    coverTag: {
      fontSize: 12,
      color: b.muted,
      textAlign: 'center',
      marginTop: 24,
      fontFamily: pdfFont(b.bodyFont),
    },
    sectionTitle: {
      fontSize: 30,
      fontWeight: 'bold',
      color: b.primary,
      textAlign: 'center',
      fontFamily: pdfFont(b.titleFont),
    },
    slideTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: b.primary,
      marginBottom: 10,
      fontFamily: pdfFont(b.titleFont),
    },
    darkTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: b.surface,
      marginBottom: 10,
      fontFamily: pdfFont(b.titleFont),
    },
    tag: {
      fontSize: 10,
      color: b.accent,
      fontWeight: 'bold',
      marginBottom: 4,
      fontFamily: pdfFont(b.bodyFont),
    },
    subtitle: {
      fontSize: 14,
      color: b.muted,
      marginBottom: 8,
      fontFamily: pdfFont(b.bodyFont),
    },
    body: {
      fontSize: 12,
      color: b.body,
      lineHeight: 1.5,
      fontFamily: pdfFont(b.bodyFont),
    },
    bullet: {
      fontSize: 12,
      color: b.body,
      marginBottom: 5,
      marginLeft: 12,
      fontFamily: pdfFont(b.bodyFont),
    },
    accentBullet: {
      fontSize: 14,
      color: b.accent,
      marginBottom: 8,
      textAlign: 'center',
      fontFamily: pdfFont(b.bodyFont),
    },
    row: {
      display: 'flex',
      flexDirection: 'row',
      gap: 16,
      marginTop: 8,
    },
    col: {
      flex: 1,
    },
    colLabel: {
      fontSize: 10,
      fontWeight: 'bold',
      color: b.accent,
      marginBottom: 6,
      fontFamily: pdfFont(b.titleFont),
    },
  })
}

interface SlideProps {
  slide: DeckSlide
  styles: ReturnType<typeof makeStyles>
  b: DeckBranding
}

function SlideContent({ slide, styles, b }: SlideProps) {
  if (slide.type === 'cover') {
    return (
      <View style={styles.cover}>
        <Text style={styles.coverTitle}>{slide.title}</Text>
        {slide.subtitle ? <Text style={styles.coverSubtitle}>{slide.subtitle}</Text> : null}
        {slide.tag ? <Text style={styles.coverTag}>{slide.tag}</Text> : null}
      </View>
    )
  }

  if (slide.type === 'section_header') {
    return (
      <View style={styles.centeredPage}>
        <Text style={styles.sectionTitle}>{slide.title}</Text>
      </View>
    )
  }

  if (slide.type === 'metrics' || slide.type === 'cta') {
    return (
      <View style={styles.darkPage}>
        <Text style={styles.darkTitle}>{slide.title}</Text>
        {slide.body ? <Text style={{ ...styles.body, color: b.surface }}>{slide.body}</Text> : null}
        {(slide.bullets ?? []).map((bullet, i) => (
          <Text key={i} style={styles.accentBullet}>{bullet}</Text>
        ))}
      </View>
    )
  }

  if (slide.type === 'campaign' && slide.tag === 'why') {
    const tovLines = (slide.bullets ?? []).filter(bl => bl.startsWith('TOV:')).map(bl => bl.replace(/^TOV:\s*/, ''))
    const whyLines = (slide.bullets ?? []).filter(bl => bl.startsWith('WHY:')).map(bl => bl.replace(/^WHY:\s*/, ''))
    return (
      <View style={styles.page}>
        <Text style={styles.slideTitle}>{slide.title}</Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.colLabel}>Tone of Voice</Text>
            {tovLines.map((line, i) => <Text key={i} style={styles.bullet}>• {line}</Text>)}
          </View>
          <View style={styles.col}>
            <Text style={styles.colLabel}>Why It Works</Text>
            {whyLines.map((line, i) => <Text key={i} style={styles.bullet}>• {line}</Text>)}
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.page}>
      {slide.tag && slide.tag !== 'why' ? <Text style={styles.tag}>{slide.tag}</Text> : null}
      <Text style={styles.slideTitle}>{slide.title}</Text>
      {slide.subtitle ? <Text style={styles.subtitle}>{slide.subtitle}</Text> : null}
      {slide.body ? <Text style={styles.body}>{slide.body}</Text> : null}
      {(slide.bullets ?? []).length > 0 ? (
        <View style={{ marginTop: 8 }}>
          {(slide.bullets ?? []).map((bullet, i) => (
            <Text key={i} style={styles.bullet}>• {bullet}</Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}

export function DeckPdfDocument({ deck }: { deck: DeckDocument }) {
  const b = deck.branding
  const styles = makeStyles(b)
  const pageStyle = StyleSheet.create({
    base: { display: 'flex', flexDirection: 'column', height: '100%' },
  })
  return (
    <Document>
      {deck.slides.map(slide => {
        const isDark = slide.type === 'cover' || slide.type === 'metrics' || slide.type === 'cta'
        return (
          <Page
            key={slide.id}
            size="A4"
            orientation="landscape"
            style={[
              pageStyle.base,
              { backgroundColor: isDark ? b.background : b.surface },
            ]}
          >
            <SlideContent slide={slide} styles={styles} b={b} />
          </Page>
        )
      })}
    </Document>
  )
}
