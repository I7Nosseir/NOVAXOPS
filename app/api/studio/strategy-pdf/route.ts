import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { StrategyPDF } from '@/lib/pdf/strategy-pdf'
import type { StrategyDocument, BossBrief } from '@/lib/studio-types'

export async function POST(req: NextRequest) {
  let body: {
    doc?: StrategyDocument
    clientName?: string
    clientColor?: string
    platforms?: string[]
    bossBrief?: BossBrief | null
    quarter?: string
    year?: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    doc = {},
    clientName = 'Client',
    clientColor,
    platforms = [],
    bossBrief,
    quarter,
    year,
  } = body

  // Merge top-level quarter/year into the doc so the PDF picks them up
  const enrichedDoc: StrategyDocument = {
    ...doc,
    quarter: doc.quarter ?? quarter,
    year: doc.year ?? year,
  }

  try {
    const element = React.createElement(StrategyPDF, {
      doc: enrichedDoc,
      clientName,
      clientColor,
      platforms,
      bossBrief,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any)
    const safeName = clientName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
    const quarter_str = enrichedDoc.quarter ? `_${enrichedDoc.quarter}` : ''
    const year_str    = enrichedDoc.year    ? `_${enrichedDoc.year}`    : ''

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}${quarter_str}${year_str}_Strategy.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[strategy-pdf] PDF generation error:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF generation failed' },
      { status: 500 },
    )
  }
}
