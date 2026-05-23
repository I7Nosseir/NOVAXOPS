// Client-side only — called from a 'use client' component
// pptxgenjs runs in the browser and triggers a file download via writeFile()

type StrategyMetaData = Partial<Record<
  'intelligence' | 'positioning' | 'execution' | 'scale' | 'optimize',
  Record<string, unknown>
>>

// ── Helpers ───────────────────────────────────────────────────────────────────

function hex(color: string) {
  return color.replace('#', '')
}

function str(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  return String(v)
}

function arr(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(str).filter(Boolean)
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const DARK_BG    = '0E1A17'
const LIGHT_BG   = 'F6F4F0'
const TEXT_DARK  = '1A1A1A'
const TEXT_MED   = '5A5A5A'
const TEXT_LIGHT = 'FFFFFF'
const BORDER     = 'CCCCCC'
const WARM_BROWN = '8F6D4F'

// ── Shared slide frame ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function frame(slide: any, pptx: any, label: string, dark = false) {
  slide.background = { color: dark ? DARK_BG : LIGHT_BG }
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.3, y: 0.15, w: 12.73, h: 7.15,
    fill: { type: 'none' },
    line: { color: dark ? '2A2A2A' : BORDER, width: 0.5 },
  })
  if (label) {
    slide.addText(label, {
      x: 0.5, y: 0.22, w: 7, h: 0.25,
      fontSize: 7.5, color: dark ? '666666' : '999999',
      bold: true, fontFace: 'Helvetica Neue',
    })
  }
}

// ── Callout box (coloured background with bullet list) ────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function callout(slide: any, pptx: any, title: string, items: string[], x: number, y: number, w: number, h: number, bg = WARM_BROWN) {
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w, h, fill: { color: bg }, line: { type: 'none' },
  })
  slide.addText(title, {
    x: x + 0.2, y: y + 0.15, w: w - 0.4, h: 0.28,
    fontSize: 8, color: TEXT_LIGHT, bold: true, fontFace: 'Helvetica Neue',
  })
  if (items.length) {
    slide.addText(items.map(i => `·  ${i}`).join('\n'), {
      x: x + 0.2, y: y + 0.46, w: w - 0.4, h: h - 0.56,
      fontSize: 9, color: TEXT_LIGHT, fontFace: 'Helvetica Neue',
      valign: 'top', wrap: true,
    })
  }
}

