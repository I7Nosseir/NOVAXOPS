/**
 * Deck Builder Design System
 * Central constants, typography scale, and accessibility utilities.
 * All spacing is in inches (PPTX coordinate system, LAYOUT_WIDE 13.33" × 7.5").
 */

// ── Slide dimensions ───────────────────────────────────────────────────────────
export const DECK = {
  W: 13.33,
  H: 7.5,
  M: 0.55,   // standard content margin
} as const

// ── Typography scale (font sizes in points) ────────────────────────────────────
export const TYPE = {
  COVER_TITLE:  { size: 54, lineH: 0.95 },
  SECTION:      { size: 42, lineH: 1.0  },
  SLIDE_TITLE:  { size: 38, lineH: 1.05 },
  SUBTITLE:     { size: 17, lineH: 1.3  },
  TAG:          { size: 9,  charSpacing: 1.5 },
  BODY:         { size: 13, lineH: 1.5  },
  BULLET:       { size: 13, lineH: 1.4  },
  METRIC_LG:   { size: 18, lineH: 1.3  },
  FOOTER:       { size: 8               },
  CAPTION:      { size: 11              },
} as const

// ── Spacing system (base unit = 0.5") ─────────────────────────────────────────
export const SP = {
  XS: 0.1,
  SM: 0.2,
  MD: 0.3,
  LG: 0.5,
  XL: 0.75,
  XXL: 1.0,
} as const

// ── Font rules ─────────────────────────────────────────────────────────────────

/** Only font guaranteed to shape Arabic correctly on all systems */
export const ARABIC_FONT = 'Arial'

/** Fonts guaranteed to be present on PPTX-viewing systems */
export const SAFE_FONTS = ['Calibri', 'Georgia', 'Times New Roman', 'Helvetica'] as const

/**
 * Map a PPTX-safe font name to a built-in @react-pdf/renderer font family.
 * react-pdf only has 3 built-in families: Helvetica, Times-Roman, Courier.
 */
export function toPdfFont(designFont: string): 'Helvetica' | 'Times-Roman' {
  if (designFont === 'Georgia' || designFont === 'Times New Roman') return 'Times-Roman'
  return 'Helvetica'
}

// ── Language detection ─────────────────────────────────────────────────────────

const ARABIC_RE = /[؀-ۿ]/

/** Returns true if the string contains any Arabic Unicode characters. */
export function containsArabic(text: string): boolean {
  return ARABIC_RE.test(text)
}

// ── WCAG contrast ratio ────────────────────────────────────────────────────────

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '')
  const [r, g, b] = [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ].map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Compute the WCAG 2.1 contrast ratio between two hex colors.
 * 4.5:1 = AA (body text), 3.0:1 = AA (large text), 7.0:1 = AAA.
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

/** Returns true if the pair meets WCAG AA for body text (≥ 4.5:1). */
export function passesWCAG(fg: string, bg: string): boolean {
  return contrastRatio(fg, bg) >= 4.5
}

/**
 * Validate all critical color pairs in a branding object.
 * Returns an array of warning strings (empty = all good).
 */
export function validateBrandingContrast(b: {
  background: string; surface: string; primary: string
  accent: string; body: string; muted: string
}): string[] {
  const pairs: [string, string, string][] = [
    [b.body,    b.surface,    'body text on surface'],
    [b.primary, b.surface,    'heading on surface'],
    [b.body,    b.background, 'body text on background'],
    [b.accent,  b.background, 'accent on background'],
    [b.accent,  b.surface,    'accent on surface'],
  ]
  return pairs
    .filter(([fg, bg]) => !passesWCAG(fg, bg))
    .map(([fg, bg, label]) => `Low contrast (${label}): ${contrastRatio(fg, bg).toFixed(1)}:1 < 4.5:1`)
}

// ── 60-30-10 color rule ────────────────────────────────────────────────────────

/**
 * Determines whether text placed ON this background color should be dark or light.
 * Uses perceived luminance (ITU BT.601).
 */
export function textOnColor(bgHex: string): 'dark' | 'light' {
  const h = bgHex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const bv = parseInt(h.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * bv > 128 ? 'dark' : 'light'
}
