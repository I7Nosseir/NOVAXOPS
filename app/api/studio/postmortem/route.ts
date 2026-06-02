// ============================================================
// POST /api/studio/postmortem
// 4 parallel Haiku analyses + 1 Sonnet verdict.
// Returns PostMortemDiagnosis.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { PostMortemAnalysis, PostMortemDiagnosis } from '@/lib/studio-types'

// ─── Request types ────────────────────────────────────────────

interface PostMortemBody {
  session_id?:      string
  session_data: {
    brief:        string
    hook_text:    string
    hook_type:    string
    format:       string
    caption:      string
    publish_time: string
    platform:     string
  }
  performance: {
    engagement_rate: number
    vs_client_avg:   number   // positive = above avg, negative = below
    reach:           number
    saves:           number
  }
  client_context: {
    client_name:      string
    best_format:      string
    best_posting_time: string
    avg_er:           number
    top_hook_types:   string[]
  }
}

// ─── Mock fallback ────────────────────────────────────────────

function buildMockDiagnosis(body: PostMortemBody): PostMortemDiagnosis {
  const { performance, client_context, session_data } = body
  const isBelow = performance.vs_client_avg < 0

  return {
    session_name:    body.session_id ?? 'Unknown Session',
    platform:        session_data.platform,
    published_at:    session_data.publish_time,
    engagement_rate: performance.engagement_rate,
    vs_client_avg:   performance.vs_client_avg,
    analyses: {
      hook: {
        verdict: isBelow ? 'likely_cause' : 'not_issue',
        finding: isBelow
          ? `${session_data.hook_type} hooks are not in this client's top performing types (${client_context.top_hook_types.join(', ')}).`
          : `${session_data.hook_type} hook aligns with this client's top performing types.`,
        fix: isBelow
          ? `Switch to ${client_context.top_hook_types[0] ?? 'curiosity'} framing on the next run.`
          : undefined,
      },
      format: {
        verdict:
          session_data.format === client_context.best_format ? 'not_issue' : 'contributing',
        finding:
          session_data.format === client_context.best_format
            ? `${session_data.format} is this client's best performing format — not a factor.`
            : `${session_data.format} underperforms ${client_context.best_format} for this client.`,
        fix:
          session_data.format !== client_context.best_format
            ? `Move this topic to ${client_context.best_format} format.`
            : undefined,
      },
      timing: {
        verdict: 'not_issue',
        finding: `Publish time ${session_data.publish_time} is within expected window — timing not the primary factor.`,
      },
      caption: {
        verdict: 'contributing',
        finding:
          'Caption CTA requests high-ability action. Save or share CTAs outperform link CTAs 3x for awareness content.',
        fix: 'Change CTA to "Save this for later" on the next run.',
      },
    },
    verdict:
      `Primary cause: ${isBelow ? `${session_data.hook_type} hook type underperforms for this client` : 'performance was on target'}. ` +
      `Rerun with ${client_context.top_hook_types[0] ?? 'curiosity'} hook and ${client_context.best_format} format for estimated 2-3x uplift.`,
    rerun_constraints: {
      hook_type:    client_context.top_hook_types[0] ?? 'curiosity',
      format:       client_context.best_format,
      posting_time: client_context.best_posting_time,
      cta_style:    'low-friction (save/share only)',
    },
  }
}

// ─── AI analysis helpers ──────────────────────────────────────

