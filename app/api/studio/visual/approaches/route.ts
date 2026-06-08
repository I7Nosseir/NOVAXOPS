import { NextRequest, NextResponse } from 'next/server'
import { anthropic, AI_MODELS } from '@/lib/ai-client'
import { geminiJson } from '@/lib/gemini'
import type { VisualApproach, VisualInputs } from '@/lib/studio-types'

export const maxDuration = 60

const SYSTEM = `You are a world-class creative director and AI video production expert.
You produce cinematic, high-impact video content using AI tools including Midjourney, Seedream 4.5, Nanobanana Pro for images, and Kling, Higgsfield, Veo3 for video generation.
You have mastered the full AI video creation workflow: Concept → Script → Image prompts → Video prompts → Post-production.
You understand these proven storytelling frameworks:
- Social Media AD Structure: Call out pain → Make it relatable → Offer a shift → Introduce solution → Stack social proof + urgency
- Problem → Agitation → Solution (PAS)
- Hook → Story → CTA
- Cinematic narrative arcs (Setup → Rising Action → Climax → Resolution)
- Transformation arc (Before → During → After)
No emojis in output.`

function buildApproachesPrompt(inputs: VisualInputs): string {
  const sceneCount = inputs.length === '15s' ? '3-4'
    : inputs.length === '30s' ? '5-7'
    : inputs.length === '60s' ? '8-12'
    : '12-16'

  return `You are a world-class creative director choosing the strategic approach before production begins. Three approaches, each a genuinely different creative treatment.

BRIEF:
Platform: ${inputs.platform} | Format: ${inputs.format} | Length: ${inputs.length}
Objective: ${inputs.objective}
Target Audience: ${inputs.audience}
Core Message: ${inputs.core_message}
Vibe/Tone: ${inputs.vibe}
CTA: ${inputs.cta_type}
${inputs.additional_notes ? `Additional Notes: ${inputs.additional_notes}` : ''}

The test for "genuinely different approaches": A client should be able to pick one and reject the other two because they are categorically different creative directions — not variations of the same idea.

APPROACH 1 — PROVEN CONVERSION:
Structure: Call out the pain point → Make it relatable (the audience nods) → Offer a perspective shift → Introduce the solution → Stack social proof → Build urgency
This approach optimizes for conversion above all else. Safe, battle-tested, high-ROI.
Hook requirement: The opening must name the pain so specifically that the audience thinks "this is about me."
What makes this approach specific to THIS brief: the pain point named in the hook must be the EXACT tension of this particular audience — not a generic pain.

APPROACH 2 — PATTERN INTERRUPT:
This approach must be genuinely unexpected. Not "more creative than approach 1" — categorically different in structure.
Rules for approach 2:
- The opening 2 seconds must be something this ${inputs.platform} audience has not seen in this category
- It must challenge something the audience believes or takes for granted
- The hook must create productive discomfort — the audience watches because they're slightly destabilized
- Bold score must be 8+. If the bold score is lower, the approach is not disruptive enough.
- What makes approach 2 fail: being "edgy for its own sake" without a clear strategic reason. The disruption must serve the core message, not distract from it.

APPROACH 3 — CINEMATIC / EMOTIONAL:
This approach leads with emotion and brand world. No explicit product sell until the audience has already felt something.
Rules for approach 3:
- The viewer should feel before they think. The brand message should arrive as a confirmation of an emotion already created.
- Visual storytelling dominates — the structure lives in image sequences, not dialogue
- This approach would be entered in a creative awards competition, not a performance marketing competition
- Bold score: 7–9

Scene count for ${inputs.length}: ${sceneCount} scenes.

Output ONLY valid JSON, no markdown:
{
  "approaches": [
    {
      "id": "proven",
      "name": "2-3 word name (not 'Proven' — give it a real name)",
      "tagline": "One punchy line — what makes this approach's creative direction compelling",
      "narrative_arc": "Name the arc: e.g. 'Pain → Recognition → Shift → Solution → Proof'",
      "hook_type": "The specific hook type: curiosity | contradiction | fear | social_proof | identity | authority | transformation | shock",
      "hook_moment": "Describe exactly what happens visually in the opening 2–3 seconds. Be specific: subject, action, camera angle.",
      "vibe": "One word: cinematic | dark | luxury | funny | emotional | energetic | mysterious | warm | urgent | raw",
      "emotional_journey": "One sentence: the emotional arc from first frame to last — what the viewer feels at each major beat",
      "scene_structure": ["Scene 1 (Xs): NARRATIVE_PURPOSE — exact description of what happens visually and what line is spoken", "Scene 2 (Xs): NARRATIVE_PURPOSE — ...", "Scene 3 (Xs): NARRATIVE_PURPOSE — ...", "Scene N (Xs): CTA — ..."],
      "why_it_works": "Name one specific psychological principle (e.g. Social proof, Loss aversion, Identity-based motivation, Peak-end rule) and explain exactly how it operates in THIS brief",
      "boldness": 6,
      "best_for": "One sentence: the specific performance goal this approach is optimized for"
    },
    {
      "id": "bold",
      "name": "...",
      "tagline": "...",
      "narrative_arc": "...",
      "hook_type": "...",
      "hook_moment": "...",
      "vibe": "...",
      "emotional_journey": "...",
      "scene_structure": ["..."],
      "why_it_works": "...",
      "boldness": 8,
      "best_for": "..."
    },
    {
      "id": "cinematic",
      "name": "...",
      "tagline": "...",
      "narrative_arc": "...",
      "hook_type": "...",
      "hook_moment": "...",
      "vibe": "...",
      "emotional_journey": "...",
      "scene_structure": ["..."],
      "why_it_works": "...",
      "boldness": 7,
      "best_for": "..."
    }
  ]
}`
}

export async function POST(req: NextRequest) {
  let inputs: VisualInputs
  try {
    inputs = await req.json() as VisualInputs
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!inputs.platform || !inputs.length || !inputs.audience || !inputs.core_message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const prompt = buildApproachesPrompt(inputs)

  // Try Claude first, fall back to Gemini
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY

  try {
    let approaches: VisualApproach[]

    if (hasAnthropic) {
      const response = await anthropic.messages.create({
        model: AI_MODELS.primary,
        max_tokens: 8192,
        temperature: 0.8,
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      })
      const raw = response.content[0].type === 'text' ? response.content[0].text : ''
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
      const parsed = JSON.parse(cleaned) as { approaches: VisualApproach[] }
      approaches = parsed.approaches
    } else {
      const parsed = await geminiJson<{ approaches: VisualApproach[] }>(
        prompt,
        SYSTEM,
        { temperature: 0.8, maxOutputTokens: 8192 },
      )
      approaches = parsed.approaches
    }

    return NextResponse.json({ approaches })
  } catch (err) {
    console.error('[visual/approaches] Generation failed:', err)
    return NextResponse.json({ error: 'Failed to generate approaches' }, { status: 500 })
  }
}
