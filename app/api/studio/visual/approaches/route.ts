import { NextRequest, NextResponse } from 'next/server'
import { anthropic, AI_MODELS } from '@/lib/ai-client'
import { geminiJson } from '@/lib/gemini'
import type { VisualApproach, VisualInputs } from '@/lib/studio-types'

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

  return `BRIEF:
Platform: ${inputs.platform} | Format: ${inputs.format} | Length: ${inputs.length}
Objective: ${inputs.objective}
Target Audience: ${inputs.audience}
Core Message: ${inputs.core_message}
Vibe/Tone: ${inputs.vibe}
CTA: ${inputs.cta_type}
${inputs.additional_notes ? `Additional Notes: ${inputs.additional_notes}` : ''}

Generate exactly 3 distinct creative video approaches for this brief. Each approach must use a genuinely different story structure, hook type, and emotional journey. A viewer watching all 3 should feel they are three completely different creative treatments of the same brief.

APPROACH 1 — PROVEN: Follow the Social Media AD Structure precisely: Call out the pain point → Make it relatable → Offer a shift in perspective → Introduce the product/solution → Stack social proof and urgency. Safe, conversion-optimized, high-performing.

APPROACH 2 — PATTERN INTERRUPT: Subvert the expected format entirely. Open with something visually or conceptually unexpected that forces the viewer to stop scrolling. Challenge a belief the audience holds. Use a format that feels categorically different from standard ads in this space. Bold score must be 7+.

APPROACH 3 — CINEMATIC: Pure emotion and visual storytelling. No hard sell in the traditional sense. Build brand world and feeling first. The viewer feels something deeply before they think anything commercial. This approach would win a creative award.

Scene count for ${inputs.length}: ${sceneCount} scenes.

Output ONLY valid JSON, no markdown, no explanation:
{
  "approaches": [
    {
      "id": "proven",
      "name": "3-word max approach name",
      "tagline": "one punchy line describing this approach",
      "narrative_arc": "name the arc e.g. Pain to Relief | Shock to Solution | Silent Transformation",
      "hook_type": "name the specific hook type used in the opening",
      "hook_moment": "describe exactly what happens visually in the first 2-3 seconds — be specific",
      "vibe": "one word: cinematic | dark | luxury | funny | emotional | energetic | mysterious | warm",
      "emotional_journey": "describe the emotional arc from scene 1 to final scene in one sentence",
      "scene_structure": ["Scene 1 (Xs): HOOK — brief description", "Scene 2 (Xs): AGITATE — ...", "..."],
      "why_it_works": "name one specific psychological principle and explain exactly how it applies here",
      "boldness": 6,
      "best_for": "one sentence on what this approach excels at"
    },
    {
      "id": "bold",
      ...approach 2...
    },
    {
      "id": "cinematic",
      ...approach 3...
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
        max_tokens: 2500,
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
        { temperature: 0.8, maxOutputTokens: 2500 },
      )
      approaches = parsed.approaches
    }

    return NextResponse.json({ approaches })
  } catch (err) {
    console.error('[visual/approaches] Generation failed:', err)
    return NextResponse.json({ error: 'Failed to generate approaches' }, { status: 500 })
  }
}
