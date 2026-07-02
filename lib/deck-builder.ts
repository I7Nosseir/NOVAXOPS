import 'server-only'
import PptxGenJS from 'pptxgenjs'
import type { DeckDocument, DeckSlide, DeckBranding } from './deck-types'
import { containsArabic, ARABIC_FONT } from './design-system'

// ── Slide dimensions (LAYOUT_WIDE = 13.33" × 7.5") ───────────────────────────
const W = 13.33
const H = 7.5
const M = 0.55

// ── Colour utilities ───────────────────────────────────────────────────────────

function strip(hex: string): string {
  return (hex.startsWith('#') ? hex.slice(1) : hex).toUpperCase()
}

function lightenHex(hex: string, pct: number): string {
  const h = strip(hex)
  const n = parseInt(h, 16)
  const amt = Math.round(2.55 * pct)
  const R = Math.min(255, (n >> 16) + amt)
  const G = Math.min(255, ((n >> 8) & 0xff) + amt)
  const B = Math.min(255, (n & 0xff) + amt)
  return ((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1).toUpperCase()
}

function darkenHex(hex: string, pct: number): string {
  const h = strip(hex)
  const n = parseInt(h, 16)
  const amt = Math.round(2.55 * pct)
  const R = Math.max(0, (n >> 16) - amt)
  const G = Math.max(0, ((n >> 8) & 0xff) - amt)
  const B = Math.max(0, (n & 0xff) - amt)
  return ((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1).toUpperCase()
}

function isDark(hex: string): boolean {
  const h = strip(hex)
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const bv = parseInt(h.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * bv < 140
}

// ── Shape primitives ───────────────────────────────────────────────────────────

type Slide = PptxGenJS.Slide

function addRect(s: Slide, x: number, y: number, w: number, h: number, color: string, tr = 0) {
  s.addShape('rect', {
    x, y, w, h,
    fill: { color: strip(color), transparency: tr },
    line: { color: strip(color), width: 0 },
  })
}

function addEllipse(s: Slide, x: number, y: number, w: number, h: number, color: string, tr = 0) {
  s.addShape('ellipse', {
    x, y, w, h,
    fill: { color: strip(color), transparency: tr },
    line: { color: strip(color), width: 0 },
  })
}

// Border-only ellipse (transparent fill, coloured stroke)
function addEllipseBorder(s: Slide, x: number, y: number, w: number, h: number, borderColor: string, pt: number) {
  s.addShape('ellipse', {
    x, y, w, h,
    fill: { color: 'FFFFFF', transparency: 100 },
    line: { color: strip(borderColor), width: pt },
  })
}

// Rounded rectangle card
function addCard(
  s: Slide, x: number, y: number, w: number, h: number,
  fillColor: string, borderColor?: string, tr = 0,
) {
  s.addShape('roundRect', {
    x, y, w, h,
    rectRadius: 0.06,
    fill: { color: strip(fillColor), transparency: tr },
    line: borderColor
      ? { color: strip(borderColor), width: 0.8 }
      : { color: strip(fillColor), width: 0 },
  })
}

// Crescent moon: solid accent circle + offset cutout in background colour
function addCrescent(s: Slide, cx: number, cy: number, size: number, accentColor: string, cutoutColor: string) {
  addEllipse(s, cx - size / 2, cy - size / 2, size, size, accentColor)
  const cut = size * 0.78
  const ox = size * 0.24
  const oy = size * 0.12
  addEllipse(s, cx - size / 2 + ox, cy - size / 2 - oy, cut, cut, cutoutColor)
}

// Smart text: auto-detects Arabic, applies RTL rendering and Arabic-safe font
interface TextOpts {
  x: number; y: number; w: number; h: number
  fontSize?: number; bold?: boolean; italic?: boolean
  color?: string; fontFace?: string
  align?: 'left' | 'center' | 'right'
  valign?: 'top' | 'middle' | 'bottom'
  charSpacing?: number; lineSpacingMultiple?: number
  rtlMode?: boolean
}
function addSmartText(s: Slide, text: string, opts: TextOpts) {
  const arabic = containsArabic(text)
  s.addText(text, {
    ...opts,
    fontFace: arabic ? ARABIC_FONT : opts.fontFace,
    rtlMode: arabic ? true : opts.rtlMode,
    align: arabic && !opts.align ? 'right' : opts.align,
  })
}

// Row of decorative dots
function addDots(s: Slide, x: number, y: number, count: number, color: string, size = 0.1, gap = 0.09) {
  for (let i = 0; i < count; i++) addEllipse(s, x + i * (size + gap), y, size, size, color)
}

// Thin horizontal rule
function addHRule(s: Slide, x: number, y: number, w: number, color: string) {
  addRect(s, x, y, w, 0.022, color)
}

// Thick left-edge accent bar (full slide height)
function addLeftBar(s: Slide, color: string) {
  addRect(s, 0, 0, 0.065, H, color)
}

// Footer: separator line + left label + right label
function addFooter(s: Slide, left: string, right: string, b: DeckBranding, bgSlide: boolean) {
  const bg = bgSlide ? b.background : b.surface
  const dark = isDark(bg)
  addRect(s, M, H - 0.42, W - 2 * M, 0.008, dark ? b.accent : b.muted, 55)
  s.addText(left, {
    x: M, y: H - 0.38, w: 4.5, h: 0.26,
    fontSize: 8, color: dark ? lightenHex(b.background, 50) : strip(b.muted),
    fontFace: b.bodyFont,
  })
  s.addText(right, {
    x: W - M - 4.5, y: H - 0.38, w: 4.5, h: 0.26,
    fontSize: 8, color: strip(b.accent), fontFace: b.bodyFont, align: 'right',
  })
}

// ── Cover slide ───────────────────────────────────────────────────────────────

function renderCover(s: Slide, slide: DeckSlide, b: DeckBranding, deck: DeckDocument) {
  s.background = { color: strip(b.background) }
  const bgDark = isDark(b.background)
  const titleColor = bgDark ? b.surface : b.primary

  // Layered decorative circles — right side, partially off-canvas
  const bgCircle = lightenHex(b.background, bgDark ? 10 : -4)
  const bigR = H  // 7.5" — bleeds off slide to create arc effect
  addEllipse(s, W - bigR / 2 - 0.3, H * 0.5 - bigR / 2, bigR, bigR, bgCircle)

  const midR = H * 0.7
  const midColor = lightenHex(b.background, bgDark ? 16 : -6)
  addEllipse(s, W * 0.73 - midR / 2, H * 0.4 - midR / 2, midR, midR, midColor)

  // Crescent moon inside the circles
  addCrescent(s, W * 0.75, H * 0.33, H * 0.52, b.accent, midColor)

  // Accent dot row (mid-right)
  addDots(s, W * 0.59, H * 0.56, 6, b.accent, 0.09, 0.1)

  // Top-left accent line + client/label
  addHRule(s, M, 0.58, 0.36, b.accent)
  const label = slide.tag ?? deck.client_name ?? ''
  if (label) {
    s.addText(label.toUpperCase(), {
      x: M + 0.5, y: 0.44, w: W * 0.5, h: 0.32,
      fontSize: 10, bold: true, color: strip(b.accent),
      fontFace: b.bodyFont, charSpacing: 2,
    })
  }

  // Main title — adaptive font size based on length
  const tLen = slide.title.length
  const tSize = tLen > 38 ? 32 : tLen > 26 ? 40 : tLen > 18 ? 46 : 54
  addSmartText(s, slide.title, {
    x: M, y: 0.98, w: W * 0.56, h: 2.76,
    fontSize: tSize, bold: true, color: strip(titleColor),
    fontFace: b.titleFont, valign: 'middle', lineSpacingMultiple: 0.95,
  })

  if (slide.subtitle) {
    addSmartText(s, slide.subtitle, {
      x: M, y: 3.85, w: W * 0.56, h: 0.7,
      fontSize: 20, italic: true, color: strip(b.accent), fontFace: b.titleFont,
    })
  }

  if (slide.body) {
    addSmartText(s, slide.body, {
      x: M, y: 4.62, w: W * 0.52, h: 0.58,
      fontSize: 12, color: bgDark ? lightenHex(b.background, 55) : strip(b.muted),
      fontFace: b.bodyFont,
    })
  }

  addFooter(s, deck.client_name ?? deck.title, slide.subtitle ?? deck.title, b, true)
}

// ── Executive summary ─────────────────────────────────────────────────────────

function renderExecutiveSummary(s: Slide, slide: DeckSlide, b: DeckBranding, deck: DeckDocument) {
  s.background = { color: strip(b.surface) }
  addLeftBar(s, b.accent)

  const cX = M + 0.18
  const cW = W - cX - M

  // Section label in caps
  s.addText(slide.title.toUpperCase(), {
    x: cX, y: M, w: cW, h: 0.38,
    fontSize: 11, bold: true, color: strip(b.accent),
    fontFace: b.bodyFont, charSpacing: 1.5,
  })

  const heading = slide.subtitle ?? ''
  if (heading) {
    s.addText(heading, {
      x: cX, y: M + 0.46, w: cW * 0.62, h: 1.1,
      fontSize: 28, bold: true, color: strip(b.primary),
      fontFace: b.titleFont, lineSpacingMultiple: 1.1,
    })
    addHRule(s, cX, M + 1.65, 0.42, b.accent)
  }

  if (slide.body) {
    const bodyY = heading ? M + 1.82 : M + 0.52
    addSmartText(s, slide.body, {
      x: cX, y: bodyY, w: cW * 0.65, h: H - bodyY - 0.55,
      fontSize: 14, color: strip(b.body), fontFace: b.bodyFont,
      lineSpacingMultiple: 1.55, valign: 'top',
    })
  }

  // Optional bullets — right column as accent cards
  if (slide.bullets?.length) {
    const colX = cX + cW * 0.68
    const colW = W - colX - M * 0.5
    let by = M + 0.46
    for (const bullet of slide.bullets.slice(0, 5)) {
      addCard(s, colX, by, colW, 0.68, darkenHex(b.surface, 2), b.accent)
      addEllipse(s, colX + 0.19, by + 0.24, 0.19, 0.19, b.accent)
      addSmartText(s, bullet, {
        x: colX + 0.5, y: by + 0.06, w: colW - 0.58, h: 0.56,
        fontSize: 12, color: strip(b.body), fontFace: b.bodyFont, valign: 'middle',
      })
      by += 0.84
    }
  }

  addFooter(s, deck.title, deck.client_name ?? '', b, false)
}

// ── Section header ────────────────────────────────────────────────────────────

function renderSectionHeader(s: Slide, slide: DeckSlide, b: DeckBranding, deck: DeckDocument) {
  s.background = { color: lightenHex(b.background, 88) }

  // Thin top accent strip
  addRect(s, 0, 0, W, 0.045, b.accent)

  addHRule(s, W / 2 - 0.5, 2.18, 1.0, b.accent)
  s.addText(slide.title, {
    x: M, y: 2.38, w: W - 2 * M, h: 2.2,
    fontSize: 42, bold: true, color: strip(b.primary),
    fontFace: b.titleFont, align: 'center', valign: 'middle',
  })

  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: M, y: 4.65, w: W - 2 * M, h: 0.5,
      fontSize: 16, color: strip(b.muted), fontFace: b.bodyFont, align: 'center',
    })
  }

  addDots(s, W / 2 - 0.33, 5.26, 5, b.accent, 0.09, 0.08)
  addFooter(s, deck.title, deck.client_name ?? '', b, false)
}

