import { NextRequest, NextResponse } from 'next/server'
import { anthropic, AI_MODELS } from '@/lib/ai-client'

export async function POST(req: NextRequest) {
  try {
    const { base64, fallbackText } = await req.json() as { base64?: string; fallbackText?: string }

    if (!base64) {
      return NextResponse.json({ error: 'No PDF data provided' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      // If Claude is not configured, we can't extract — return fallback
      return NextResponse.json({ text: fallbackText ?? '' })
    }

    const response = await anthropic.messages.create({
      model: AI_MODELS.primary,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } } as any,
            {
              type: 'text',
              text: 'Extract ALL text from this PDF document. Return only the raw extracted text, preserving paragraph and section structure with line breaks. No commentary, no summaries — just the complete text content of the document.',
            },
          ],
        },
      ],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('\n')

    return NextResponse.json({ text })
  } catch (err) {
    console.error('[extract-pdf]', err)
    return NextResponse.json({ error: 'PDF extraction failed' }, { status: 500 })
  }
}
