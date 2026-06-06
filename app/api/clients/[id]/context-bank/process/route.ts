// AI-powered document processing for context bank entries.
// Accepts raw text (from paste or file extraction) and returns a structured entry
// with AI-assigned category and a 2-3 sentence summary.
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const PRIMARY_MODEL = 'claude-sonnet-4-6'
const GEMINI_MODEL = 'gemini-3-flash-preview'

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY!
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

const CATEGORIES = [
  'Client Instructions',
  'Brand Update',
  'Campaign Feedback',
  'Market Intel',
  'Meeting Notes',
  'Competitor Intel',
]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params // bind
  const useAnthropic = !!process.env.ANTHROPIC_API_KEY

  let body: { text: string; source_type?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { text } = body
  if (!text?.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 })

  const truncated = text.slice(0, 6000)

  const prompt = `You are an intelligence analyst for a social media agency.
A team member has provided the following text to be saved to a client's knowledge base.

TEXT:
${truncated}

Your task:
1. Assign the most fitting category from this list: ${CATEGORIES.join(', ')}
2. Write a 2-3 sentence summary that captures the most actionable insight from this text.
   The summary will be shown in a list and read by AI before generating content for this client.
   Be specific and concrete — no vague generalities.

Respond ONLY with valid JSON in this exact format (no markdown fences):
{"category": "<category>", "summary": "<2-3 sentence summary>"}`

  let raw = ''
  try {
    if (useAnthropic) {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await client.messages.create({
        model: PRIMARY_MODEL,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      })
      raw = (msg.content[0] as { text: string }).text
    } else {
      raw = await callGemini(prompt)
    }

    const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim()) as {
      category: string
      summary: string
    }

    return NextResponse.json({
      category: CATEGORIES.includes(parsed.category) ? parsed.category : 'Meeting Notes',
      summary: parsed.summary,
      full_text: truncated,
    })
  } catch (err) {
    console.error('[context-bank/process]', err)
    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 })
  }
}
