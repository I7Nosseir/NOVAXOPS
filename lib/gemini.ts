// lib/gemini.ts
// Shared Gemini REST client — no SDK needed

const MODEL   = 'gemini-3-flash-preview'
const API_KEY = process.env.GEMINI_API_KEY ?? ''

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
  error?: { message: string; code: number }
}

interface GenerateOptions {
  temperature?: number
  maxOutputTokens?: number
  jsonMode?: boolean      // sets responseMimeType to application/json
}

export async function geminiGenerate(
  prompt: string,
  systemInstruction?: string,
  options: GenerateOptions = {},
): Promise<string> {
  if (!API_KEY) throw new Error('GEMINI_API_KEY not configured')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature:      options.temperature      ?? 0.3,
      maxOutputTokens:  options.maxOutputTokens  ?? 16384,
      ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  }

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] }
  }

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  const json = await res.json() as GeminiResponse

  if (json.error) throw new Error(`Gemini error ${json.error.code}: ${json.error.message}`)
  if (!res.ok)    throw new Error(`Gemini HTTP ${res.status}`)

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!text) throw new Error('Gemini returned empty response')

  // Strip markdown code fences if present
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
}

// Convenience: generate and parse JSON
export async function geminiJson<T = unknown>(
  prompt: string,
  systemInstruction?: string,
  options: GenerateOptions = {},
): Promise<T> {
  const raw = await geminiGenerate(prompt, systemInstruction, { ...options, jsonMode: true })
  return JSON.parse(raw) as T
}
