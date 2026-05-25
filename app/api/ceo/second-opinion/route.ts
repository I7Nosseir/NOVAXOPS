import { NextRequest, NextResponse } from 'next/server'

const GEMINI_MODEL = 'gemini-2.5-flash-preview-05-20'

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY!
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.status.toString())
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

interface SecondOpinionRequest {
  tool: 'conflict_resolution' | 'decision_validator' | 'pitch_reviewer' | 'conversation_preparer'
  input: string
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 })
  }

  let body: SecondOpinionRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { tool, input } = body

  if (!input?.trim()) {
    return NextResponse.json({ error: 'Input is required.' }, { status: 400 })
  }

  let prompt = ''

  switch (tool) {
    case 'conflict_resolution':
      prompt = `You are an executive coach and organisational psychologist with 20+ years advising creative agency CEOs through interpersonal and professional conflicts. You apply principled negotiation theory (Fisher & Ury), attachment theory, and systems thinking to navigate complex relationship dynamics.

CONFLICT SITUATION:
${input}

Analyse this conflict and provide a structured resolution path.

**ROOT CAUSE ANALYSIS**
What is the actual conflict beneath the surface-level conflict? Apply the iceberg model: what is stated versus what is at stake for each party? Identify whether this is a conflict of interests, values, needs, or perceptions — and why the distinction matters for resolution.

**STAKEHOLDER POSITIONS vs. INTERESTS**
For each party involved: What is their stated position? What is their underlying interest (what they actually need, not what they say they want)? Where do the underlying interests overlap? This is the resolution zone.

**RESOLUTION PATHWAY**
A step-by-step approach, in priority order:
Step 1: [The first action the CEO should take, with precise language to use]
Step 2: [The structural change or conversation that follows]
Step 3: [How to close and lock in the resolution]

**SCRIPTS FOR KEY MOMENTS**
Write the opening line for the most critical conversation in this resolution — the line that opens the space for dialogue without entrenching positions. Then write the line that closes the conversation with a clear commitment from all parties.

**WHAT NOT TO DO**
The two most common mistakes leaders make in this type of conflict that would make it significantly worse. Be specific to this situation.

**SYSTEMIC SIGNAL**
Is this conflict a symptom of a deeper structural issue in the organisation or relationship? If yes, what is it, and what single change would reduce the probability of this conflict recurring?

Rules: No hashtags. No emojis. Direct, practitioner-grade advice — not life-coaching platitudes.`
      break

    case 'decision_validator':
      prompt = `You are a strategic advisor who has served as a non-executive director and strategic sounding board for agency CEOs for 20+ years. Your role is to pressure-test decisions before they are made — to be the devil's advocate the CEO does not have in the room.

DECISION UNDER REVIEW:
${input}

Apply rigorous decision analysis. Your job is not to validate — it is to find the flaws and stress-test the logic before it costs money, relationships, or reputation.

**DECISION SUMMARY**
Restate the decision in precise terms. What exactly is being decided, what are the alternatives not being chosen, and what is the implicit theory of change (if X, then Y) embedded in this decision?

**DEVIL'S ADVOCATE CASE**
The strongest possible argument against this decision. Make it uncomfortable. What would a smart, well-informed person who opposes this decision say? Do not soften it.

**ASSUMPTION AUDIT**
List every assumption this decision depends on being true. For each assumption: rate it as Verified / Plausible / Unverified / Risky. The decision's soundness is only as strong as its weakest unverified assumption.

**DOWNSIDE SCENARIO ANALYSIS**
If this decision is wrong, what are the three most likely failure modes? For each: probability (Low / Medium / High), impact severity (Minor / Significant / Severe), and the early warning signal that would confirm this failure mode is occurring.

**THE RECOMMENDATION**
After stress-testing: Proceed / Proceed with modifications / Delay / Do not proceed. One paragraph explaining the recommendation with the single most important reason. No hedging.

**WHAT WOULD MAKE THIS DECISION STRONGER**
Two specific changes — to the decision itself, or to the process of implementing it — that would materially reduce the risk profile without abandoning the strategic intent.

Rules: No hashtags. No emojis. Be rigorous. The CEO is paying for intellectual honesty, not agreement.`
      break

    case 'pitch_reviewer':
      prompt = `You are a business development director and pitch coach who has reviewed hundreds of agency pitches and won significant accounts. You understand both what clients think they want and what actually wins.

PITCH CONTENT:
${input}

Conduct a full pitch audit with the precision of a client-side evaluator who has seen every version of every pitch.

**PITCH CLARITY SCORE: [X/10]**
Can a busy client executive, reading this once, immediately understand what you do, why you are uniquely qualified for this brief, and what specific outcomes they will get? Score 1-10, then explain exactly what creates ambiguity.

**STRATEGIC STRENGTHS**
What is genuinely compelling about this pitch? Be specific — not "strong positioning" but the exact lines or ideas that would make a client lean forward. Maximum three strengths.

**CRITICAL GAPS**
What is missing that a client will notice and a competitor will likely have? Be specific about the gap and the risk it creates for the pitch outcome.

**OBJECTION FORECAST**
The three objections a well-prepared client evaluation panel will raise during or after reading this pitch. For each: state the objection precisely, rate the probability it will be raised (Low / Medium / High), and provide the response that would neutralise it.

**WIN PROBABILITY ESTIMATE: [X%]**
A calibrated probability that this pitch, as written, wins the account. The number should reflect the quality of what is on the page — not optimism. Explain the primary factor that would increase or decrease this estimate by 15+ percentage points.

**THE SINGLE MOST IMPORTANT CHANGE**
If only one thing can be changed before submission, what is it? Be precise about what to change, what to write instead, and why this change has the highest expected impact on the win probability.

Rules: No hashtags. No emojis. Client-grade directness — not agency-internal cheerleading.`
      break

    case 'conversation_preparer':
      prompt = `You are an executive coach who specialises in preparing CEOs and senior leaders for high-stakes conversations. You have coached leaders through client exits, team restructurings, performance conversations, partnership breakdowns, and salary negotiations. You believe preparation is the difference between a conversation that resolves and one that escalates.

CONVERSATION CONTEXT:
${input}

Prepare a complete playbook for this conversation.

**CONVERSATION OBJECTIVE**
In one sentence: what does a successful outcome of this conversation look like? What is the minimum acceptable outcome? What is the ceiling?

**EMOTIONAL LANDSCAPE**
What emotional state is the other party likely to be in when this conversation begins? What emotional triggers should the CEO avoid activating? What psychological need (recognition, autonomy, fairness, security) must be addressed for this conversation to succeed?

**HOW TO OPEN**
Write the exact opening sentence. Not a general approach — the specific words to say in the first 15 seconds. This sentence must: acknowledge reality, signal respect, and create space for dialogue.

What to say immediately after the opening, in the first 60 seconds, to establish the right frame before diving into the substance.

**WHAT TO AVOID**
Three specific phrases, approaches, or topics that would derail this conversation. For each: what the CEO might be tempted to say, why it would backfire, and the alternative.

**NAVIGATING RESISTANCE**
If the other party becomes defensive or dismissive, write the specific pivot sentence that de-escalates without conceding the CEO's position.

**HOW TO CLOSE**
The closing sequence: how to summarise what was agreed, how to establish the next step with accountability, and how to end the conversation so both parties leave feeling the relationship is intact.

**THE PSYCHOLOGICAL SUBTEXT**
What the other party really needs to hear from the CEO in this conversation — not the content, but the meta-message. The unspoken thing that, if communicated, will determine whether this conversation lands or not.

Rules: No hashtags. No emojis. Provide specific language, not frameworks. The CEO should be able to read this and feel prepared, not coached.`
      break

    default:
      return NextResponse.json({ error: `Unknown second opinion tool: ${String(tool)}` }, { status: 400 })
  }

  try {
    const result = await callGemini(prompt)
    return NextResponse.json({ result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI generation failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