// ── Campaign — main idea slide ────────────────────────────────────────────────

function renderCampaignMain(s: Slide, slide: DeckSlide, b: DeckBranding, deck: DeckDocument) {
  s.background = { color: strip(b.surface) }
  addLeftBar(s, b.accent)

  const cX = M + 0.18
  const cW = W * 0.62 - M

  // Extract campaign number: "Campaign 01" → "01"
  const numMatch = slide.tag?.match(/\d+/)
  const num = numMatch ? numMatch[0].padStart(2, '0') : ''

  if (slide.tag && slide.tag !== 'why') {
    s.addText(slide.tag.toUpperCase(), {
      x: cX, y: M, w: 3, h: 0.34,
      fontSize: 9, bold: true, color: strip(b.accent),
      fontFace: b.bodyFont, charSpacing: 1.5,
    })
  }

  const tLen = slide.title.length
  const tSize = tLen > 34 ? 26 : tLen > 22 ? 32 : 38
  addSmartText(s, slide.title, {
    x: cX, y: M + 0.4, w: cW, h: 1.05,
    fontSize: tSize, bold: true, color: strip(b.primary),
    fontFace: b.titleFont, lineSpacingMultiple: 1.05,
  })

  if (slide.subtitle) {
    addSmartText(s, slide.subtitle, {
      x: cX, y: M + 1.55, w: cW, h: 0.52,
      fontSize: 17, italic: true, color: strip(b.accent), fontFace: b.titleFont,
    })
  }

  const hRuleY = slide.subtitle ? M + 2.15 : M + 1.58
  addHRule(s, cX, hRuleY, 0.44, b.accent)

  if (slide.body) {
    const bodyY = hRuleY + 0.18
    addSmartText(s, slide.body, {
      x: cX, y: bodyY, w: cW, h: H - bodyY - 0.55,
      fontSize: 13, color: strip(b.body), fontFace: b.bodyFont,
      lineSpacingMultiple: 1.5, valign: 'top',
    })
  }

  // Right decorative: number ring
  if (num) {
    const rLeft = W * 0.7
    const rTop = 0.88
    const rD = 2.65

    addEllipse(s, rLeft, rTop, rD, rD, darkenHex(b.surface, 3))
    addEllipseBorder(s, rLeft, rTop, rD, rD, b.accent, 2.5)

    s.addText(num, {
      x: rLeft, y: rTop, w: rD, h: rD,
      fontSize: 72, bold: true, color: strip(b.accent),
      fontFace: b.titleFont, align: 'center', valign: 'middle',
    })

    // Small accent dots below ring
    addDots(s, rLeft + rD * 0.2, rTop + rD * 0.86, 3, b.accent, 0.07, 0.07)

    // Ghost watermark number
    s.addText(num, {
      x: W * 0.77, y: H * 0.57, w: 2.2, h: 1.6,
      fontSize: 95, bold: true, color: darkenHex(b.surface, 5),
      fontFace: b.titleFont, align: 'right',
    })
  }

  addFooter(s, deck.title, deck.client_name ?? '', b, false)
}

