import { NextRequest, NextResponse } from 'next/server'
import { aiGuard } from '@/lib/ai-guard'
import { buildDeckPptx } from '@/lib/deck-builder'
import { DeckPdfDocument } from '@/lib/deck-builder-pdf'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import type { DeckDocument } from '@/lib/deck-types'

export const maxDuration = 60

function getSafeName(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60) || 'Presentation'
}

export async function POST(request: NextRequest) {
  const guardResponse = await aiGuard(request)
  if (guardResponse) return guardResponse

  try {
    const body: { deck: DeckDocument; format: 'pptx' | 'pdf' } = await request.json()
    const { deck, format } = body

    if (!deck || !format) {
      return NextResponse.json({ error: 'Missing deck or format' }, { status: 400 })
    }

    const safeName = getSafeName(deck.title)

    if (format === 'pptx') {
      const buffer = await buildDeckPptx(deck)
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: {
          'Content-Type':        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': `attachment; filename="${safeName}.pptx"`,
        },
      })
    }

    if (format === 'pdf') {
      // renderToBuffer expects a ReactElement — createElement satisfies this at runtime
      const element = React.createElement(DeckPdfDocument, { deck })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buffer = await renderToBuffer(element as any)
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: {
          'Content-Type':        'application/pdf',
          'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
        },
      })
    }

    return NextResponse.json({ error: 'Invalid format — use pptx or pdf' }, { status: 400 })
  } catch (err) {
    console.error('[decks/export] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 },
    )
  }
}