// ── Divider line ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function divider(slide: any, pptx: any, x: number, y: number, w = 0, h = 5.5) {
  slide.addShape(pptx.ShapeType.line, {
    x, y, w, h, line: { color: BORDER, width: 0.5 },
  })
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function exportStrategyPptx(
  clientName: string,
  clientColor: string | undefined,
  metaData: StrategyMetaData,
) {
  const { default: PptxGenJS } = await import('pptxgenjs')

  const pptx = new PptxGenJS()
  pptx.layout  = 'LAYOUT_WIDE'   // 13.33 × 7.5 inches
  pptx.title   = `${clientName} — Social Media Strategy`
  pptx.author  = 'NOVAX'
  pptx.company = 'NOVAX Agency'

  const brand = hex(clientColor ?? '#1B3D38')

  const intel = metaData.intelligence
  const pos   = metaData.positioning
  const exec  = metaData.execution
  const scale = metaData.scale
  const opt   = metaData.optimize

  // ── SLIDE 1: Cover ──────────────────────────────────────────────────────────
  {
    const s = pptx.addSlide()
    s.background = { color: DARK_BG }

    s.addShape(pptx.ShapeType.rect, {
      x: 0.3, y: 0.15, w: 12.73, h: 7.15,
      fill: { type: 'none' },
      line: { color: '2A2A2A', width: 0.5 },
    })
    // Brand colour left bar
    s.addShape(pptx.ShapeType.rect, {
      x: 0.3, y: 0.15, w: 0.07, h: 7.15,
      fill: { color: brand }, line: { type: 'none' },
    })

    s.addText('SOCIAL MEDIA STRATEGY', {
      x: 1, y: 2.85, w: 11.33, h: 0.45,
      fontSize: 14, color: '888888', align: 'center',
      fontFace: 'Helvetica Neue', charSpacing: 3,
    })
    s.addText(clientName, {
      x: 1, y: 1.35, w: 11.33, h: 1.3,
      fontSize: 52, color: TEXT_LIGHT, bold: false,
      fontFace: 'Helvetica Neue', align: 'center',
    })
    s.addText(str(pos?.uvp) || 'Powered by NOVAX', {
      x: 1.5, y: 3.4, w: 10.33, h: 0.65,
      fontSize: 13, color: WARM_BROWN, align: 'center',
      fontFace: 'Helvetica Neue', italic: true, wrap: true,
    })
    s.addText('Prepared by NOVAX', {
      x: 1, y: 6.8, w: 11.33, h: 0.3,
      fontSize: 8.5, color: '444444', align: 'center', fontFace: 'Helvetica Neue',
    })
  }

  // ── SLIDE 2: Market Intelligence ────────────────────────────────────────────
  if (intel) {
    const s = pptx.addSlide()
    frame(s, pptx, 'INTELLIGENCE')

    s.addText('Market Position', {
      x: 0.5, y: 0.65, w: 5.8, h: 0.45,
      fontSize: 24, color: TEXT_DARK, bold: true, fontFace: 'Helvetica Neue',
    })
    s.addText(str(intel.market_position), {
      x: 0.5, y: 1.15, w: 5.8, h: 1.3,
      fontSize: 10.5, color: TEXT_MED, fontFace: 'Helvetica Neue', valign: 'top', wrap: true,
    })
    s.addText('SWOT SUMMARY', {
      x: 0.5, y: 2.6, w: 5.8, h: 0.25,
      fontSize: 7.5, color: '999999', bold: true, fontFace: 'Helvetica Neue', charSpacing: 1.5,
    })
    divider(s, pptx, 0.5, 2.88, 5.8, 0)
    s.addText(str(intel.swot_summary), {
      x: 0.5, y: 2.95, w: 5.8, h: 1.4,
      fontSize: 10.5, color: TEXT_MED, fontFace: 'Helvetica Neue', valign: 'top', wrap: true, italic: true,
    })
    // Strategic priority box
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 4.5, w: 5.8, h: 1.4,
      fill: { color: brand }, line: { type: 'none' },
    })
    s.addText('STRATEGIC PRIORITY', {
      x: 0.7, y: 4.6, w: 5.4, h: 0.25,
      fontSize: 7.5, color: 'AACCCC', bold: true, fontFace: 'Helvetica Neue', charSpacing: 1,
    })
    s.addText(str(intel.strategic_priority), {
      x: 0.7, y: 4.88, w: 5.4, h: 0.9,
      fontSize: 11, color: TEXT_LIGHT, fontFace: 'Helvetica Neue', valign: 'top', wrap: true,
    })

    divider(s, pptx, 6.95, 0.65, 0, 6.15)
    callout(s, pptx, 'Strengths',     arr(intel.strengths).slice(0, 4),    7.15, 0.65, 5.55, 2.8,  WARM_BROWN)
    callout(s, pptx, 'Opportunities', arr(intel.opportunities).slice(0, 3), 7.15, 3.6,  5.55, 2.4,  '4A7A6E')
  }

  // ── SLIDE 3: Audience Profile ───────────────────────────────────────────────
  if (intel?.primary_audience) {
    const aud = intel.primary_audience as Record<string, unknown>
    const s   = pptx.addSlide()
    frame(s, pptx, 'INTELLIGENCE — Audience Profile')

    s.addText('Primary Audience', {
      x: 0.5, y: 0.65, w: 12, h: 0.5,
      fontSize: 26, color: TEXT_DARK, bold: true, fontFace: 'Helvetica Neue',
    })

    const cols = [
      { title: 'DEMOGRAPHICS',  body: str(aud.demographics)  },
      { title: 'PSYCHOGRAPHICS', body: str(aud.psychographics) },
      { title: 'PAIN POINTS',   body: arr(aud.pain_points).map(p => `·  ${p}`).join('\n') },
    ]
    cols.forEach(({ title, body }, i) => {
      const x  = 0.5 + i * 4.28
      const cx = x + (i > 0 ? 0.12 : 0)
      if (i > 0) divider(s, pptx, x - 0.14, 1.35, 0, 5.6)
      s.addText(title, {
        x: cx, y: 1.35, w: 3.9, h: 0.28,
        fontSize: 7.5, color: '999999', bold: true, fontFace: 'Helvetica Neue', charSpacing: 1.5,
      })
      divider(s, pptx, cx, 1.65, 3.9, 0)
      s.addText(body, {
        x: cx, y: 1.75, w: 3.9, h: 4.7,
        fontSize: 10.5, color: TEXT_MED, fontFace: 'Helvetica Neue', valign: 'top', wrap: true,
      })
    })

    const triggers = arr(aud.buying_triggers)
    if (triggers.length) {
      callout(s, pptx, 'Buying Triggers', triggers.slice(0, 4), 0.5, 6.3, 12.3, 0.88, brand)
    }
  }

  // ── SLIDE 4: Brand Positioning ──────────────────────────────────────────────
  if (pos) {
    const s = pptx.addSlide()
    frame(s, pptx, 'POSITIONING')

    s.addText('BRAND ARCHETYPE', {
      x: 0.5, y: 0.65, w: 5.8, h: 0.25,
      fontSize: 7.5, color: '999999', bold: true, fontFace: 'Helvetica Neue', charSpacing: 1.5,
    })
    s.addText(str(pos.brand_archetype), {
      x: 0.5, y: 0.93, w: 5.8, h: 0.75,
      fontSize: 30, color: TEXT_DARK, bold: true, fontFace: 'Helvetica Neue',
    })
    s.addText(str(pos.archetype_narrative), {
      x: 0.5, y: 1.72, w: 5.8, h: 1.9,
      fontSize: 10.5, color: TEXT_MED, fontFace: 'Helvetica Neue', valign: 'top', wrap: true,
    })
    // UVP box
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 3.75, w: 5.8, h: 1.9,
      fill: { color: brand }, line: { type: 'none' },
    })
    s.addText('UNIQUE VALUE PROPOSITION', {
      x: 0.7, y: 3.85, w: 5.4, h: 0.25,
      fontSize: 7.5, color: 'AACCCC', bold: true, fontFace: 'Helvetica Neue', charSpacing: 1,
    })
    s.addText(str(pos.uvp), {
      x: 0.7, y: 4.13, w: 5.4, h: 1.4,
      fontSize: 13, color: TEXT_LIGHT, fontFace: 'Helvetica Neue', valign: 'top', wrap: true,
    })

    divider(s, pptx, 6.95, 0.65, 0, 6.15)

    s.addText('POSITIONING STATEMENT', {
      x: 7.15, y: 0.65, w: 5.55, h: 0.25,
      fontSize: 7.5, color: '999999', bold: true, fontFace: 'Helvetica Neue', charSpacing: 1.5,
    })
    divider(s, pptx, 7.15, 0.93, 5.55, 0)
    s.addText(str(pos.positioning_statement), {
      x: 7.15, y: 1.02, w: 5.55, h: 2.0,
      fontSize: 11.5, color: TEXT_MED, fontFace: 'Helvetica Neue', valign: 'top', wrap: true, italic: true,
    })

    const msg = pos.messaging_hierarchy as Record<string, unknown> | undefined
    if (msg) {
      s.addText('PRIMARY MESSAGE', {
        x: 7.15, y: 3.2, w: 5.55, h: 0.25,
        fontSize: 7.5, color: '999999', bold: true, fontFace: 'Helvetica Neue', charSpacing: 1.5,
      })
      divider(s, pptx, 7.15, 3.48, 5.55, 0)
      s.addText(str(msg.primary_message), {
        x: 7.15, y: 3.57, w: 5.55, h: 0.85,
        fontSize: 12, color: TEXT_DARK, bold: true, fontFace: 'Helvetica Neue', valign: 'top', wrap: true,
      })
      const secondary = arr(msg.secondary_messages)
      if (secondary.length) {
        s.addText(secondary.map(m => `·  ${m}`).join('\n'), {
          x: 7.15, y: 4.55, w: 5.55, h: 2.1,
          fontSize: 10, color: TEXT_MED, fontFace: 'Helvetica Neue', valign: 'top', wrap: true,
        })
      }
    }
  }

  // ── SLIDE 5: Content Pillars ────────────────────────────────────────────────
  if (exec?.content_pillars) {
    type Pillar = { name: string; description: string; posting_frequency: string; example_topics: string[] }
    const pillars = (exec.content_pillars as Pillar[]).slice(0, 5)
    const s = pptx.addSlide()
    frame(s, pptx, 'CONTENT STRATEGY — Pillars')

    s.addText('Content Pillars', {
      x: 0.5, y: 0.65, w: 9, h: 0.5,
      fontSize: 24, color: TEXT_DARK, bold: true, fontFace: 'Helvetica Neue',
    })
    s.addText('Each pillar serves a distinct audience need. Products appear as part of life, not advertisements.', {
      x: 0.5, y: 1.15, w: 12, h: 0.3,
      fontSize: 9.5, color: TEXT_MED, fontFace: 'Helvetica Neue', italic: true,
    })

    pillars.forEach((pillar, i) => {
      const x = 0.4 + i * 2.52
      const w = 2.34

      s.addShape(pptx.ShapeType.rect, {
        x, y: 1.6, w, h: 5.35,
        fill: { color: i % 2 === 1 ? 'EEECEA' : 'FFFFFF' },
        line: { color: BORDER, width: 0.5 },
      })
      // Top accent bar
      s.addShape(pptx.ShapeType.rect, {
        x, y: 1.6, w, h: 0.07,
        fill: { color: i === 0 ? brand : WARM_BROWN },
        line: { type: 'none' },
      })
      s.addText(pillar.name || '', {
        x: x + 0.15, y: 1.74, w: w - 0.3, h: 0.5,
        fontSize: 11, color: TEXT_DARK, bold: true, fontFace: 'Helvetica Neue', wrap: true,
      })
      s.addText(pillar.posting_frequency || '', {
        x: x + 0.15, y: 2.26, w: w - 0.3, h: 0.28,
        fontSize: 8, color: WARM_BROWN, fontFace: 'Helvetica Neue',
      })
      s.addText(pillar.description || '', {
        x: x + 0.15, y: 2.57, w: w - 0.3, h: 1.6,
        fontSize: 9, color: TEXT_MED, fontFace: 'Helvetica Neue', valign: 'top', wrap: true,
      })
      const topics = (pillar.example_topics ?? []).slice(0, 3)
      if (topics.length) {
        s.addText('EXAMPLE TOPICS', {
          x: x + 0.15, y: 4.25, w: w - 0.3, h: 0.25,
          fontSize: 7, color: '999999', bold: true, fontFace: 'Helvetica Neue', charSpacing: 1,
        })
        s.addText(topics.map(t => `·  ${t}`).join('\n'), {
          x: x + 0.15, y: 4.53, w: w - 0.3, h: 1.4,
          fontSize: 8.5, color: TEXT_MED, fontFace: 'Helvetica Neue', valign: 'top', wrap: true,
        })
      }
    })
  }

  // ── SLIDE 6: Platform Strategy ──────────────────────────────────────────────
  if (exec?.platform_strategy) {
    const plat  = exec.platform_strategy as Record<string, unknown>
    const notes = plat.platform_notes    as Record<string, string> | undefined
    const mix   = exec.content_mix       as Record<string, number> | undefined
    const s     = pptx.addSlide()
    frame(s, pptx, 'CONTENT STRATEGY — Platforms')

    s.addText('Platform Strategy', {
      x: 0.5, y: 0.65, w: 10, h: 0.5,
      fontSize: 24, color: TEXT_DARK, bold: true, fontFace: 'Helvetica Neue',
    })
    // Primary platform bar
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.28, w: 12.28, h: 0.9,
      fill: { color: brand }, line: { type: 'none' },
    })
    s.addText('PRIMARY PLATFORM', {
      x: 0.72, y: 1.35, w: 3, h: 0.25,
      fontSize: 7.5, color: 'AACCCC', bold: true, fontFace: 'Helvetica Neue',
    })
    s.addText(str(plat.primary_platform), {
      x: 0.72, y: 1.6, w: 11.5, h: 0.48,
      fontSize: 11, color: TEXT_LIGHT, fontFace: 'Helvetica Neue', valign: 'top', wrap: true,
    })

    if (notes) {
      Object.entries(notes).slice(0, 6).forEach(([platform, note], i) => {
        const col = i % 2
        const row = Math.floor(i / 2)
        const x   = 0.5 + col * 5.4
        const y   = 2.38 + row * 1.75

        s.addShape(pptx.ShapeType.rect, {
          x, y, w: 5.15, h: 1.58,
          fill: { color: 'FFFFFF' }, line: { color: BORDER, width: 0.5 },
        })
        s.addText(platform, {
          x: x + 0.2, y: y + 0.15, w: 4.7, h: 0.32,
          fontSize: 11, color: TEXT_DARK, bold: true, fontFace: 'Helvetica Neue',
        })
        s.addText(note, {
          x: x + 0.2, y: y + 0.5, w: 4.7, h: 0.98,
          fontSize: 9.5, color: TEXT_MED, fontFace: 'Helvetica Neue', valign: 'top', wrap: true,
        })
      })
    }

    // Content mix — right side
    if (mix) {
      divider(s, pptx, 11.2, 2.35, 0, 4.5)
      s.addText('CONTENT MIX', {
        x: 11.38, y: 2.35, w: 1.6, h: 0.28,
        fontSize: 7.5, color: '999999', bold: true, fontFace: 'Helvetica Neue', charSpacing: 1,
      })
      Object.entries(mix).forEach(([type, pct], i) => {
        const y = 2.78 + i * 0.72
        s.addText(type, {
          x: 11.38, y: y + 0.04, w: 1.5, h: 0.28,
          fontSize: 9, color: TEXT_MED, fontFace: 'Helvetica Neue',
        })
        s.addShape(pptx.ShapeType.rect, {
          x: 11.38, y: y + 0.34, w: 1.5, h: 0.14,
          fill: { color: 'E0E0E0' }, line: { type: 'none' },
        })
        s.addShape(pptx.ShapeType.rect, {
          x: 11.38, y: y + 0.34, w: (pct / 100) * 1.5, h: 0.14,
          fill: { color: brand }, line: { type: 'none' },
        })
        s.addText(`${pct}%`, {
          x: 12.9, y: y + 0.04, w: 0.48, h: 0.28,
          fontSize: 8.5, color: TEXT_DARK, bold: true, fontFace: 'Helvetica Neue',
        })
      })
    }

    const seasonal = arr(exec?.seasonal_moments)
    if (seasonal.length) {
      callout(s, pptx, 'Key Seasonal Moments', seasonal.slice(0, 3), 0.5, 6.25, 10.55, 0.9, WARM_BROWN)
    }
  }

  // ── SLIDE 7: Scale & Community ──────────────────────────────────────────────
  if (scale) {
    const s    = pptx.addSlide()
    const comm = scale.community_architecture as Record<string, unknown> | undefined
    const paid = scale.paid_strategy          as Record<string, unknown> | undefined
    frame(s, pptx, 'SCALE & COMMUNITY')

    s.addText('Growth & Community Architecture', {
      x: 0.5, y: 0.65, w: 12, h: 0.5,
      fontSize: 22, color: TEXT_DARK, bold: true, fontFace: 'Helvetica Neue',
    })

    if (comm) {
      s.addText('COMMUNITY ARCHITECTURE', {
        x: 0.5, y: 1.35, w: 5.8, h: 0.25,
        fontSize: 7.5, color: '999999', bold: true, fontFace: 'Helvetica Neue', charSpacing: 1.5,
      })
      divider(s, pptx, 0.5, 1.63, 5.8, 0)
      s.addText(str(comm.loyalty_mechanism), {
        x: 0.5, y: 1.72, w: 5.8, h: 1.05,
        fontSize: 10.5, color: TEXT_MED, fontFace: 'Helvetica Neue', valign: 'top', wrap: true,
      })
      callout(s, pptx, 'Participation Loops', arr(comm.participation_loops).slice(0, 3), 0.5, 2.9, 5.8, 1.85, WARM_BROWN)
      s.addText(str(comm.ugc_strategy), {
        x: 0.5, y: 4.9, w: 5.8, h: 1.6,
        fontSize: 10, color: TEXT_MED, fontFace: 'Helvetica Neue', valign: 'top', wrap: true,
      })
    }

    divider(s, pptx, 6.95, 1.35, 0, 5.15)

    if (paid) {
      s.addText('PAID MEDIA STRATEGY', {
        x: 7.15, y: 1.35, w: 5.55, h: 0.25,
        fontSize: 7.5, color: '999999', bold: true, fontFace: 'Helvetica Neue', charSpacing: 1.5,
      })
      divider(s, pptx, 7.15, 1.63, 5.55, 0)
      s.addText(str(paid.creative_brief), {
        x: 7.15, y: 1.72, w: 5.55, h: 1.05,
        fontSize: 10.5, color: TEXT_MED, fontFace: 'Helvetica Neue', valign: 'top', wrap: true,
      })

      const budget = paid.recommended_budget_split as Record<string, number> | undefined
      if (budget) {
        s.addText('BUDGET SPLIT', {
          x: 7.15, y: 2.9, w: 5.55, h: 0.25,
          fontSize: 7.5, color: '999999', bold: true, fontFace: 'Helvetica Neue', charSpacing: 1,
        })
        Object.entries(budget).forEach(([type, pct], i) => {
          const y = 3.25 + i * 0.62
          s.addText(type, {
            x: 7.15, y: y + 0.04, w: 2.2, h: 0.28,
            fontSize: 9.5, color: TEXT_MED, fontFace: 'Helvetica Neue',
          })
          s.addShape(pptx.ShapeType.rect, {
            x: 9.5, y: y + 0.1, w: 2.8, h: 0.14,
            fill: { color: 'E0E0E0' }, line: { type: 'none' },
          })
          s.addShape(pptx.ShapeType.rect, {
            x: 9.5, y: y + 0.1, w: (pct / 100) * 2.8, h: 0.14,
            fill: { color: brand }, line: { type: 'none' },
          })
          s.addText(`${pct}%`, {
            x: 12.35, y: y + 0.04, w: 0.45, h: 0.28,
            fontSize: 9, color: TEXT_DARK, bold: true, fontFace: 'Helvetica Neue',
          })
        })
      }

      const kpis = arr(scale.kpis_to_track)
      if (kpis.length) {
        callout(s, pptx, 'KPIs to Track', kpis.slice(0, 4), 7.15, 5.35, 5.55, 1.15, '3E7060')
      }
    }
  }

  // ── SLIDE 8: Optimization Roadmap ───────────────────────────────────────────
  if (opt) {
    const s       = pptx.addSlide()
    const roadmap = opt.iteration_roadmap as Record<string, string> | undefined
    frame(s, pptx, 'OPTIMIZE')

    s.addText('Optimization & Iteration Roadmap', {
      x: 0.5, y: 0.65, w: 12, h: 0.5,
      fontSize: 22, color: TEXT_DARK, bold: true, fontFace: 'Helvetica Neue',
    })

    if (roadmap) {
      const periods = [
        { key: 'month_1_3',  label: 'Months 1–3',  color: brand      },
        { key: 'month_4_6',  label: 'Months 4–6',  color: WARM_BROWN },
        { key: 'month_7_12', label: 'Months 7–12', color: '6A6A6A'   },
      ]
      // Dashed connecting line
      s.addShape(pptx.ShapeType.line, {
        x: 0.82, y: 1.85, w: 8.5, h: 0,
        line: { color: BORDER, width: 0.75, dashType: 'dash' },
      })
      periods.forEach(({ key, label, color }, i) => {
        const x = 0.5 + i * 4.28
        s.addShape(pptx.ShapeType.ellipse, {
          x: x + 0.1, y: 1.5, w: 0.7, h: 0.7,
          fill: { color }, line: { type: 'none' },
        })
        s.addText(`${i + 1}`, {
          x: x + 0.1, y: 1.5, w: 0.7, h: 0.7,
          fontSize: 14, color: TEXT_LIGHT, bold: true, fontFace: 'Helvetica Neue',
          align: 'center', valign: 'middle',
        })
        s.addText(label, {
          x: x + 0.9, y: 1.58, w: 3.2, h: 0.38,
          fontSize: 11, color: TEXT_DARK, bold: true, fontFace: 'Helvetica Neue',
        })
        s.addText(str(roadmap[key]), {
          x: x + 0.1, y: 2.35, w: 4.0, h: 3.6,
          fontSize: 10, color: TEXT_MED, fontFace: 'Helvetica Neue', valign: 'top', wrap: true,
        })
      })
    }

    const benchmarks = opt.performance_benchmarks as Record<string, string> | undefined
    if (benchmarks) {
      s.addText('PERFORMANCE BENCHMARKS', {
        x: 0.5, y: 6.1, w: 12.3, h: 0.25,
        fontSize: 7.5, color: '999999', bold: true, fontFace: 'Helvetica Neue', charSpacing: 1.5,
      })
      Object.entries(benchmarks).slice(0, 4).forEach(([k, v], i) => {
        s.addText(`${k.replace(/_/g, ' ')}: ${v}`, {
          x: 0.5 + i * 3.1, y: 6.42, w: 3.0, h: 0.35,
          fontSize: 9.5, color: TEXT_MED, fontFace: 'Helvetica Neue',
        })
      })
    }
  }

  // ── SLIDE 9: Close ──────────────────────────────────────────────────────────
  {
    const s = pptx.addSlide()
    s.background = { color: DARK_BG }

    s.addShape(pptx.ShapeType.rect, {
      x: 0.3, y: 0.15, w: 12.73, h: 7.15,
      fill: { type: 'none' }, line: { color: '2A2A2A', width: 0.5 },
    })
    s.addShape(pptx.ShapeType.rect, {
      x: 0.3, y: 0.15, w: 0.07, h: 7.15,
      fill: { color: brand }, line: { type: 'none' },
    })
    s.addText('Strategy Ready.', {
      x: 1, y: 2.4, w: 11.33, h: 1.0,
      fontSize: 46, color: TEXT_LIGHT, bold: false,
      fontFace: 'Helvetica Neue', align: 'center',
    })
    s.addText('Time to Execute.', {
      x: 1, y: 3.5, w: 11.33, h: 0.65,
      fontSize: 18, color: WARM_BROWN,
      fontFace: 'Helvetica Neue', align: 'center',
    })
    s.addText(`Prepared for ${clientName} by NOVAX`, {
      x: 1, y: 6.75, w: 11.33, h: 0.3,
      fontSize: 8.5, color: '444444', align: 'center', fontFace: 'Helvetica Neue',
    })
  }

  // ── Download ──────────────────────────────────────────────────────────────────
  const safeName = clientName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
  await pptx.writeFile({ fileName: `${safeName}_Social_Media_Strategy.pptx` })
}
