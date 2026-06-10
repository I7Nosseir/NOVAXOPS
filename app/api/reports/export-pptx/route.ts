import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PptxGenJS = (require('pptxgenjs') as { default: typeof import('pptxgenjs').default }).default

const BRAND = {
  primary: '#1B3D38',
  accent:  '#5BB4AE',
  muted:   '#2A6B62',
  white:   '#FFFFFF',
  light:   '#EBF4F3',
  text:    '#1E293B',
  subtext: '#64748B',
}

interface KPI { label: string; value: string; change?: string }
interface Platform { name: string; reach: number; er: number }
interface ReportData {
  kpis?: KPI[]
  platforms?: Platform[]
  trend?: { period: string; value: number }[]
  client_name?: string
  report_type?: string
  period?: string
}

/**
 * POST /api/reports/export-pptx
 * Body: { text: string, data: ReportData, client_name: string, report_type: string }
 *
 * Generates a branded .pptx presentation from the AI report content.
 * Uses pptxgenjs (already installed).
 */
export async function POST(req: NextRequest) {
  let body: { text?: string; data?: ReportData; client_name?: string; report_type?: string; period?: string }
  try { body = await req.json() as typeof body } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { text = '', data = {}, client_name = 'Client', report_type = 'Performance Report', period = '' } = body

  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'NOVAX Ops'
  pptx.company = 'NOVAX'

  // ── Slide 1: Cover ─────────────────────────────────────────────────────────
  const cover = pptx.addSlide()
  cover.background = { color: BRAND.primary }
  cover.addText('NOVAX', { x: 0.6, y: 0.45, w: 3, h: 0.5, fontSize: 18, color: BRAND.accent, bold: true, fontFace: 'Calibri' })
  cover.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.0, w: 1.2, h: 0.04, fill: { color: BRAND.accent } })
  cover.addText(client_name, { x: 0.6, y: 1.4, w: 8, h: 1, fontSize: 40, color: BRAND.white, bold: true, fontFace: 'Calibri' })
  cover.addText(report_type, { x: 0.6, y: 2.6, w: 8, h: 0.6, fontSize: 22, color: BRAND.accent, fontFace: 'Calibri' })
  if (period) cover.addText(period, { x: 0.6, y: 3.4, w: 8, h: 0.4, fontSize: 14, color: '#9DCCC8', fontFace: 'Calibri' })
  cover.addText('Prepared by NOVAX Operations Platform', { x: 0.6, y: 4.8, w: 9, h: 0.3, fontSize: 10, color: '#9DCCC8', fontFace: 'Calibri' })

  // ── Slide 2: KPIs ──────────────────────────────────────────────────────────
  if (data.kpis && data.kpis.length > 0) {
    const kpiSlide = pptx.addSlide()
    kpiSlide.background = { color: BRAND.white }
    kpiSlide.addText('Key Metrics', { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, color: BRAND.primary, bold: true, fontFace: 'Calibri' })
    kpiSlide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 0.95, w: 9, h: 0.04, fill: { color: BRAND.accent } })

    const cols = Math.min(data.kpis.length, 4)
    const colW = 9 / cols
    data.kpis.slice(0, 4).forEach((kpi, i) => {
      const x = 0.5 + i * colW
      kpiSlide.addShape(pptx.ShapeType.rect, { x, y: 1.2, w: colW - 0.15, h: 1.8, fill: { color: BRAND.light }, line: { color: BRAND.accent, width: 1 } })
      kpiSlide.addText(kpi.value, { x, y: 1.5, w: colW - 0.15, h: 0.8, fontSize: 28, color: BRAND.primary, bold: true, align: 'center', fontFace: 'Calibri' })
      kpiSlide.addText(kpi.label, { x, y: 2.3, w: colW - 0.15, h: 0.4, fontSize: 11, color: BRAND.subtext, align: 'center', fontFace: 'Calibri' })
      if (kpi.change) kpiSlide.addText(kpi.change, { x, y: 2.7, w: colW - 0.15, h: 0.3, fontSize: 11, color: BRAND.muted, align: 'center', fontFace: 'Calibri' })
    })
  }

  // ── Slide 3: Platform Breakdown ────────────────────────────────────────────
  if (data.platforms && data.platforms.length > 0) {
    const platSlide = pptx.addSlide()
    platSlide.background = { color: BRAND.white }
    platSlide.addText('Platform Breakdown', { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, color: BRAND.primary, bold: true, fontFace: 'Calibri' })
    platSlide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 0.95, w: 9, h: 0.04, fill: { color: BRAND.accent } })

    const rows: [string, string, string][] = data.platforms.map(p => [
      p.name,
      (p.reach ?? 0).toLocaleString(),
      `${(p.er ?? 0).toFixed(1)}%`,
    ])
    platSlide.addTable(
      [
        [{ text: 'Platform', options: { bold: true, fill: { color: BRAND.primary }, color: BRAND.white } },
         { text: 'Reach',    options: { bold: true, fill: { color: BRAND.primary }, color: BRAND.white } },
         { text: 'Eng. Rate',options: { bold: true, fill: { color: BRAND.primary }, color: BRAND.white } }],
        ...rows.map((r, i) => r.map(cell => ({
          text: cell,
          options: { fill: { color: i % 2 === 0 ? '#F8FAFC' : BRAND.white }, color: BRAND.text },
        }))),
      ],
      { x: 0.5, y: 1.2, w: 9, h: 3, fontSize: 13, fontFace: 'Calibri', border: { type: 'solid', color: '#E2E8F0', pt: 0.5 } }
    )
  }

  // ── Slide 4-N: Report Sections from AI text ────────────────────────────────
  const sections = text.split(/^### /m).filter(Boolean)
  for (const section of sections.slice(0, 4)) {
    const lines = section.trim().split('\n')
    const title = lines[0].trim()
    const body = lines.slice(1).join('\n').trim()

    const slide = pptx.addSlide()
    slide.background = { color: BRAND.white }
    slide.addText(title, { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 22, color: BRAND.primary, bold: true, fontFace: 'Calibri' })
    slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 0.95, w: 9, h: 0.04, fill: { color: BRAND.accent } })
    slide.addText(body.slice(0, 800), {
      x: 0.5, y: 1.2, w: 9, h: 4,
      fontSize: 13, color: BRAND.text, fontFace: 'Calibri',
      valign: 'top', wrap: true,
    })
  }

  // ── Last Slide: NOVAXX footer ───────────────────────────────────────────────
  const lastSlide = pptx.addSlide()
  lastSlide.background = { color: BRAND.primary }
  lastSlide.addText('NOVAX', { x: 4, y: 2, w: 2, h: 0.8, fontSize: 32, color: BRAND.accent, bold: true, align: 'center', fontFace: 'Calibri' })
  lastSlide.addText('Operations Platform', { x: 2.5, y: 2.8, w: 5, h: 0.4, fontSize: 14, color: '#9DCCC8', align: 'center', fontFace: 'Calibri' })

  const pptxBuffer = Buffer.from(await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer)
  const safeClient = client_name.replace(/[^a-z0-9]/gi, '_')
  const safeType = report_type.replace(/[^a-z0-9]/gi, '_')

  return new NextResponse(new Uint8Array(pptxBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="NOVAX_${safeClient}_${safeType}.pptx"`,
    },
  })
}
