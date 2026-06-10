import { NextRequest, NextResponse } from 'next/server'
import { anthropic, AI_MODELS } from '@/lib/ai-client'
import { geminiJson } from '@/lib/gemini'
import type { VisualApproach, VisualDocument, VisualInputs } from '@/lib/studio-types'
import { aiGuard } from '@/lib/ai-guard'

export const maxDuration = 120

const SYSTEM = `You are a world-class AI video director and prompt engineer.
You produce cinematic, hyper-realistic video content using AI image tools (Midjourney, Seedream 4.5, Nanobanana Pro) and AI video tools (Kling, Higgsfield, Veo3).

The key to a cohesive AI video — one that looks like a real production and not a random AI collage — is a Visual Anchor: a shared block of descriptors applied verbatim to every single image prompt. Every scene must begin with this anchor, varying only the camera angle, action, and composition.

You understand these core prompt engineering principles:
- Purpose + Role + Structure + Style/Tone + Details/Constraints = a strong prompt
- Visual direction: film references, lighting setups, camera language, composition
- For Kling/Higgsfield: describe motion specifically (dolly in, slow pan, gentle zoom out, tilt up, static with subtle motion)
- Consistency: same outfit, same character features, same lighting family across all scenes
- No text, no typography must appear in image generation prompts

You are also a master of storytelling structures:
- Social Media AD: Call out pain → Relatable → Shift → Solution → Social Proof + Urgency
- Problem → Agitation → Solution (PAS)
- Cinematic narrative, StoryBrand arc
- Boss Brief: direct, evidence-based, no jargon, no passive voice, under 20 words per block

No emojis anywhere in your output.`