// ── Campaign — TOV / Why It Works ─────────────────────────────────────────────

function renderCampaignWhy(s: Slide, slide: DeckSlide, b: DeckBranding, deck: DeckDocument) {
  s.background = { color: strip(b.surface) }
  addLeftBar(s, b.accent)

  const cX = M + 0.18

  s.addText(slide.title, {
    x: cX, y: M, w: W - cX - M, h: 0.5,
    fontSize: 18, bold: true, color: strip(b.primary), fontFace: b.titleFont,
  })
  addHRule(s, cX, M + 0.6, 0.42, b.accent)

  const contentTop = M + 0.82
  const contentH = H - contentTop - 0.52
  const colW = (W - cX - M - 0.4) / 2
  const lx = cX
  const rx = cX + colW + 0.4

  // TOV column
  addRect(s, lx, contentTop, 0.05, 0.26, b.accent)
  s.addText('TONE OF VOICE', {
    x: lx + 0.14, y: contentTop - 0.02, w: colW - 0.14, h: 0.3,
    fontSize: 9, bold: true, color: strip(b.accent), fontFace: b.bodyFont, charSpacing: 1.5,
  })

  const tovLines = (slide.bullets ?? [])
    .filter(bl => bl.startsWith('TOV:'))
    .map(bl => bl.replace(/^TOV:\s*/, ''))

  let ty = contentTop + 0.36
  for (const line of tovLines.slice(0, 4)) {
    addCard(s, lx, ty, colW, 0.64, darkenHex(b.surface, 2), b.accent)
    addRect(s, lx, ty, 0.045, 0.64, b.accent)
    addSmartText(s, line, {
      x: lx + 0.16, y: ty + 0.07, w: colW - 0.24, h: 0.5,
      fontSize: 12, italic: true, color: strip(b.body), fontFace: b.bodyFont, valign: 'middle',
    })
    ty += 0.76
  }

  // Vertical column divider
  addRect(s, lx + colW + 0.18, contentTop, 0.008, contentH, b.muted, 62)

  // WHY column
  addRect(s, rx, contentTop, 0.05, 0.26, b.accent)
  s.addText('WHY IT WORKS', {
    x: rx + 0.14, y: contentTop - 0.02, w: colW - 0.14, h: 0.3,
    fontSize: 9, bold: true, color: strip(b.accent), fontFace: b.bodyFont, charSpacing: 1.5,
  })

  const whyLines = (slide.bullets ?? [])
    .filter(bl => bl.startsWith('WHY:'))
    .map(bl => bl.replace(/^WHY:\s*/, ''))

  let wy = contentTop + 0.36
  for (const line of whyLines.slice(0, 4)) {
    addCard(s, rx, wy, colW, 0.64, darkenHex(b.surface, 2), b.accent)
    addRect(s, rx, wy, 0.045, 0.64, b.accent)
    addSmartText(s, line, {
      x: rx + 0.16, y: wy + 0.07, w: colW - 0.24, h: 0.5,
      fontSize: 12, color: strip(b.body), fontFace: b.bodyFont, valign: 'middle',
    })
    wy += 0.76
  }

  addFooter(s, deck.title, deck.client_name ?? '', b, false)
}

