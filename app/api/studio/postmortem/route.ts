// ============================================================
// POST /api/studio/postmortem
// 4 parallel Gemini analyses + 1 Gemini verdict.
// Returns PostMortemDiagnosis.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { geminiJson } from '@/lib/gemini'
import type { PostMortemAnalysis, PostMortemDiagnosis } from '@/lib/studio-types'
import { aiGuard } from '@/lib/ai-guard'

export const maxDuration = 60

const HAS_DB = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

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
  const erDelta = perf.vs_client_avg
  const underperformanceDepth = erDelta < -30 ? 'severe underperformance' : erDelta < -15 ? 'moderate underperformance' : 'mild underperformance'

  const prompt = `You are a post-mortem diagnostician. Your job is to identify root causes of social media underperformance with clinical precision — not to be encouraging, not to hedge, not to find silver linings. Find what broke.

HOOK ANALYSIS:
Hook text: "${data.hook_text}"
Hook type: ${data.hook_type}
Platform: ${data.platform}
Result: ${perf.engagement_rate}% engagement rate (${underperformanceDepth} — client avg: ${ctx.avg_er}%)
Performance vs avg: ${erDelta > 0 ? '+' : ''}${erDelta}%
Client's top performing hook types historically: ${ctx.top_hook_types.join(', ')}

DIAGNOSTIC QUESTIONS TO WORK THROUGH:
1. Does the hook type match what this client's audience has proven to respond to? The client's top types are: ${ctx.top_hook_types.join(', ')}. This hook used: ${data.hook_type}.
2. Is the hook text specific enough? Vague hooks ("something exciting is coming") perform worse than specific ones ("I lost $40k doing this") across all platforms.
3. Does the hook match ${data.platform} native behavior? TikTok hooks must land in 1.5s. Instagram hooks need identity signal. LinkedIn hooks need intellectual tension.
4. Is there a pattern interrupt? Does this hook break the visual/verbal pattern of the surrounding feed?
5. Counter-evidence check: Is there any reason the hook type mismatch was NOT the issue? (e.g. low reach would mean the hook never got a chance to underperform — it's a distribution problem, not a hook problem)

VERDICT LOGIC:
- "likely_cause": hook type is NOT in client's top performers AND hook has a specific identifiable weakness AND ER is significantly below avg
- "contributing": hook has a weakness but is not the primary failure point
- "not_issue": hook type matches client's proven types OR there's a distribution/reach issue more plausible as the primary cause

Return ONLY valid JSON:
{"verdict":"likely_cause"|"contributing"|"not_issue","finding":"One specific sentence citing the evidence — name the hook type, the pattern, the specific weakness","fix":"One actionable sentence — what specifically to change about the hook approach next time"}`

  return geminiJson<PostMortemAnalysis>(prompt, undefined, {
    temperature:     0.3,
    maxOutputTokens: 600,
  })
}

async function analyzeFormat(
  data: PostMortemBody['session_data'],
  perf: PostMortemBody['performance'],
  ctx: PostMortemBody['client_context'],
): Promise<PostMortemAnalysis> {
  const prompt = `You are a post-mortem diagnostician. Diagnose format as a cause of underperformance with clinical precision.

FORMAT ANALYSIS:
Format used: ${data.format}
Platform: ${data.platform}
Engagement rate: ${perf.engagement_rate}% (client avg: ${ctx.avg_er}%)
Performance vs avg: ${perf.vs_client_avg > 0 ? '+' : ''}${perf.vs_client_avg}%
Client's best performing format historically: ${ctx.best_format}
Saves: ${perf.saves} (saves indicate whether the content had lasting perceived value)

DIAGNOSTIC QUESTIONS:
1. Format match: Was "${data.format}" the right format for the goal implied by the brief? Some goals (education, tutorials) favor carousel. Some (emotion, personality) favor Reels.
2. Client history: Is "${data.format}" consistent with what this client's audience has proven to favor ("${ctx.best_format}")? If not, is there evidence in the numbers?
3. Platform algorithm: Does ${data.platform}'s current algorithm favor "${data.format}" in this context? (e.g. Instagram still boosts Reels significantly over static for reach)
4. Save rate: Low saves on educational content suggests the format failed to make the content feel reference-worthy. Low saves on emotional content is expected.
5. Counter-evidence: If reach is very low, the format may not have had a fair chance to perform.

VERDICT LOGIC:
- "likely_cause": format does NOT match client's best format AND the goal required a different format AND ER is significantly below avg
- "contributing": format is suboptimal but not the primary cause
- "not_issue": format matches client history OR there's a more significant cause elsewhere

Return ONLY valid JSON:
{"verdict":"likely_cause"|"contributing"|"not_issue","finding":"One specific sentence citing format evidence — name the mismatch or confirm the match","fix":"One specific actionable sentence about format choice for next time"}`

  return geminiJson<PostMortemAnalysis>(prompt, undefined, {
    temperature:     0.3,
    maxOutputTokens: 600,
  })
}

