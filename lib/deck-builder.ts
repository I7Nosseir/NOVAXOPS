import 'server-only'
import PptxGenJS from 'pptxgenjs'
import type { DeckDocument, DeckSlide, DeckBranding } from './deck-types'

// ── Colour helpers ─────────────────────────────────────────────────────────────

function stripHash(hex: string): string {
  return hex.startsWith('#') ? hex.slice(1) : hex
}

function lightenHex(hex: string, percent: number): string {
  const clean = stripHash(hex)
  const num = parseInt(clean, 16)
  const amt = Math.round(2.55 * percent)
  const R = Math.min(255, (num >> 16) + amt)
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt)
  const B = Math.min(255, (num & 0x0000ff) + amt)
  return ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)
}

// ── PPTX ───────────────────────────────────────────────────────────────────────

const W = 13.33
const H = 7.5
const M = 0.5

function renderSlide(s: PptxGenJS.Slide, slide: DeckSlide, b: DeckBranding): void {
  const contentW = W - 2 * M

  switch (slide.type) {
    case 'cover': {
      s.background = { color: stripHash(b.background) }
      s.addText(slide.title, {
        x: M, y: 2.2, w: contentW, h: 1.6,
        fontSize: 40, bold: true,
        color: stripHash(b.surface),
        align: 'center', valign: 'middle',
        fontFace: b.titleFont,
      })
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: M, y: 4.1, w: contentW, h: 0.8,
          fontSize: 20,
          color: stripHash(b.accent),
          align: 'center', valign: 'middle',
          fontFace: b.bodyFont,
        })
      }
      if (slide.tag) {
        s.addText(slide.tag, {
          x: M, y: 6.5, w: contentW, h: 0.5,
          fontSize: 14,
          color: stripHash(b.muted),
          align: 'center',
          fontFace: b.bodyFont,
        })
      }
      break
    }

    case 'executive_summary': {
      s.background = { color: stripHash(b.surface) }
      s.addShape('rect', {
        x: 0, y: 0, w: 0.1, h: H,
        fill: { color: stripHash(b.accent) },
        line: { color: stripHash(b.accent) },
      })
      s.addText(slide.title, {
        x: M, y: M, w: contentW, h: 0.6,
        fontSize: 24, bold: true,
        color: stripHash(b.primary),
        fontFace: b.titleFont,
      })
      if (slide.body) {
        s.addText(slide.body, {
          x: M, y: M + 0.8, w: contentW, h: 5.5,
          fontSize: 14,
          color: stripHash(b.body),
          valign: 'top',
          fontFace: b.bodyFont,
        })
      }
      break
    }

    case 'section_header': {
      s.background = { color: lightenHex(b.background, 85) }
      s.addText(slide.title, {
        x: M, y: 2.5, w: contentW, h: 2.5,
        fontSize: 32, bold: true,
        color: stripHash(b.primary),
        align: 'center', valign: 'middle',
        fontFace: b.titleFont,
      })
      break
    }

    case 'campaign': {
      s.background = { color: stripHash(b.surface) }
      if (slide.tag === 'why') {
        const colW = (contentW - 0.4) / 2
        const l = M
        const r = M + colW + 0.4
        s.addText('Tone of Voice', {
          x: l, y: M, w: colW, h: 0.4,
          fontSize: 11, bold: true,
          color: stripHash(b.accent),
          fontFace: b.titleFont,
        })
        const tovLines = (slide.bullets ?? [])
          .filter(bl => bl.startsWith('TOV:'))
          .map(bl => bl.replace(/^TOV:\s*/, ''))
        let ty = M + 0.5
        for (const line of tovLines) {
          s.addText(line, { x: l + 0.15, y: ty, w: colW - 0.15, h: 0.45, fontSize: 13, color: stripHash(b.body), fontFace: b.bodyFont })
          ty += 0.55
        }
        s.addText('Why It Works', {
          x: r, y: M, w: colW, h: 0.4,
          fontSize: 11, bold: true,
          color: stripHash(b.accent),
          fontFace: b.titleFont,
        })
        const whyLines = (slide.bullets ?? [])
          .filter(bl => bl.startsWith('WHY:'))
          .map(bl => bl.replace(/^WHY:\s*/, ''))
        let wy = M + 0.5
        for (const line of whyLines) {
          s.addText(line, { x: r + 0.15, y: wy, w: colW - 0.15, h: 0.45, fontSize: 13, color: stripHash(b.body), fontFace: b.bodyFont })
          wy += 0.55
        }
      } else {
        if (slide.tag) {
          s.addText(slide.tag, { x: M, y: M, w: 2.5, h: 0.35, fontSize: 10, bold: true, color: stripHash(b.accent), fontFace: b.bodyFont })
        }
        s.addText(slide.title, { x: M, y: M + 0.45, w: contentW, h: 0.7, fontSize: 26, bold: true, color: stripHash(b.primary), fontFace: b.titleFont })
        if (slide.subtitle) {
          s.addText(slide.subtitle, { x: M, y: M + 1.25, w: contentW, h: 0.5, fontSize: 16, color: stripHash(b.muted), fontFace: b.bodyFont })
        }
        if (slide.body) {
          s.addText(slide.body, { x: M, y: M + 1.85, w: contentW, h: 4.5, fontSize: 13, color: stripHash(b.body), valign: 'top', fontFace: b.bodyFont })
        }
      }
      break
    }

    case 'pillar': {
      s.background = { color: stripHash(b.surface) }
      s.addText(slide.title, { x: M, y: M, w: contentW, h: 0.6, fontSize: 22, bold: true, color: stripHash(b.primary), fontFace: b.titleFont })
      if (slide.body) {
        s.addText(slide.body, { x: M, y: M + 0.8, w: contentW, h: 1.2, fontSize: 13, color: stripHash(b.muted), valign: 'top', fontFace: b.bodyFont })
      }
      let by = slide.body ? M + 2.2 : M + 0.9
      for (const bullet of slide.bullets ?? []) {
        s.addText(`•  ${bullet}`, { x: M + 0.2, y: by, w: contentW - 0.2, h: 0.5, fontSize: 13, color: stripHash(b.body), fontFace: b.bodyFont })
        by += 0.6
      }
      break
    }

    case 'metrics': {
      s.background = { color: stripHash(b.background) }
      s.addText(slide.title, { x: M, y: M, w: contentW, h: 0.7, fontSize: 24, bold: true, color: stripHash(b.surface), fontFace: b.titleFont })
      let my = M + 1.1
      for (const bullet of slide.bullets ?? []) {
        s.addText(bullet, { x: M, y: my, w: contentW, h: 0.9, fontSize: 18, bold: true, color: stripHash(b.accent), align: 'center', fontFace: b.bodyFont })
        my += 1.1
      }
      break
    }

    case 'cta': {
      s.background = { color: stripHash(b.background) }
      s.addText(slide.title, { x: M, y: 1.2, w: contentW, h: 1.0, fontSize: 28, bold: true, color: stripHash(b.surface), align: 'center', fontFace: b.titleFont })
      let cy = 2.6
      for (const bullet of slide.bullets ?? []) {
        s.addText(bullet, { x: M, y: cy, w: contentW, h: 0.7, fontSize: 16, color: stripHash(b.accent), align: 'center', fontFace: b.bodyFont })
        cy += 0.9
      }
      break
    }
  }

  if (slide.note) s.addNotes(slide.note)
}

export async function buildDeckPptx(deck: DeckDocument): Promise<Buffer> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  const b = deck.branding

  console.log('[buildDeckPptx] branding:', {
    background: b.background, surface: b.surface, primary: b.primary,
    accent: b.accent, titleFont: b.titleFont, bodyFont: b.bodyFont,
  })

  for (let i = 0; i < deck.slides.length; i++) {
    const slide = deck.slides[i]
    console.log(`[buildDeckPptx] slide ${i + 1}/${deck.slides.length}: type=${slide.type}`)
    const s = pptx.addSlide()
    renderSlide(s, slide, b)
  }

  const raw = await pptx.write({ outputType: 'nodebuffer' })
  // pptx.write returns ArrayBuffer in some runtimes; ensure Node Buffer
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer)
}
