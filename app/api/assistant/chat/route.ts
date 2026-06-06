// ============================================================
// POST /api/assistant/chat — streaming AI assistant
// ============================================================

import { NextRequest } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const MODEL_STANDARD = 'claude-sonnet-4-6'
const MODEL_CEO      = 'claude-opus-4-7'
const GEMINI_MODEL   = 'gemini-3-flash-preview'

// ── Rate limit ────────────────────────────────────────────────
const rl = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const e = rl.get(ip)
  if (!e || now > e.resetAt) { rl.set(ip, { count: 1, resetAt: now + 60_000 }); return true }
  if (e.count >= 15) return false
  e.count++; return true
}

// ── DB — one client per request ───────────────────────────────
function makeDb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ── Types ─────────────────────────────────────────────────────
interface ChatMessage { role: 'user' | 'assistant'; content: string }
interface ContextItem  { type: 'client' | 'document' | 'session' | 'task'; id: string; label: string }

interface RequestBody {
  messages:      ChatMessage[]
  context_items: ContextItem[]
  client_id?:    string
  is_ceo?:       boolean
  user_role?:    string
}

// ── Tiptap JSON → plain text ──────────────────────────────────
// Tiptap stores content as a ProseMirror JSON object, not HTML.
// We walk the node tree and extract text recursively.
function tiptapToText(node: unknown, depth = 0): string {
  if (depth > 20) return ''
  if (typeof node === 'string') return node
  if (!node || typeof node !== 'object') return ''
  const n = node as Record<string, unknown>

  if (n.type === 'text') return typeof n.text === 'string' ? n.text : ''

  const children = Array.isArray(n.content) ? n.content : []
  const childText = children.map((c: unknown) => tiptapToText(c, depth + 1)).join('')

  // Add newline after block-level nodes
  const blockTypes = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'horizontalRule', 'hardBreak'])
  return blockTypes.has(String(n.type)) ? `${childText}\n` : childText
}

// ── Context fetchers — each individually try/catched ──────────

async function fetchClientContext(db: SupabaseClient, id: string): Promise<string> {
  try {
    const { data } = await db.from('clients').select('name,brand_identity_json').eq('id', id).single()
    if (!data) return ''
    const b = data.brand_identity_json as Record<string, unknown> | null
    const lines: string[] = [`Client: ${data.name}`]
    if (b?.industry)        lines.push(`Industry: ${b.industry}`)
    if (b?.tone_of_voice)   lines.push(`Tone: ${b.tone_of_voice}`)
    if (b?.target_audience) lines.push(`Audience: ${b.target_audience}`)
    if (Array.isArray(b?.key_messages)) lines.push(`Key messages: ${(b.key_messages as string[]).join(' | ')}`)
    return lines.join('\n')
  } catch { return '' }
}

async function fetchDocumentContext(db: SupabaseClient, id: string): Promise<string> {
  try {
    const { data } = await db.from('documents').select('title,content').eq('id', id).single()
    if (!data) return ''
    let text = ''
    if (typeof data.content === 'string') {
      // Legacy HTML storage
      text = data.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    } else if (data.content && typeof data.content === 'object') {
      // Tiptap JSON (ProseMirror)
      text = tiptapToText(data.content).replace(/\n{3,}/g, '\n\n').trim()
    }
    return `Document: "${data.title}"\n${text.slice(0, 4000)}`
  } catch { return '' }
}

async function fetchSessionContext(db: SupabaseClient, id: string): Promise<string> {
  try {
    const { data } = await db.from('studio_sessions').select('tool_type,title,output_json').eq('id', id).single()
    if (!data) return ''
    const out = data.output_json as Record<string, unknown> | null
    const parts: string[] = [`Studio Session: "${data.title}" (${data.tool_type})`]
    if (out?.boss_brief) parts.push(`Boss Brief:\n${JSON.stringify(out.boss_brief, null, 2).slice(0, 2000)}`)
    if (out?.script)     parts.push(`Script:\n${String(out.script).slice(0, 2000)}`)
    if (out?.hooks)      parts.push(`Hooks:\n${JSON.stringify(out.hooks).slice(0, 1000)}`)
    if (out?.brief)      parts.push(`Brief:\n${String(out.brief).slice(0, 1500)}`)
    return parts.join('\n\n')
  } catch { return '' }
}

async function fetchTaskContext(db: SupabaseClient, id: string): Promise<string> {
  try {
    const { data } = await db.from('tasks').select('title,description,pipeline_stage,priority,due_date').eq('id', id).single()
    if (!data) return ''
    return `Task: "${data.title}"\nStage: ${data.pipeline_stage} | Priority: ${data.priority}${data.due_date ? ` | Due: ${data.due_date}` : ''}\n${data.description ?? ''}`
  } catch { return '' }
}

// ── Performance data from Supabase (already synced from Metricool) ────────────
// Uses post_performance_snapshots which is synced by the daily cron job.
// Avoids hitting the Metricool API during a chat request.

const METRICS_KEYWORDS = [
  'performance', 'stats', 'metric', 'analytics', 'views', 'engagement',
  'reach', 'impressions', 'followers', 'best post', 'worst post', 'top post',
  'how did', 'how are', 'scheduled', 'published', 'results',
]

function needsPerformanceData(messages: ChatMessage[]): boolean {
  const last = messages[messages.length - 1]?.content?.toLowerCase() ?? ''
  return METRICS_KEYWORDS.some(kw => last.includes(kw))
}