async function analyzeTiming(
  data: PostMortemBody['session_data'],
  perf: PostMortemBody['performance'],
  ctx: PostMortemBody['client_context'],
): Promise<PostMortemAnalysis> {
  const prompt = `You are a post-mortem diagnostician. Diagnose timing as a cause of underperformance.

TIMING ANALYSIS:
Actual publish time: ${data.publish_time}
Client's proven best posting time: ${ctx.best_posting_time}
Platform: ${data.platform}
Engagement rate: ${perf.engagement_rate}% (client avg: ${ctx.avg_er}%)
Performance vs avg: ${perf.vs_client_avg > 0 ? '+' : ''}${perf.vs_client_avg}%
Reach: ${perf.reach}

DIAGNOSTIC QUESTIONS:
1. Time delta: How far off is "${data.publish_time}" from the client's proven window "${ctx.best_posting_time}"? A 2-hour difference matters significantly on Instagram (algorithm gives 30-60min before decay). Less on TikTok (distribution is more algorithmic than chronological).
2. Platform behavior: On ${data.platform}, timing affects early engagement velocity which affects algorithm amplification. Early velocity (first 30min) is disproportionately important.
3. Reach correlation: If reach is low AND timing is off, timing becomes more likely as a cause. If reach is normal but ER is low, timing is less likely to be the culprit.
4. Day-of-week: ${data.publish_time} — was this a peak or off-peak day for this platform and audience?
5. Counter-evidence: On TikTok, timing matters less than content quality. On LinkedIn, the first 2 hours of business day are critical. Context matters.

VERDICT LOGIC:
- "likely_cause": significant time gap from proven window AND reach is lower than normal (distribution was starved)
- "contributing": moderate time gap that may have reduced initial velocity
- "not_issue": timing aligns with proven window OR platform timing impact is minimal (TikTok)

Return ONLY valid JSON:
{"verdict":"likely_cause"|"contributing"|"not_issue","finding":"One specific sentence about the time gap and its likely impact on early velocity","fix":"One specific sentence about when to post this type of content next time"}`

  return geminiJson<PostMortemAnalysis>(prompt, undefined, {
    temperature:     0.3,
    maxOutputTokens: 600,
  })
}

async function analyzeCaption(
  data: PostMortemBody['session_data'],
  perf: PostMortemBody['performance'],
  ctx: PostMortemBody['client_context'],
): Promise<PostMortemAnalysis> {
  const prompt = `You are a post-mortem diagnostician. Diagnose the caption as a cause of underperformance.

CAPTION ANALYSIS:
Caption: "${data.caption}"
Platform: ${data.platform}
Engagement rate: ${perf.engagement_rate}% (client avg: ${ctx.avg_er}%)
Saves: ${perf.saves}

CAPTION DIAGNOSTIC FRAMEWORK — evaluate on all 4 dimensions:
1. Hook continuation: Does the caption's first 125 chars (before "more") continue the energy of the visual hook? Or does it drop the tension and become explanatory?
2. CTA clarity: Is there ONE clear action asked? Two asks produce zero actions. A missing CTA on goal-driven content (saves, shares, comments) is always a miss.
3. Friction: How much effort does the CTA require? "Comment your answer below" is lower friction than "DM us for pricing." Lower friction = higher compliance.
4. Voice consistency: Does the caption sound like the same brand that made the visual? Voice breaks (formal caption on casual visual) reduce trust unconsciously.
5. Length-platform fit: On ${data.platform}, what is the optimal caption length? TikTok captions are often ignored. Instagram captions with real text perform well on educational content. LinkedIn captions need a hook in line 1.

SAVE SIGNAL: ${perf.saves} saves — saves indicate the audience found this reference-worthy. Low saves on educational content suggests the caption failed to frame the value. Low saves on entertainment content is normal.

VERDICT LOGIC:
- "likely_cause": caption has a specific, identifiable flaw (weak CTA, hook continuation failure, voice break) AND saves are low relative to the content type
- "contributing": caption has weaknesses but visual hook failure or format is more likely the primary cause
- "not_issue": caption is technically sound for this platform and content type

Return ONLY valid JSON:
{"verdict":"likely_cause"|"contributing"|"not_issue","finding":"One specific sentence naming the exact caption weakness — cite the specific dimension (hook continuation, CTA, friction, voice, length)","fix":"One specific actionable sentence about what to rewrite and how"}`

  return geminiJson<PostMortemAnalysis>(prompt, undefined, {
    temperature:     0.3,
    maxOutputTokens: 600,
  })
}

