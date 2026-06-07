// ============================================================
// POST /api/assistant/chat — streaming AI assistant
// ============================================================

import { NextRequest } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { buildClientIntelligenceBlock } from '@/lib/client-intelligence'

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
  user_id?:      string
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
    const { data } = await db
      .from('clients')
      .select('name,brand_identity_json,crisis_mode,metricool_blog_id,status')
      .eq('id', id)
      .single()
    if (!data) return ''
    const b = data.brand_identity_json as Record<string, unknown> | null
    const lines: string[] = [`Client: ${data.name}${data.crisis_mode ? ' [CRISIS MODE ACTIVE]' : ''}`]
    if (b?.industry)        lines.push(`Industry: ${b.industry}`)
    if (b?.tone_of_voice)   lines.push(`Tone: ${b.tone_of_voice}`)
    if (b?.target_audience) lines.push(`Audience: ${b.target_audience}`)
    if (Array.isArray(b?.key_messages)) lines.push(`Key messages: ${(b.key_messages as string[]).join(' | ')}`)
    if (data.metricool_blog_id) lines.push(`Metricool blog ID: ${data.metricool_blog_id}`)
    return lines.join('\n')
  } catch { return '' }
}

// ── Metricool / publishing context for selected client ─────────────────────
// Reads from scheduled_posts (already synced from Metricool by cron).
// Always injected when a client is selected — gives the AI publishing awareness.