// ── Pillar slide ──────────────────────────────────────────────────────────────

function renderPillar(s: Slide, slide: DeckSlide, b: DeckBranding, deck: DeckDocument) {
  s.background = { color: strip(b.surface) }
  addLeftBar(s, b.accent)

  const cX = M + 0.18
  const cW = W - cX - M

  if (slide.tag) {
    s.addText(slide.tag.toUpperCase(), {
      x: cX, y: M, w: 3.5, h: 0.3,
      fontSize: 9, bold: true, color: strip(b.accent), fontFace: b.bodyFont, charSpacing: 1.5,
    })
  }

  const titleY = slide.tag ? M + 0.34 : M
  s.addText(slide.title, {
    x: cX, y: titleY, w: cW * 0.72, h: 0.65,
    fontSize: 24, bold: true, color: strip(b.primary), fontFace: b.titleFont,
  })

  let cy = titleY + 0.72
  if (slide.body) {
    s.addText(slide.body, {
      x: cX, y: cy, w: cW * 0.75, h: 0.95,
      fontSize: 13, color: strip(b.muted), fontFace: b.bodyFont,
      lineSpacingMultiple: 1.4, valign: 'top',
    })
    addHRule(s, cX, cy + 1.0, 0.38, b.accent)
    cy += 1.18
  } else {
    addHRule(s, cX, cy, 0.38, b.accent)
    cy += 0.22
  }

  for (const bullet of (slide.bullets ?? []).slice(0, 5)) {
    addCard(s, cX, cy, cW, 0.6, darkenHex(b.surface, 2), b.accent)
    addEllipse(s, cX + 0.18, cy + 0.21, 0.17, 0.17, b.accent)
    addSmartText(s, bullet, {
      x: cX + 0.48, y: cy + 0.08, w: cW - 0.56, h: 0.44,
      fontSize: 13, color: strip(b.body), fontFace: b.bodyFont, valign: 'middle',
    })
    cy += 0.72
  }

  addFooter(s, deck.title, deck.client_name ?? '', b, false)
}