async function buildVerdict(
  analyses: PostMortemDiagnosis['analyses'],
  body: PostMortemBody,
): Promise<{ verdict: string; rerun_constraints: Record<string, string> }> {
  const likelyCauses = Object.entries(analyses)
    .filter(([, v]) => v.verdict === 'likely_cause')
    .map(([k, v]) => `${k.toUpperCase()}: ${v.finding}`)
  const contributing = Object.entries(analyses)
    .filter(([, v]) => v.verdict === 'contributing')
    .map(([k, v]) => `${k.toUpperCase()}: ${v.finding}`)

  const prompt = `You are writing the final verdict of a post-mortem diagnosis. You have 4 diagnostic reports. Write the conclusion that a creative director would actually use to brief their team differently next time.

CLIENT: ${body.client_context.client_name}
PLATFORM: ${body.session_data.platform}
RESULT: ${body.performance.engagement_rate}% ER (${body.performance.vs_client_avg > 0 ? '+' : ''}${body.performance.vs_client_avg}% vs avg)
REACH: ${body.performance.reach}

DIAGNOSTIC FINDINGS:
Hook: [${analyses.hook.verdict}] ${analyses.hook.finding}
Format: [${analyses.format.verdict}] ${analyses.format.finding}
Timing: [${analyses.timing.verdict}] ${analyses.timing.finding}
Caption: [${analyses.caption.verdict}] ${analyses.caption.finding}

${likelyCauses.length > 0 ? `PRIMARY CAUSES IDENTIFIED:\n${likelyCauses.join('\n')}` : 'No primary cause was isolated — this may be a compounding effect of multiple contributing factors.'}
${contributing.length > 0 ? `\nCONTRIBUTING FACTORS:\n${contributing.join('\n')}` : ''}

VERDICT RULES:
- 2–3 sentences maximum. One primary cause named. One clear prescription.
- If multiple causes exist, rank them by likely impact percentage (e.g. "60% hook, 30% timing, 10% caption")
- Do not soften. Do not hedge. Do not say "it may have been" — say what it was.
- If reach is the primary problem (very low reach even by client standards), the verdict must name distribution as the issue — not creative execution.

RERUN CONSTRAINTS — if this content were to be rerun with changes, what MUST change?
Provide specific, usable values (not "better hook" — "use curiosity or transformation hook type"):

Return ONLY valid JSON:
{
  "verdict": "2–3 sentences: primary cause identified + impact estimate + what to do differently next time",
  "rerun_constraints": {
    "hook_type": "specific hook type to use",
    "format": "specific format to use",
    "posting_time": "specific time window",
    "cta_style": "specific CTA approach"
  }
}`

  return geminiJson<{ verdict: string; rerun_constraints: Record<string, string> }>(
    prompt,
    undefined,
    { temperature: 0.3, maxOutputTokens: 1200 },
  )
}

// ─── Handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const guard = await aiGuard()
  if (guard) return guard

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
          .join(', ') || 'none isolated — compounding factors likely'
      }. Review individual findings above for specific fixes.`,
      rerun_constraints: {
        hook_type:    body.client_context.top_hook_types[0] ?? 'curiosity',
        format:       body.client_context.best_format,
        posting_time: body.client_context.best_posting_time,
        cta_style:    'low-friction single action',
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

  // Save diagnosis to the studio session when session_id is provided
  if (body.session_id && HAS_DB) {
    const db = adminSupabase()
    const { data: existing } = await db
      .from('studio_sessions')
      .select('outputs')
      .eq('id', body.session_id)
      .single()

    await db.from('studio_sessions').update({
      status: 'complete',
      performance: body.performance,
      outputs: {
        ...(existing?.outputs as Record<string, unknown> ?? {}),
        postmortem: diagnosis,
      },
      updated_at: new Date().toISOString(),
    }).eq('id', body.session_id)
  }

  return NextResponse.json(diagnosis)
}