async function analyzeHook(
  client: Anthropic,
  data: PostMortemBody['session_data'],
  perf: PostMortemBody['performance'],
  ctx: PostMortemBody['client_context'],
): Promise<PostMortemAnalysis> {
  const prompt = `You are diagnosing why a social post underperformed.

HOOK ANALYSIS TASK:
Hook text: "${data.hook_text}"
Hook type used: ${data.hook_type}
Platform: ${data.platform}
Engagement rate: ${perf.engagement_rate}% (client avg: ${ctx.avg_er}%)
Performance vs avg: ${perf.vs_client_avg > 0 ? '+' : ''}${perf.vs_client_avg}%
Client's top performing hook types: ${ctx.top_hook_types.join(', ')}

Diagnose: Was the hook the primary problem?
Compare this hook type against the client's top performing types.

Return ONLY valid JSON — no markdown, no extra text:
{"verdict":"likely_cause"|"contributing"|"not_issue","finding":"one concise sentence with evidence","fix":"one actionable sentence"}`

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim()
  return JSON.parse(clean) as PostMortemAnalysis
}

async function analyzeFormat(
  client: Anthropic,
  data: PostMortemBody['session_data'],
  perf: PostMortemBody['performance'],
  ctx: PostMortemBody['client_context'],
): Promise<PostMortemAnalysis> {
  const prompt = `You are diagnosing why a social post underperformed.

FORMAT ANALYSIS TASK:
Format used: ${data.format}
Platform: ${data.platform}
Engagement rate: ${perf.engagement_rate}% (client avg: ${ctx.avg_er}%)
Performance vs avg: ${perf.vs_client_avg > 0 ? '+' : ''}${perf.vs_client_avg}%
Client's best performing format: ${ctx.best_format}

Diagnose: Was the format choice a contributing factor?
Compare format used vs client's proven best format.

Return ONLY valid JSON — no markdown, no extra text:
{"verdict":"likely_cause"|"contributing"|"not_issue","finding":"one concise sentence with evidence","fix":"one actionable sentence"}`

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim()
  return JSON.parse(clean) as PostMortemAnalysis
}

async function analyzeTiming(
  client: Anthropic,
  data: PostMortemBody['session_data'],
  perf: PostMortemBody['performance'],
  ctx: PostMortemBody['client_context'],
): Promise<PostMortemAnalysis> {
  const prompt = `You are diagnosing why a social post underperformed.

TIMING ANALYSIS TASK:
Actual publish time: ${data.publish_time}
Client's best posting time: ${ctx.best_posting_time}
Platform: ${data.platform}
Engagement rate: ${perf.engagement_rate}% (client avg: ${ctx.avg_er}%)

Diagnose: Was the timing a contributing factor?
Compare actual publish time vs client's peak engagement window.

Return ONLY valid JSON — no markdown, no extra text:
{"verdict":"likely_cause"|"contributing"|"not_issue","finding":"one concise sentence with evidence","fix":"one actionable sentence or omit key if not an issue"}`

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim()
  return JSON.parse(clean) as PostMortemAnalysis
}

async function analyzeCaption(
  client: Anthropic,
  data: PostMortemBody['session_data'],
  perf: PostMortemBody['performance'],
  ctx: PostMortemBody['client_context'],
): Promise<PostMortemAnalysis> {
  const prompt = `You are diagnosing why a social post underperformed.

CAPTION ANALYSIS TASK:
Caption: "${data.caption}"
Platform: ${data.platform}
Engagement rate: ${perf.engagement_rate}% (client avg: ${ctx.avg_er}%)
Saves: ${perf.saves}

Diagnose: Did the caption contribute to underperformance?
Score for: CTA clarity, hook continuation (does caption continue the hook's energy?), friction (how much effort does the CTA require?)

Return ONLY valid JSON — no markdown, no extra text:
{"verdict":"likely_cause"|"contributing"|"not_issue","finding":"one concise sentence citing specific issue","fix":"one actionable sentence"}`

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim()
  return JSON.parse(clean) as PostMortemAnalysis
}