// ── Metrics / KPI slide ───────────────────────────────────────────────────────

function renderMetrics(s: Slide, slide: DeckSlide, b: DeckBranding, deck: DeckDocument) {
  s.background = { color: strip(b.background) }
  const bgDark = isDark(b.background)
  const titleColor = bgDark ? b.surface : b.primary

  // Decorative bg circle (right side)
  const bgLt = lightenHex(b.background, bgDark ? 10 : -4)
  addEllipse(s, W * 0.72, H * 0.5 - H / 2, H, H, bgLt)

  s.addText(slide.title, {
    x: M, y: M, w: W - 2 * M, h: 0.65,
    fontSize: 26, bold: true, color: strip(titleColor),
    fontFace: b.titleFont, align: 'center',
  })

  if (slide.body) {
    s.addText(slide.body, {
      x: M, y: M + 0.72, w: W - 2 * M, h: 0.44,
      fontSize: 13, color: bgDark ? lightenHex(b.background, 50) : strip(b.muted),
      fontFace: b.bodyFont, align: 'center',
    })
  }

  const bullets = slide.bullets ?? []
  if (bullets.length === 0) {
    addFooter(s, deck.title, deck.client_name ?? '', b, true)
    return
  }

  const cols = Math.min(bullets.length, 3)
  const cardW = (W - 2 * M - (cols - 1) * 0.3) / cols
  const cardY = slide.body ? M + 1.28 : M + 0.88
  const cardH = bullets.length > 3 ? 1.35 : 1.75

  for (let i = 0; i < bullets.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx = M + col * (cardW + 0.3)
    const cy = cardY + row * (cardH + 0.2)
    addCard(s, cx, cy, cardW, cardH, bgDark ? darkenHex(b.background, 5) : darkenHex(b.surface, 3), b.accent)
    s.addText(bullets[i], {
      x: cx + 0.12, y: cy + 0.12, w: cardW - 0.24, h: cardH - 0.24,
      fontSize: bullets.length <= 3 ? 18 : 15, bold: true, color: strip(b.accent),
      fontFace: b.bodyFont, align: 'center', valign: 'middle', lineSpacingMultiple: 1.3,
    })
  }

  addFooter(s, deck.title, deck.client_name ?? '', b, true)
}

