import { NextRequest, NextResponse } from 'next/server'

const GEMINI_MODEL = 'gemini-3-flash-preview'

const REPORT_TYPE_LABELS: Record<string, string> = {
  monthly:   'Monthly Organic Performance',
  paid:      'Paid Media / Paid Ads',
  combined:  'Paid + Organic Combined',
  platform:  'Platform Deep Dive (Instagram)',
  quarterly: 'Quarterly Strategy',
  executive: 'Executive Summary',
}

async function callGemini(prompt: string, images: { base64: string; mimeType: string }[]): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not configured. Add it to .env.local.')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`
  const parts: object[] = images.map(img => ({
    inline_data: { mime_type: img.mimeType, data: img.base64 },
  }))
  parts.push({ text: prompt })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }

  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured. Add it to .env.local to use the AI Report Builder.' },
      { status: 500 },
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }

  const userPrompt  = (formData.get('prompt') as string | null) ?? ''
  const reportType  = (formData.get('reportType') as string | null) ?? 'monthly'
  const reportLabel = REPORT_TYPE_LABELS[reportType] ?? 'Performance'

  // Collect and convert image files
  const images: { base64: string; mimeType: string }[] = []
  for (let i = 0; i < 5; i++) {
    const file = formData.get(`file_${i}`) as File | null
    if (!file) continue
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') continue
    const buffer  = await file.arrayBuffer()
    const base64  = Buffer.from(buffer).toString('base64')
    const mimeType = file.type.startsWith('image/') ? file.type : 'image/jpeg'
    images.push({ base64, mimeType })
  }

  if (!userPrompt.trim() && images.length === 0) {
    return NextResponse.json({ error: 'Provide at least one screenshot or a text description of the data.' }, { status: 400 })
  }

  const systemPrompt = `You are a senior social media analyst at NOVA, a creative marketing agency. The user has provided ${images.length > 0 ? `${images.length} analytics screenshot(s)` : 'text data'} for a ${reportLabel} report.

Your task:
1. Extract every numeric metric visible in the screenshots or mentioned in the text — platform, period, reach, impressions, engagement rate, followers, likes, comments, shares, saves, ad spend, revenue, ROAS, CPM, CPC, CTR, CPA, conversions, etc.
2. Identify the reporting period, platform(s), and client/brand name if mentioned.
3. Calculate derived metrics where possible (e.g. ROAS = revenue ÷ spend, CTR = clicks ÷ impressions × 100).
4. Generate a polished, professional ${reportLabel} report structured as follows:

### Executive Summary
3 key findings — lead with the most important insight. Each finding must reference a specific number.

### Key Metrics
A clean table or bulleted list of all extracted metrics with their values and period.

### Performance Analysis
2-3 paragraphs interpreting what the numbers mean. Apply benchmarks where relevant (e.g. Instagram average ER is 1.5–3.5%; TikTok average is 5–9%; paid social benchmark CTR is 0.9–1.5%).

### Platform / Campaign Breakdown
If multi-platform or multi-campaign data is present, compare performance across each one.

### Trend Observations
If data from multiple periods is available, describe the trajectory and acceleration/deceleration.

### Strategic Recommendations
3 specific, evidence-based actions. Each must reference a metric and explain the expected outcome. Format as numbered bullets.

---
FORMAT RULES:
- Use ### for section headers
- Use bullet points for lists
- Bold (**text**) key numbers and findings
- No hashtags, no emojis
- Professional, direct tone — write as a senior analyst briefing a CEO
- If data is insufficient for a section, state what is missing and what would be needed to complete the analysis

User context: ${userPrompt || 'No additional context provided.'}`

  const structurePrompt = `From the report above, extract a JSON object with exactly this shape:
{
  "kpis": [{ "label": "...", "value": "...", "change": "..." }],
  "platforms": [{ "name": "...", "reach": 0, "er": 0.0 }],
  "trend": [{ "period": "...", "value": 0 }]
}
Return only valid JSON, no explanation. Use 0 for missing numeric values. Include up to 5 KPIs and all platforms found in the data.`

  try {
    const text = await callGemini(systemPrompt, images)

    // Second pass: extract structured data for charts
    let data: { kpis: { label: string; value: string; change: string }[]; platforms: { name: string; reach: number; er: number }[]; trend: { period: string; value: number }[] } = { kpis: [], platforms: [], trend: [] }
    try {
      const structureInput = `Here is the report:\n\n${text}\n\n${structurePrompt}`
      const structureText = await callGemini(structureInput, [])
      const jsonMatch = structureText.match(/\{[\s\S]*\}/)
      if (jsonMatch) data = JSON.parse(jsonMatch[0]) as typeof data
    } catch { /* structured extraction is best-effort */ }

    return NextResponse.json({ text, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