async function buildVerdict(
  client: Anthropic,
  analyses: PostMortemDiagnosis['analyses'],
  body: PostMortemBody,
): Promise<{ verdict: string; rerun_constraints: Record<string, string> }> {
  const prompt = `You are writing a final verdict for a post-mortem diagnosis.

POST DETAILS:
Client: ${body.client_context.client_name}
Platform: ${body.session_data.platform}
Engagement rate: ${body.performance.engagement_rate}% (client avg: ${body.client_context.avg_er}%)
Performance vs avg: ${body.performance.vs_client_avg > 0 ? '+' : ''}${body.performance.vs_client_avg}%

DIAGNOSTIC FINDINGS:
Hook: [${analyses.hook.verdict}] ${analyses.hook.finding}
Format: [${analyses.format.verdict}] ${analyses.format.finding}
Timing: [${analyses.timing.verdict}] ${analyses.timing.finding}
Caption: [${analyses.caption.verdict}] ${analyses.caption.finding}

Write a 2-3 sentence verdict identifying the primary cause and prescribing the fix.
Then list the rerun constraints as key-value pairs.

Return ONLY valid JSON — no markdown, no extra text:
{
  "verdict": "2-3 sentence primary cause + recommended fix",
  "rerun_constraints": {
    "hook_type": "string",
    "format": "string",
    "posting_time": "string",
    "cta_style": "string"
  }
}`

  const msg = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim()
  return JSON.parse(clean)
}

// ─── Handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: PostMortemBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.session_data || !body.performance || !body.client_context) {
    return NextResponse.json(
      { error: 'session_data, performance, and client_context are required' },
      { status: 400 },
    )
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ...buildMockDiagnosis(body), _mock: true })
  }

  const client = new Anthropic()

  // ── 4 parallel Haiku analyses ──────────────────────────────
  const [hookResult, formatResult, timingResult, captionResult] = await Promise.all([
    analyzeHook(client, body.session_data, body.performance, body.client_context).catch(
      (): PostMortemAnalysis => ({
        verdict: 'not_issue',
        finding: 'Hook analysis unavailable — API error.',
      }),
    ),
    analyzeFormat(client, body.session_data, body.performance, body.client_context).catch(
      (): PostMortemAnalysis => ({
        verdict: 'not_issue',
        finding: 'Format analysis unavailable — API error.',
      }),
    ),
    analyzeTiming(client, body.session_data, body.performance, body.client_context).catch(
      (): PostMortemAnalysis => ({
        verdict: 'not_issue',
        finding: 'Timing analysis unavailable — API error.',
      }),
    ),
    analyzeCaption(client, body.session_data, body.performance, body.client_context).catch(
      (): PostMortemAnalysis => ({
        verdict: 'not_issue',
        finding: 'Caption analysis unavailable — API error.',
      }),
    ),
  ])

  const analyses: PostMortemDiagnosis['analyses'] = {
    hook:    hookResult,
    format:  formatResult,
    timing:  timingResult,
    caption: captionResult,
  }

  // ── Sonnet verdict ─────────────────────────────────────────
  let verdictData: { verdict: string; rerun_constraints: Record<string, string> }
  try {
    verdictData = await buildVerdict(client, analyses, body)
  } catch {
    verdictData = {
      verdict: `Analysis complete. Primary areas of concern: ${
        Object.entries(analyses)
          .filter(([, v]) => v.verdict === 'likely_cause')
          .map(([k]) => k)
          .join(', ') || 'none identified'
      }. Review individual findings above for specific fixes.`,
      rerun_constraints: {
        hook_type:    body.client_context.top_hook_types[0] ?? 'curiosity',
        format:       body.client_context.best_format,
        posting_time: body.client_context.best_posting_time,
        cta_style:    'low-friction',
      },
    }
  }

  const diagnosis: PostMortemDiagnosis = {
    session_name:    body.session_id ?? 'Unknown Session',
    platform:        body.session_data.platform,
    published_at:    body.session_data.publish_time,
    engagement_rate: body.performance.engagement_rate,
    vs_client_avg:   body.performance.vs_client_avg,
    analyses,
    verdict:          verdictData.verdict,
    rerun_constraints: verdictData.rerun_constraints,
  }

  return NextResponse.json(diagnosis)
}