async function fetchPerformanceSummary(db: SupabaseClient, clientId: string): Promise<string> {
  try {
    const { data } = await db
      .from('post_performance_snapshots')
      .select('platform,post_type,impressions,reach,engagement_rate,likes,comments,shares,fetched_at')
      .eq('client_id', clientId)
      .order('fetched_at', { ascending: false })
      .limit(20)

    if (!data?.length) return ''

    const summary = data.map(r =>
      `[${r.platform}/${r.post_type}] reach:${r.reach ?? '-'} impressions:${r.impressions ?? '-'} ER:${r.engagement_rate ?? '-'}% likes:${r.likes ?? '-'} comments:${r.comments ?? '-'}`
    ).join('\n')

    return `Recent post performance (last 20 snapshots):\n${summary}`
  } catch { return '' }
}

// ── System prompt builder ─────────────────────────────────────

function buildSystemPrompt(
  isCeo:         boolean,
  userRole:      string,
  clientContext: string,
  contextBlocks: string[],
  perfData:      string,
): string {
  const roleName = ({
    admin:            'Admin',
    ceo:              'CEO',
    creative_director: 'Creative Director',
    copywriter:       'Copywriter',
    designer:         'Designer',
    social_manager:   'Social Media Manager',
    account_manager:  'Account Manager',
    strategist:       'Strategist',
  } as Record<string, string>)[userRole] ?? 'Team Member'

  let prompt = `You are the NOVAX AI Assistant — an expert embedded inside NOVAX, the internal operations platform for a social media and creative agency.
You think and respond like a senior marketing strategist with 15 years of agency experience.
You are concise, direct, and actionable. No filler, no fluff, no disclaimers.
Current user role: ${roleName}`

  if (isCeo) {
    prompt += `\n\nCEO MODE ACTIVE. Provide cross-client strategic thinking. Challenge assumptions. Surface risks and opportunities the user might not see. Be a thought partner, not an assistant.`
  }

  if (clientContext) {
    prompt += `\n\n── ACTIVE CLIENT ──\n${clientContext}`
  }

  if (contextBlocks.length > 0) {
    prompt += `\n\n── REFERENCED CONTENT ──\n${contextBlocks.join('\n\n---\n\n')}`
  }

  if (perfData) {
    prompt += `\n\n── LIVE PERFORMANCE DATA ──\n${perfData}`
  }

  prompt += `

── OUTPUT RULES ──
- No emojis or hashtags unless the user explicitly asks for them
- Answer in the same language the user writes in
- When editing or rewriting, return the full revised version — never just describe changes
- When creating content, produce it in full — not a plan or outline unless asked
- Back strategic opinions with specific reasoning
- When referencing data, cite actual numbers`

  return prompt
}

// ── Gemini fallback ───────────────────────────────────────────

async function callGeminiFallback(system: string, messages: ChatMessage[]): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('No AI API key configured.')
  const combined = `${system}\n\n${messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')}`
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: combined }] }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}`)
  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response from AI.'
}

// ── POST handler ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment.' }), { status: 429 })
  }

  let body: RequestBody
  try { body = await req.json() }
  catch { return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400 }) }

  const { messages, context_items = [], client_id, is_ceo = false, user_role = 'admin' } = body

  if (!messages?.length) {
    return new Response(JSON.stringify({ error: 'messages array is required.' }), { status: 400 })
  }

  const db = makeDb()

  // Deduplicate: if client_id is in context_items too, skip the duplicate fetch
  const contextFetches = context_items.map(item => {
    switch (item.type) {
      case 'client':   return fetchClientContext(db, item.id)
      case 'document': return fetchDocumentContext(db, item.id)
      case 'session':  return fetchSessionContext(db, item.id)
      case 'task':     return fetchTaskContext(db, item.id)
      default:         return Promise.resolve('')
    }
  })

  const clientInContextItems = context_items.some(i => i.type === 'client' && i.id === client_id)

  const [clientContext, contextBlocks, perfData] = await Promise.all([
    client_id && !clientInContextItems ? fetchClientContext(db, client_id) : Promise.resolve(''),
    Promise.all(contextFetches),
    client_id && needsPerformanceData(messages) ? fetchPerformanceSummary(db, client_id) : Promise.resolve(''),
  ])

  const systemPrompt = buildSystemPrompt(
    is_ceo,
    user_role,
    clientContext,
    contextBlocks.filter(Boolean),
    perfData,
  )

  const useAnthropic = !!process.env.ANTHROPIC_API_KEY

  // ── Gemini fallback — wrap in fake SSE stream so client code is identical ──
  if (!useAnthropic) {
    try {
      const text = await callGeminiFallback(systemPrompt, messages)
      const encoder = new TextEncoder()
      return new Response(
        new ReadableStream({
          start(ctrl) {
            ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            ctrl.enqueue(encoder.encode('data: [DONE]\n\n'))
            ctrl.close()
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } },
      )
    } catch (err) {
      console.error('[assistant/chat] Gemini error:', err)
      return new Response(JSON.stringify({ error: 'AI service unavailable. Please try again.' }), { status: 500 })
    }
  }

  // ── Claude streaming ──────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const model     = is_ceo ? MODEL_CEO : MODEL_STANDARD
  const encoder   = new TextEncoder()

  const stream = new ReadableStream({
    async start(ctrl) {
      try {
        const claudeStream = anthropic.messages.stream({
          model,
          max_tokens: 2048,
          system:     systemPrompt,
          messages:   messages.map(m => ({ role: m.role, content: m.content })),
        })

        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
          }
        }
        ctrl.enqueue(encoder.encode('data: [DONE]\n\n'))
        ctrl.close()
      } catch (err) {
        console.error('[assistant/chat] Claude error:', err)
        ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'AI stream error. Please try again.' })}\n\n`))
        ctrl.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