// ── CTA / closing slide ───────────────────────────────────────────────────────

function renderCta(s: Slide, slide: DeckSlide, b: DeckBranding, deck: DeckDocument) {
  s.background = { color: strip(b.background) }
  const bgDark = isDark(b.background)
  const titleColor = bgDark ? b.surface : b.primary

  // Decorative circles (top-right)
  const bgLt = lightenHex(b.background, bgDark ? 11 : -5)
  const cR = H * 0.95
  addEllipse(s, W * 0.78 - cR / 2, H * 0.1 - cR / 2, cR, cR, bgLt)
  addCrescent(s, W * 0.8, H * 0.2, H * 0.52, b.accent, bgLt)
  addDots(s, M + 1.7, H * 0.5, 5, b.accent, 0.09, 0.09)

  s.addText(slide.title, {
    x: M, y: 0.85, w: W * 0.72, h: 1.2,
    fontSize: 34, bold: true, color: strip(titleColor),
    fontFace: b.titleFont, lineSpacingMultiple: 1.1,
  })

  if (slide.body) {
    s.addText(slide.body, {
      x: M, y: 2.15, w: W * 0.65, h: 0.52,
      fontSize: 15, italic: true, color: strip(b.accent), fontFace: b.titleFont,
    })
  }

  addHRule(s, M, slide.body ? 2.76 : 2.18, 0.44, b.accent)

  let cy = slide.body ? 2.96 : 2.38
  const cardFill = bgDark ? darkenHex(b.background, 6) : darkenHex(b.surface, 3)
  for (const bullet of (slide.bullets ?? []).slice(0, 4)) {
    addCard(s, M, cy, W * 0.64, 0.64, cardFill, b.accent)
    addEllipse(s, M + 0.19, cy + 0.23, 0.18, 0.18, b.accent)
    addSmartText(s, bullet, {
      x: M + 0.5, y: cy + 0.08, w: W * 0.57, h: 0.48,
      fontSize: 14, color: strip(b.accent), fontFace: b.bodyFont, valign: 'middle',
    })
    cy += 0.76
  }

  addFooter(s, deck.title, deck.client_name ?? '', b, true)
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

function renderSlide(s: Slide, slide: DeckSlide, b: DeckBranding, deck: DeckDocument): void {
  switch (slide.type) {
    case 'cover':             renderCover(s, slide, b, deck);             break
    case 'executive_summary': renderExecutiveSummary(s, slide, b, deck); break
    case 'section_header':    renderSectionHeader(s, slide, b, deck);    break
    case 'campaign':
      slide.tag === 'why'
        ? renderCampaignWhy(s, slide, b, deck)
        : renderCampaignMain(s, slide, b, deck)
      break
    case 'pillar':   renderPillar(s, slide, b, deck);  break
    case 'metrics':  renderMetrics(s, slide, b, deck); break
    case 'cta':      renderCta(s, slide, b, deck);     break
    default:
      s.background = { color: strip(b.surface) }
      s.addText(slide.title, {
        x: M, y: 3.0, w: W - 2 * M, h: 1.0,
        fontSize: 24, bold: true, color: strip(b.primary),
        fontFace: b.titleFont, align: 'center',
      })
  }
  if (slide.note) s.addNotes(slide.note)
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function buildDeckPptx(deck: DeckDocument): Promise<Buffer> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  const b = deck.branding

  console.log('[buildDeckPptx] branding:', {
    background: b.background, surface: b.surface,
    accent: b.accent, titleFont: b.titleFont,
  })

  for (let i = 0; i < deck.slides.length; i++) {
    const slide = deck.slides[i]
    console.log(`[buildDeckPptx] slide ${i + 1}/${deck.slides.length}: type=${slide.type}, tag=${slide.tag ?? '—'}`)
    renderSlide(pptx.addSlide(), slide, b, deck)
  }

  const raw = await pptx.write({ outputType: 'nodebuffer' })
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer)
}
