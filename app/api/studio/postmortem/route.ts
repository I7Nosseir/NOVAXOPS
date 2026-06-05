// ============================================================
// POST /api/studio/postmortem
// 4 parallel Gemini analyses + 1 Gemini verdict.
// Returns PostMortemDiagnosis.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { geminiJson } from '@/lib/gemini'
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

// ─── AI analysis helpers ──────────────────────────────────────

async function analyzeHook(
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

  return geminiJson<PostMortemAnalysis>(prompt, undefined, {
    temperature:     0.3,
    maxOutputTokens: 200,
  })
}

async function analyzeFormat(
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

  return geminiJson<PostMortemAnalysis>(prompt, undefined, {
    temperature:     0.3,
    maxOutputTokens: 200,
  })
}

async function analyzeTiming(
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

  return geminiJson<PostMortemAnalysis>(prompt, undefined, {
    temperature:     0.3,
    maxOutputTokens: 200,
  })
}

async function analyzeCaption(
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

  return geminiJson<PostMortemAnalysis>(prompt, undefined, {
    temperature:     0.3,
    maxOutputTokens: 200,
  })
}

async function buildVerdict(
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

  return geminiJson<{ verdict: string; rerun_constraints: Record<string, string> }>(
    prompt,
    undefined,
    { temperature: 0.3, maxOutputTokens: 400 },
  )
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

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'AI provider not configured' }, { status: 503 })
  }

  // ── 4 parallel Gemini analyses ─────────────────────────────
  const [hookResult, formatResult, timingResult, captionResult] = await Promise.all([
    analyzeHook(body.session_data, body.performance, body.client_context).catch(
      (): PostMortemAnalysis => ({
        verdict: 'not_issue',
        finding: 'Hook analysis unavailable — API error.',
      }),
    ),
    analyzeFormat(body.session_data, body.performance, body.client_context).catch(
      (): PostMortemAnalysis => ({
        verdict: 'not_issue',
        finding: 'Format analysis unavailable — API error.',
      }),
    ),
    analyzeTiming(body.session_data, body.performance, body.client_context).catch(
      (): PostMortemAnalysis => ({
        verdict: 'not_issue',
        finding: 'Timing analysis unavailable — API error.',
      }),
    ),
    analyzeCaption(body.session_data, body.performance, body.client_context).catch(
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

  // ── Gemini verdict ─────────────────────────────────────────
  let verdictData: { verdict: string; rerun_constraints: Record<string, string> }
  try {
    verdictData = await buildVerdict(analyses, body)
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