async function fetchClientMetricoolContext(db: SupabaseClient, clientId: string): Promise<string> {
  try {
    const now = new Date()
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [upcomingRes, publishedRes, draftRes] = await Promise.all([
      // Upcoming scheduled (next 7 days)
      db.from('scheduled_posts')
        .select('id,platforms,caption,scheduled_at,status,metricool_post_id')
        .eq('client_id', clientId)
        .eq('status', 'scheduled')
        .gte('scheduled_at', now.toISOString())
        .lte('scheduled_at', in7days)
        .order('scheduled_at', { ascending: true })
        .limit(10),
      // Published this month
      db.from('scheduled_posts')
        .select('id,platforms,published_at')
        .eq('client_id', clientId)
        .eq('status', 'published')
        .gte('published_at', startOfMonth)
        .limit(30),
      // Drafts
      db.from('scheduled_posts')
        .select('id')
        .eq('client_id', clientId)
        .eq('status', 'draft')
        .limit(1),
    ])

    const upcoming = upcomingRes.data ?? []
    const published = publishedRes.data ?? []
    const draftCount = (draftRes.data ?? []).length

    if (!upcoming.length && !published.length && !draftCount) return ''

    const lines: string[] = ['── METRICOOL / PUBLISHING STATUS ──']

    if (upcoming.length > 0) {
      lines.push(`Scheduled (next 7 days): ${upcoming.length} post${upcoming.length !== 1 ? 's' : ''}`)
      for (const p of upcoming.slice(0, 5)) {
        const platforms = Array.isArray(p.platforms) ? (p.platforms as string[]).join(', ') : String(p.platforms ?? '')
        const date = p.scheduled_at ? new Date(p.scheduled_at as string).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '?'
        const caption = typeof p.caption === 'string' ? p.caption.slice(0, 80) : ''
        lines.push(`  • [${platforms}] ${date} — "${caption}${caption.length >= 80 ? '…' : ''}"`)
      }
    } else {
      lines.push('Scheduled (next 7 days): 0 posts — calendar is empty')
    }

    lines.push(`Published this month: ${published.length} post${published.length !== 1 ? 's' : ''}`)
    if (draftCount > 0) lines.push(`Drafts pending: ${draftCount}+`)

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

// ── Role-scoped context for non-CEO users ────────────────────
// Auto-injects the user's own active tasks so they don't have to
// manually @ every task when asking for help with their work.

async function fetchUserScopedContext(db: SupabaseClient, userId: string): Promise<string> {
  try {
    const { data: tasks } = await db
      .from('tasks')
      .select('id,title,pipeline_stage,priority,due_date,client_id')
      .eq('assigned_to', userId)
      .neq('status', 'completed')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(8)

    if (!tasks?.length) return ''

    const clientIds = [...new Set(tasks.map((t: { client_id: string }) => t.client_id).filter(Boolean))]
    const { data: clients } = clientIds.length > 0
      ? await db.from('clients').select('id,name').in('id', clientIds)
      : { data: [] as Array<{ id: string; name: string }> }

    const clientMap: Record<string, string> = {}
    for (const c of clients ?? []) clientMap[c.id] = c.name

    const lines = tasks.map((t: { title: string; pipeline_stage: string; priority: string; due_date: string; client_id: string }) =>
      `- "${t.title}" [${t.pipeline_stage}${t.priority ? `, ${t.priority}` : ''}${t.due_date ? `, due ${t.due_date}` : ''}] — ${clientMap[t.client_id] ?? 'Unknown client'}`
    )

    return `\n\n── YOUR ACTIVE TASKS (${lines.length}) ──\n${lines.join('\n')}`
  } catch { return '' }
}

// ── CEO: Cross-client agency intelligence ─────────────────────

async function fetchCeoAgencyBriefing(db: SupabaseClient): Promise<string> {
  const now = new Date()
  const quarter = Math.ceil((now.getMonth() + 1) / 3)
  const year = now.getFullYear()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch each independently so one failure doesn't wipe out all context
  const safe = <T>(p: PromiseLike<T>) => Promise.resolve(p).catch(() => ({ data: null, error: 'fetch failed' }))

  const [clientsRes, tasksRes, approvalsRes, moderationRes, ctxRes, stratRes, scheduledRes, publishedRes] = await Promise.all([
    // crisis_mode is the real column name (NOT is_in_crisis)
    safe(db.from('clients').select('id,name,crisis_mode,status,brand_identity_json,metricool_blog_id').eq('status', 'active')),
    safe(db.from('tasks').select('id,client_id,status,due_date,pipeline_stage').eq('status', 'active')),
    safe(db.from('approval_requests').select('id,status').eq('status', 'pending')),
    safe(db.from('moderation_items').select('id,status').eq('status', 'pending')),
    safe(db.from('client_context_bank').select('client_id,category,summary').eq('is_active', true).order('created_at', { ascending: false }).limit(40)),
    safe(db.from('client_quarterly_strategies').select('client_id,goals,themes').eq('year', year).eq('quarter', quarter)),
    // Upcoming scheduled posts (next 7 days) — grouped by client
    safe(db.from('scheduled_posts').select('client_id,status').eq('status', 'scheduled').gte('scheduled_at', now.toISOString()).lte('scheduled_at', in7days)),
    // Published this month — grouped by client
    safe(db.from('scheduled_posts').select('client_id').eq('status', 'published').gte('published_at', startOfMonth)),
  ])

  if (clientsRes.error) console.error('[assistant/chat] CEO briefing clients error:', clientsRes.error)
  if (tasksRes.error)   console.error('[assistant/chat] CEO briefing tasks error:', tasksRes.error)

  const clients = clientsRes.data ?? []
  const tasks   = tasksRes.data ?? []

  const overdueTasks  = tasks.filter(t => t.due_date && new Date(t.due_date) < now)
  const crisisClients = clients.filter(c => c.crisis_mode)

  const ctxByClient   = (ctxRes.data ?? []).reduce((acc: Record<string, string[]>, r) => {
    if (!acc[r.client_id]) acc[r.client_id] = []
    acc[r.client_id].push(`[${r.category}] ${r.summary}`)
    return acc
  }, {})
  const stratByClient = (stratRes.data ?? []).reduce((acc: Record<string, string>, r) => {
    acc[r.client_id] = r.goals ? `Goals: ${r.goals}` : ''
    return acc
  }, {})

  // Count scheduled + published per client
  const scheduledByClient: Record<string, number> = {}
  for (const p of scheduledRes.data ?? []) {
    scheduledByClient[p.client_id] = (scheduledByClient[p.client_id] ?? 0) + 1
  }
  const publishedByClient: Record<string, number> = {}
  for (const p of publishedRes.data ?? []) {
    publishedByClient[p.client_id] = (publishedByClient[p.client_id] ?? 0) + 1
  }

  const lines: string[] = [
    `── AGENCY OVERVIEW ──`,
    `Active clients: ${clients.length} | Active tasks: ${tasks.length} | Overdue: ${overdueTasks.length}`,
    `Pending approvals: ${(approvalsRes.data ?? []).length} | Pending moderation: ${(moderationRes.data ?? []).length}`,
    crisisClients.length > 0 ? `CRISIS MODE: ${crisisClients.map(c => c.name).join(', ')}` : 'No clients in crisis',
    '',
    `── PER-CLIENT STATUS ──`,
  ]

  for (const client of clients) {
    const clientTasks   = tasks.filter(t => t.client_id === client.id)
    const clientOverdue = clientTasks.filter(t => t.due_date && new Date(t.due_date) < now)
    const ctx       = ctxByClient[client.id] ?? []
    const strat     = stratByClient[client.id]
    const scheduled = scheduledByClient[client.id] ?? 0
    const published = publishedByClient[client.id] ?? 0
    const b = client.brand_identity_json as Record<string, unknown> | null

    lines.push(`\n${client.name}${client.crisis_mode ? ' [CRISIS]' : ''} — ${b?.industry ?? 'Unknown industry'}`)
    lines.push(`  Tasks: ${clientTasks.length} active${clientOverdue.length > 0 ? `, ${clientOverdue.length} overdue` : ''}`)
    lines.push(`  Metricool: ${scheduled} scheduled (next 7d) | ${published} published this month`)
    if (strat) lines.push(`  Q${quarter} ${year} goal: ${strat.slice(0, 120)}`)
    if (ctx.length > 0) lines.push(`  Memory: ${ctx.slice(0, 3).join(' | ')}`)
  }

  return lines.join('\n')
}

// ── System prompt builder ─────────────────────────────────────

function buildSystemPrompt(
  isCeo:              boolean,
  userRole:           string,
  clientContext:      string,
  contextBlocks:      string[],
  perfData:           string,
  metricoolContext:   string,
  intelligenceBlock?: string,
  ceoBriefing?:       string,
  userContext?:       string,
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

  let prompt: string

  if (isCeo) {
    prompt = `You are the NOVAX AI Assistant with full visibility across all clients, work, and performance data.
You give clear, grounded answers. You surface relevant context the CEO may not have asked for — briefly.
Current operator: ${roleName}`
  } else {
    prompt = `You are the NOVAX AI Assistant — a knowledgeable helper inside NOVAX, a social media and creative agency's operations platform.
You are helpful, direct, and concise. You answer what was asked. You do not volunteer unsolicited strategic mandates or tell the user what they "must" or "should" do unless asked.
Current user role: ${roleName}`
  }

  if (clientContext) {
    prompt += `\n\n── ACTIVE CLIENT ──\n${clientContext}`
  }

  if (contextBlocks.length > 0) {
    prompt += `\n\n── REFERENCED CONTENT ──\n${contextBlocks.join('\n\n---\n\n')}`
  }

  if (metricoolContext) {
    prompt += `\n\n${metricoolContext}`
  }

  if (perfData) {
    prompt += `\n\n── LIVE PERFORMANCE DATA ──\n${perfData}`
  }

  if (intelligenceBlock) {
    prompt += intelligenceBlock
  }

  if (ceoBriefing) {
    prompt += `\n\n${ceoBriefing}`
  }

  if (userContext && !isCeo) {
    prompt += userContext
  }

  prompt += `

── OUTPUT RULES ──
- No emojis or hashtags unless the user explicitly asks for them
- Answer in the same language the user writes in
- Keep responses short and conversational. Do not write long essays unprompted.
- Use simple markdown only: plain paragraphs, a short bullet list when listing 3+ items. Avoid bold headers (##, ###) unless the response genuinely needs sections.
- Do not give the user orders, mandates, or unsolicited strategic directives. Be a helpful assistant, not a consultant billing by the word.
- When editing or rewriting, return the full revised version — never just describe changes
- When creating content, produce it in full — not a plan or outline unless asked
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

  const { messages, context_items = [], client_id, is_ceo = false, user_role = 'admin', user_id } = body

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

  const [clientContext, contextBlocks, perfData, metricoolContext, intelligenceBlock, ceoBriefing, userContext] = await Promise.all([
    client_id && !clientInContextItems ? fetchClientContext(db, client_id) : Promise.resolve(''),
    Promise.all(contextFetches),
    client_id && needsPerformanceData(messages) ? fetchPerformanceSummary(db, client_id) : Promise.resolve(''),
    client_id ? fetchClientMetricoolContext(db, client_id).catch(() => '') : Promise.resolve(''),
    client_id ? buildClientIntelligenceBlock(client_id, 'chat', db).catch(() => '') : Promise.resolve(''),
    is_ceo ? fetchCeoAgencyBriefing(db).catch(err => { console.error('[assistant/chat] CEO briefing failed:', err); return '' }) : Promise.resolve(''),
    user_id && !is_ceo ? fetchUserScopedContext(db, user_id).catch(() => '') : Promise.resolve(''),
  ])

  const systemPrompt = buildSystemPrompt(
    is_ceo,
    user_role,
    clientContext,
    contextBlocks.filter(Boolean),
    perfData,
    metricoolContext,
    intelligenceBlock || undefined,
    ceoBriefing || undefined,
    userContext || undefined,
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