function buildGeneratePrompt(inputs: VisualInputs, approach: VisualApproach): string {
  return `BRIEF:
Platform: ${inputs.platform} | Format: ${inputs.format} | Length: ${inputs.length}
Objective: ${inputs.objective}
Target Audience: ${inputs.audience}
Core Message: ${inputs.core_message}
Vibe/Tone: ${inputs.vibe}
CTA: ${inputs.cta_type}
${inputs.additional_notes ? `Additional Notes: ${inputs.additional_notes}` : ''}

SELECTED APPROACH:
Name: ${approach.name}
Narrative Arc: ${approach.narrative_arc}
Hook Type: ${approach.hook_type}
Hook Moment: ${approach.hook_moment}
Emotional Journey: ${approach.emotional_journey}
Why It Works: ${approach.why_it_works}
Scene Structure:
${approach.scene_structure.map((s, i) => `${i + 1}. ${s}`).join('\n')}

TASK — Generate the complete production package in 4 steps:

STEP 1 — VISUAL ANCHOR
The Visual Anchor is the shared DNA injected into EVERY image prompt verbatim.
It must be specific enough that every scene looks like it was shot in the same production session.

Define:
- style: cinematography approach + visual reference (e.g. "shot on ARRI Alexa, anamorphic lens, cinematic film look with subtle lens flares" or "luxury commercial photography, clean studio setup, editorial grade")
- pov: "cinematic" (third-person) or "first_person" (POV/hands shots)
- subject: if character → gender, age range, exact appearance + clothing. If product → exact product description. Be specific enough to generate consistently.
- environment: exact location/set + key background elements that appear in every scene
- lighting: the primary lighting setup that stays consistent (e.g. "soft golden hour backlight, minimal shadow, warm diffused fill" or "high-contrast studio lighting, dramatic shadows, black background")
- color_treatment: color palette and grade (e.g. "muted warm earth tones, desaturated shadows, filmic grain" or "cool teal-blue grade, high clarity, minimal grain")
- technical: "${inputs.format}, photorealistic, ultra-detailed, 8K resolution, no text, no typography, no words, no letters"
- full_anchor_text: Combine ALL elements above into ONE single cohesive anchor string (40-80 words) that starts every image prompt. Must end with "no text, no typography, no words, no letters"

STEP 2 — SCENE-BY-SCENE PRODUCTION
Generate exactly ${approach.scene_structure.length} scenes following the approach's scene structure precisely.

For each scene, produce:
- scene_number: integer starting at 1
- duration: e.g. "5s"
- narrative_purpose: one of HOOK | AGITATE | SHIFT | SOLUTION | SOCIAL_PROOF | CTA | BUILDUP | REVEAL
- voiceover: the exact spoken line for this scene, or null if silent
- image_prompt: BEGIN with the full_anchor_text verbatim, then add: [specific camera angle], [exact action/composition for this scene], [scene-specific emotion conveyed by the subject], [any justified lighting or environment variation]. Must be paste-ready for Midjourney or Seedream.
- video_prompt: Written for Kling or Higgsfield. Describe: camera movement (dolly in/out, pan left/right, gentle zoom, tilt up/down, static), subject motion, speed (slow/medium/fast), and one mood phrase. Include "subtle motion" and reference the color treatment. 30-50 words max. Paste-ready.
- camera_angle: one of: extreme close-up | close-up | medium shot | medium wide | wide shot | overhead | low angle | eye level | POV
- emotion_direction: what should the viewer feel at this exact moment (one short sentence)
- continuity_note: what visual element or motion bridges this scene to the next

CRITICAL: Every image_prompt MUST start with the full_anchor_text verbatim — copy it exactly.

STEP 3 — PRODUCTION NOTES
- hook_checklist: grabs_instantly (bool), visually_disruptive (bool), hook_format_used (name the format), note (one sentence explaining why the hook works or what to watch for)
- platform_notes: aspect_ratio ("${inputs.format}"), pacing ("fast-cut" | "medium" | "slow-burn"), thumbnail_scene (scene number that makes the strongest thumbnail), cta_placement (scene number + how the CTA is delivered)
- sound_direction: music_mood (specific descriptor e.g. "dark ambient with building synth drop at 15s", not just "intense"), sfx_moments (array of "Scene X: sound description" for scenes needing SFX), voiceover_tone (describe pace + character e.g. "slow, low-pitched, authoritative — like a documentary narrator")
- upscale_priority: array of strings naming which scenes to upscale first and why (e.g. "Scene 1 — hook frame, defines the tone of the whole video")
- editing_notes: array of transition suggestions between scenes (e.g. "Scenes 1-2: hard cut for impact", "Scenes 4-5: slow dissolve to soften the emotional shift")

STEP 4 — BOSS BRIEF
5-block Boss Brief. One sentence per block. No jargon. No passive voice. Max 20 words per block.
- what_we_made: describe the video plainly
- why_it_works: cite the psychological principle used and the evidence from this brief
- the_one_thing: the single most important creative decision in this package
- do_this_now: the first practical step the team should take today
- watch_out_for: the one specific risk that could hurt this video if ignored (omit this key entirely if no meaningful risk exists)

Output ONLY valid JSON, no markdown, no explanation outside the JSON:
{
  "anchor": {
    "style": "...",
    "pov": "cinematic",
    "subject": "...",
    "environment": "...",
    "lighting": "...",
    "color_treatment": "...",
    "technical": "${inputs.format}, photorealistic, ultra-detailed, 8K resolution, no text, no typography, no words, no letters",
    "full_anchor_text": "complete 40-80 word anchor string..."
  },
  "scenes": [
    {
      "scene_number": 1,
      "duration": "5s",
      "narrative_purpose": "HOOK",
      "voiceover": "line or null",
      "image_prompt": "[full_anchor_text verbatim] [camera angle] [action] [emotion]",
      "video_prompt": "slow dolly in toward subject, subject turns to camera, subtle motion, muted warm tones, slow pace",
      "camera_angle": "medium shot",
      "emotion_direction": "...",
      "continuity_note": "..."
    }
  ],
  "production_notes": {
    "hook_checklist": {
      "grabs_instantly": true,
      "visually_disruptive": true,
      "hook_format_used": "...",
      "note": "..."
    },
    "platform_notes": {
      "aspect_ratio": "${inputs.format}",
      "pacing": "fast-cut",
      "thumbnail_scene": 1,
      "cta_placement": "Scene X, spoken line + visual CTA"
    },
    "sound_direction": {
      "music_mood": "...",
      "sfx_moments": ["Scene 2: ...", "Scene 5: ..."],
      "voiceover_tone": "..."
    },
    "upscale_priority": ["Scene 1 — hook frame, critical for stopping power", "Scene X — ..."],
    "editing_notes": ["Scenes 1-2: hard cut", "Scenes 3-4: smooth dissolve"]
  },
  "boss_brief": {
    "what_we_made": "...",
    "why_it_works": "...",
    "the_one_thing": "...",
    "do_this_now": "..."
  }
}`
}

export async function POST(req: NextRequest) {
  const guard = await aiGuard()
  if (guard) return guard

  let body: { inputs: VisualInputs; approach: VisualApproach }
  try {
    body = await req.json() as { inputs: VisualInputs; approach: VisualApproach }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { inputs, approach } = body
  if (!inputs || !approach) {
    return NextResponse.json({ error: 'Missing inputs or approach' }, { status: 400 })
  }

  const prompt = buildGeneratePrompt(inputs, approach)
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY

  try {
    let doc: VisualDocument

    if (hasAnthropic) {
      const response = await anthropic.messages.create({
        model: AI_MODELS.primary,
        max_tokens: 16000,
        temperature: 0.7,
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      })
      const raw = response.content[0].type === 'text' ? response.content[0].text : ''
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
      doc = JSON.parse(cleaned) as VisualDocument
    } else {
      doc = await geminiJson<VisualDocument>(
        prompt,
        SYSTEM,
        { temperature: 0.7, maxOutputTokens: 16000 },
      )
    }

    return NextResponse.json({ document: doc })
  } catch (err) {
    console.error('[visual/generate] Generation failed:', err)
    return NextResponse.json({ error: 'Failed to generate production package' }, { status: 500 })
  }
}
