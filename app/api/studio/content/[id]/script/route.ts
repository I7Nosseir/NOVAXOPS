import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildClientIntelligenceBlock, buildCompetitorContextBlock, adminSupabase } from '@/lib/client-intelligence'
import { aiGuard } from '@/lib/ai-guard'

export const maxDuration = 120

interface ScriptRequest {
  content_type?: 'reel' | 'carousel' | 'static'
  platform: string
  audience: string
  goal: string
  emotion: string
  cta: string
  brief: string
  hook: string
  hook_type: string
  audience_psychology?: Record<string, unknown>
  trend_intelligence?: Record<string, unknown>
  brand_voice?: string
  key_messages?: string[]
  client_name?: string
  client_id?: string
  language?: string
  dialect?: string
}

function languageInstruction(language: string | undefined, dialect: string | undefined): string {
  if (language !== 'arabic') return ''
  if (dialect === 'saudi') {
    return '\nLANGUAGE: Write the ENTIRE script in Saudi Arabic (اللهجة السعودية). All spoken lines must be in Saudi colloquial Arabic. Visual/direction notes (inside brackets) may stay in English for production clarity.\n'
  }
  return '\nLANGUAGE: Write the ENTIRE script in Egyptian Arabic (اللهجة المصرية / عامية مصرية). All spoken lines must be in Egyptian colloquial Arabic. Visual/direction notes (inside brackets) may stay in English for production clarity.\n'
}

// ── Shared thinking phase ─────────────────────────────────────

function thinkingPhase(d: ScriptRequest, format: 'reel' | 'carousel' | 'static'): string {
  const platformPace = d.platform === 'TikTok' || d.platform === 'Instagram'
    ? '≤12 words per spoken sentence (one breath). Short sentences create rhythm. Long sentences lose mobile viewers.'
    : d.platform === 'LinkedIn'
      ? '≤20 words per sentence. Measured, authoritative. One idea per sentence.'
      : '≤15 words per sentence. Conversational but deliberate.'

  const formatLabel = format === 'reel' ? 'reel script' : format === 'carousel' ? 'carousel deck' : 'static post'

  return `
═══════════════════════════════════════════════════════
THINKING PHASE — Complete this analysis before generating the ${formatLabel}.
These are INTERNAL REASONING STEPS — do NOT include them in the JSON output.
Every word you write below must be earned by reasoning through these questions.
═══════════════════════════════════════════════════════

STEP 1 — HOOK DECONSTRUCTION
Hook text: "${d.hook}"
Hook type: ${d.hook_type}

Answer internally:
• What specific psychological mechanism does this hook trigger? (information gap / status threat / loss aversion / identity challenge / curiosity cascade — be exact)
• What BELIEF does the viewer hold before they see this hook? What does this hook say to that belief?
• How many milliseconds before the viewer decides to keep watching or scroll? What must happen in that window?
• If this hook were bad, what would make it bad? (too generic, no identity signal, no tension) — now verify yours avoids all three.

STEP 2 — AUDIENCE PROFILE (be specific — generic audiences produce generic content)
Platform: ${d.platform} | Audience: ${d.audience} | Goal: ${d.goal}

Answer internally:
• Who SPECIFICALLY stops for this hook? Name them: approximate age, what they do professionally or daily, what they were doing 30 seconds before this video started.
• What do they already believe about the topic of this brief? (${d.brief.slice(0, 80)}...)
• What would make them feel THIS CONTENT WAS MADE FOR ME? Name one specific detail that signals "this person knows my world."
• What would make them feel this is generic? Name two generic traps for this audience and avoid them.

STEP 3 — EMOTIONAL ARC MAPPING (${format === 'reel' ? 'second-by-second' : format === 'carousel' ? 'slide-by-slide' : 'element-by-element'})
Answer internally:
${format === 'reel' ? `• Second 0-3 (HOOK): Viewer's emotional state → what must shift for them to stay?
• Second 3-10 (CONTEXT): What micro-tension is established? What question is now open in their mind?
• Second 10-25 (TENSION): The unresolved feeling — what are they carrying? Why does it hurt to stay unresolved?
• Second 25-50 (VALUE): The insight lands — what shifts in their understanding? What did they not know before?
• Second 50-60 (PAYOFF + CTA): What do they feel now? What do they do next?` : format === 'carousel' ? `• Slide 1: What question does the hook plant? Why does it demand an answer?
• Slide 2: This is the most likely drop-off point. What single insight keeps the swipe going?
• Middle slides: What is the escalating emotional state? Are they increasingly curious, increasingly understood, increasingly challenged?
• Second-to-last slide: The tension must peak here. What is the unresolved thing the reader is carrying?
• Last slide: What is the earned resolution? What do they feel when they've completed the deck?` : `• First 3 seconds: What does the eye land on? What is the immediate emotional response?
• Seconds 3-8: The text overlay registers. What does it say to the viewer's existing belief?
• Caption read: What action does the viewer take? Save? Share? Comment? Why specifically?`}

STEP 4 — THE ONE UNFORGETTABLE ELEMENT
Answer internally:
• If the viewer remembers ONLY ONE THING from this content 24 hours later, what is it? (a line, a visual, a revelation)
• Name the specific shot / slide / element that creates that memory.
• Is it in your plan right now? If not, add it.

STEP 5 — ANTI-PATTERNS (what separates weak from killer)
Answer internally — then make sure none of these appear in your output:
• Generic opener: any version of "Have you ever wondered..." / "In today's world..." / "We all know that..."
• Safe tension: tension that doesn't actually threaten anything the viewer cares about
• Buried payoff: the insight saved for the last 5 seconds instead of building throughout
• Weak CTA: "Follow for more" / "Check out the link" / "What do you think?"
• Over-explanation: explaining what you're about to say before saying it

STEP 7 — CURIOSITY LOOP ARCHITECTURE (most important)
Answer internally:
• What is the SINGLE OPEN QUESTION the hook plants in the viewer's mind? Write the exact question as the viewer would think it.
• Is the answer to that question DELAYED until the PAYOFF section? If it is resolved in the TENSION section, the viewer leaves before the CTA. Move it later.
• What does the viewer think they're getting when they start watching — and is the actual payoff BETTER than what they expected? The best content delivers more than it promises.
• Name the exact line in the script where the curiosity loop CLOSES. That line is the most important line in the entire script. Is it specific enough? A specific number, method, result, or revelation — not a platitude.

STEP 8 — CONTROVERSY + DISCUSSION ENGINEERING
Answer internally:
• Does the TENSION section say something that would divide the audience? Not shock — a genuine position that a smart person could defend from the other side. If everyone in the comments would agree, the content is not controversial enough.
• What specific QUESTION does this content make the viewer want to answer about themselves, their situation, or their opinion? This is what drives comments.
• Does the CTA give the viewer a REASON to share with a specific person? ("Send this to someone who...") The best CTAs activate an existing conversation the viewer is already having.

STEP 9 — REPEATABLE FORMAT ARCHITECTURE
Answer internally:
• What is the STRUCTURAL TEMPLATE of this content? Describe it in one sentence as a format that could run weekly with a different subject.
  Example: "A person reveals one thing they did early in their career that they know is wrong now — and what they'd do instead."
• Give this format a one-line name (e.g., "The Honest Confession", "The Industry Secret", "The Before/After Decision").
• Is this format repeatable? Could you produce 12 pieces with this same structure in this client's niche?

STEP 6 — RHYTHM AND PACING
Platform pacing rule: ${platformPace}
Brand voice: ${d.brand_voice ?? 'not specified'}

Answer internally:
• What is the sentence rhythm pattern of the first 3 lines? (short/long/short? punch/breath/punch?)
• What word opens the first line? It must not be "I", "We", "Are you", or "Have you".
• Where are the deliberate pauses? (After the hook. After the tension peak. Before the CTA.)

═══════════════════════════════════════════════════════
END OF THINKING PHASE — Now write the ${formatLabel}.
Your thinking above must be INVISIBLE in the output but VISIBLE in the quality of every line.
═══════════════════════════════════════════════════════
`
}

// ── Reel prompt ───────────────────────────────────────────────

const REEL_PROMPT = (d: ScriptRequest) => `You are an elite content director. You have directed reels and short-form videos that broke through on every major platform and created genuine cultural moments — not viral for a day, but reference points for years. Your scripts get shot exactly as written because every line has a purpose and every direction is executable.
${languageInstruction(d.language, d.dialect)}

${thinkingPhase(d, 'reel')}

─── BRIEF ────────────────────────────────────────────
BRIEF: ${d.brief}
PLATFORM: ${d.platform}
AUDIENCE: ${d.audience}
GOAL: ${d.goal}
DESIRED EMOTION: ${d.emotion ?? 'not specified'}
CTA GOAL: ${d.cta}
SELECTED HOOK: "${d.hook}" (hook type: ${d.hook_type})
${d.brand_voice ? `BRAND VOICE: ${d.brand_voice}` : ''}
${d.key_messages?.length ? `KEY MESSAGES: ${d.key_messages.join(' | ')}` : ''}
${d.client_name ? `CLIENT: ${d.client_name}` : ''}

${d.audience_psychology ? `AUDIENCE PSYCHOLOGY:
- Identity desires: ${JSON.stringify(d.audience_psychology.identity_desires)}
- Core fears: ${JSON.stringify(d.audience_psychology.core_fears)}
- Emotional triggers: ${JSON.stringify(d.audience_psychology.emotional_triggers)}` : ''}

─── VIRAL CONTENT LAWS (mandatory — all five must be satisfied) ─────────────────
LAW 1 — CURIOSITY FIRST: The HOOK must plant a specific open question that is answered ONLY in the PAYOFF. The viewer must feel that stopping means missing something they specifically want to know. Not "interesting topic" — "specific promised revelation."
LAW 2 — CONTROVERSY DESIGN: The TENSION section must say something that divides the audience. 50% will agree, 50% will push back. Controversy about ideas, not the brand. Productive disagreement drives comments and shares.
LAW 3 — DISCUSSION ENGINEERING: The CTA must ask for the viewer's OWN EXPERIENCE or OPINION on something they disagree about. Not "what do you think?" — a specific question about a choice, memory, or belief. "What did you do differently?" gets 10x more comments than "Thoughts?"
LAW 4 — PRIZE ARCHITECTURE: The PAYOFF must deliver something SPECIFIC — a number, method, result, or revelation the viewer could not have known without watching. Weak: "So stay consistent." Strong: "The exact phrase that doubled their close rate."
LAW 5 — REPEATABLE FORMAT: This content must have a structural template that could run weekly with a different subject. The format is the brand. Build it so 12 more pieces could follow.

─── RETENTION SCIENCE ────────────────────────────────
The first 1.5 seconds is a referendum. The viewer votes "keep watching" or "scroll" before they consciously decide. The hook must force a "keep watching" vote before the brain engages.

RETENTION DEATH ZONES — specific moments where viewers drop and how to survive them:
1. Second 1.5 — "Is this for me?" The first visual frame must answer yes before a word is spoken. The hook line must amplify that answer.
2. Second 8 — "Is this going anywhere?" The CONTEXT section must have planted a tension so specific the viewer physically cannot scroll without feeling they'll miss something.
3. Second 22 — "I've seen this before." The TENSION section must say something the viewer has never heard said out loud. Not counterintuitive for shock — counterintuitive because it's TRUE and the viewer recognizes it.
4. Second 45 — "Get to the point." The VALUE section must lead with the insight in the FIRST sentence, not the last. Every additional sentence must deepen, not repeat.
5. Second 55 — "Here comes the CTA." Kill the predictability. The CTA must feel like the natural thought the viewer was already having — not an ask.

─── SCRIPT STRUCTURE ─────────────────────────────────
One Peak retention framework — six sections, each with one job:

1. HOOK — The selected hook verbatim as the opening line. Do NOT paraphrase. Do NOT soften. Do NOT add context. The hook is the hook.
2. CONTEXT — Establish WHO this is for and WHY it matters RIGHT NOW. 2-3 sentences maximum. No setup fluff. End with an implicit question.
3. TENSION — Deepen the problem, desire, or fear opened in the hook. 3-5 lines. Say the thing no one else in this space is saying out loud. Create productive controversy — a specific position that reasonable people would argue about in the comments. Do NOT resolve the open loop from the hook.
4. VALUE — Deliver the core insight. First sentence = the answer. Then expand. 4-8 lines depending on complexity. Do not bury the payoff.
5. PAYOFF — Close the curiosity loop opened in the hook. Deliver the SPECIFIC revelation, number, method, or result the viewer was promised. This must be CONCRETE — not "remember to be consistent" but "the exact 3-word change that made the difference." This is the prize for watching to the end.
6. CTA — One action. Native to ${d.platform}. Must ask for the viewer's OWN EXPERIENCE or OPINION on something specific — not "follow for more." Frame it as: "What was your version of this?" or "Send this to someone who [specific situation]." The best CTAs activate a conversation the viewer is already having with someone in their life.

─── LINE-LEVEL RULES ─────────────────────────────────
${d.platform === 'TikTok' || d.platform === 'Instagram' ? `
- Every spoken line: ≤12 words. One thought. One breath.
- Every [EMPHASIS] line: ≤7 words. Should land like a punch.
- Between TENSION lines: shorter is harder. 5 words > 10 words.
- No line should repeat information from the previous line — every line must ADVANCE.
- Rhythm test: read the HOOK section aloud at pace. If you have to rush, the lines are too long.` : `
- Lines up to 15 words. One idea per line.
- [EMPHASIS] lines: ≤10 words.
- No filler transitions. "And", "So", "But" start lines only if they create rhythm.`}

─── VISUAL DIRECTION RULES ───────────────────────────
- [VISUAL: ...] — Camera direction. Be specific: "tight close-up on hands turning a page" not "close-up of hands."
- [B-ROLL: ...] — Cutaway. Name the specific shot: "overhead shot of unopened laptop at 7am" not "desk scene."
- [EMPHASIS] — One-second hold. The camera stops. The viewer's brain catches up.
- [SOUND: ...] — Name the emotional shift in sound: "music drops to silence" or "single piano note under delivery."
- [PAUSE] — Deliberate silence before a reveal. Use once, maximum twice. Each use devalues the next.

Director's intent rule: every visual_note must answer two questions simultaneously — (1) what does the camera do, and (2) what does the viewer FEEL in their body at that moment.

─── OUTPUT FORMAT ────────────────────────────────────
Return ONLY valid JSON — no markdown, no explanation:
{
  "script_sections": [
    {
      "section": "HOOK",
      "lines": ["exact spoken line — verbatim from hook"],
      "visual_note": "What the camera does AND what the viewer feels in their body in this moment",
      "duration_estimate": "0:00–0:03",
      "director_note": "The single most important thing to get right in this section — one sentence, production-specific"
    },
    {
      "section": "CONTEXT",
      "lines": ["line 1", "line 2", "line 3 maximum"],
      "visual_note": "...",
      "duration_estimate": "0:03–0:10",
      "director_note": "..."
    },
    {
      "section": "TENSION",
      "lines": ["line 1", "line 2", "line 3", "line 4 if needed", "line 5 maximum"],
      "visual_note": "...",
      "duration_estimate": "0:10–0:25",
      "director_note": "The thing this section says that no other creator in this space is saying — name it explicitly"
    },
    {
      "section": "VALUE",
      "lines": ["lead with the insight — first line is the answer", "line 2 deepens", "line 3 applies", "line 4-8 if complexity demands"],
      "visual_note": "...",
      "duration_estimate": "0:25–0:50",
      "director_note": "..."
    },
    {
      "section": "PAYOFF",
      "lines": ["emotional resolution line 1", "transformation confirmed line 2"],
      "visual_note": "...",
      "duration_estimate": "0:50–0:57",
      "director_note": "How this payoff answers the specific emotional promise of the hook — not the topic, the emotion"
    },
    {
      "section": "CTA",
      "lines": ["one action — native to ${d.platform}, frictionless, sounds like the viewer's own thought"],
      "visual_note": "...",
      "duration_estimate": "0:57–1:00",
      "director_note": "..."
    }
  ],
  "total_duration": "~60 seconds",
  "brand_compliance_notes": "Any brand voice or messaging flags — specific, not generic",
  "production_difficulty": "Low | Medium | High",
  "key_broll_list": ["Most important cutaway — specific shot", "cutaway 2", "cutaway 3", "cutaway 4 if critical"],
  "caption_preview": "First 150 chars — must continue the hook's energy, not summarize the video",
  "retention_arc": "One paragraph: the emotional journey second by second — what the viewer feels at each stage",
  "strongest_line": "The single line in this script most likely to be quoted or remembered — and why",
  "drop_risk_moment": "The exact moment this script is most likely to lose the viewer, and the one thing that prevents it",
  "open_loop_promise": "The exact question opened in the hook that is only answered in the payoff — written as the viewer would think it",
  "controversy_angle": "The specific claim in the TENSION section that will divide opinion in the comments — and why it generates two defensible sides",
  "repeatable_format": "One-line format name and template: [format name] — [structure that could run weekly with a different subject]"
}

Rules: no hashtags, no emojis in any field. Return ONLY valid JSON.`

// ── Carousel prompt ───────────────────────────────────────────

const CAROUSEL_PROMPT = (d: ScriptRequest) => `You are creating a high-performing carousel post for ${d.platform}. You have studied every carousel format that achieved massive saves and shares — and you know the exact structural mechanics behind each one. A carousel is not a list. It is a tension architecture that earns each swipe.
${languageInstruction(d.language, d.dialect)}

${thinkingPhase(d, 'carousel')}

─── BRIEF ────────────────────────────────────────────
BRIEF: ${d.brief}
HOOK (Cover Slide): "${d.hook}"
GOAL: ${d.goal}
AUDIENCE: ${d.audience}
${d.brand_voice ? `BRAND VOICE: ${d.brand_voice}` : ''}
${d.key_messages?.length ? `KEY MESSAGES: ${d.key_messages.join(' | ')}` : ''}
${d.client_name ? `CLIENT: ${d.client_name}` : ''}

─── VIRAL CONTENT LAWS (mandatory — all five must be satisfied) ─────────────────
LAW 1 — CURIOSITY FIRST: Slide 1 must promise a specific revelation that is only delivered on the final slide. Every intermediate slide deepens the question without answering it. The viewer must feel that stopping means missing something they specifically want.
LAW 2 — CONTROVERSY DESIGN: At least one slide must make a specific claim that divides the audience. The best carousels have a "controversial slide" that generates disagreement in comments — both camps share it to defend their position.
LAW 3 — DISCUSSION ENGINEERING: The last slide's CTA must ask for the viewer's OWN EXPERIENCE or SPECIFIC OPINION — not "what do you think?" A question about a choice they've made or a belief they hold generates 10x more comments.
LAW 4 — PRIZE ARCHITECTURE: The final slide must deliver something the viewer could not have known without reading to the end: a specific number, method, revelation, or reframe. This is the prize for completing the carousel.
LAW 5 — REPEATABLE FORMAT: This carousel must have a structural template (e.g., "Myth/Truth/Proof/CTA" or "Problem/Cause/Fix/Result") that could run weekly with different subjects. Note the format name in your output.

─── SWIPE PHYSICS ────────────────────────────────────
A carousel lives or dies on swipe momentum. Here is the exact mechanics of how it works:

SLIDE POSITION PSYCHOLOGY:
- Slide 1 (Cover): The only job is to create an itch the viewer cannot scratch without swiping. The hook must make staying feel impossible.
- Slide 2 (The real decision): 50% of carousels lose their reader here. This must be the BEST slide in the deck — the single insight that makes them think "I need to see where this goes." It cannot be setup. It must deliver something.
- Slides 3 to N-2 (The build): Each slide advances the insight one level deeper. The reader is increasingly committed. Each slide makes them feel they've already invested too much to stop now. Each body text: ≤30 words. One insight. One job.
- Slide N-1 (The peak): The tension peaks here. The reader is at maximum investment. This is where the unresolved question must be at its sharpest.
- Last slide (The earned resolution): The CTA must feel like the natural conclusion of a journey — not a sudden ask. The reader earned this ending. Honor that.

SWIPE DRIVER MECHANICS:
- Curiosity gap: "I need to know what comes after this"
- Completion pressure: "I've read this far, stopping now would feel incomplete"
- Identity confirmation: "This is describing my situation — of course I want to see the answer"
- Contrarian payoff: "They said something I disagreed with — I want to see how they resolve it"

Every single slide must create one of these four mechanisms. If a slide creates none, it is filler and must be cut.

─── SLIDE-LEVEL RULES ────────────────────────────────
Title rules:
- Must create a micro-curiosity gap that the body text resolves
- Must be ≤8 words
- Must be a specific claim or question — not a theme ("Slide 3: Social proof" is not a title. "The results after 30 days" is.)
- Title and body must be in conversation, not repetition

Body rules:
- ≤30 words. One insight. One job.
- After reading the body, the viewer should feel one thing: "And?" — meaning they want the next slide
- No slide should fully resolve the tension it opened. Save the full resolution for the last slide.

─── OUTPUT FORMAT ────────────────────────────────────
Create 7–9 slides. Quality over quantity. 6 is better than 9 with filler.

Return ONLY valid JSON — no markdown, no explanation:
{
  "slides": [
    {
      "title": "Cover slide — hook verbatim",
      "body": "Cover subheading if needed — max 10 words, or empty string",
      "visual_note": "Layout brief: dominant visual, composition, color temperature, where text sits, what the eye lands on first",
      "swipe_driver": "Which of the 4 swipe mechanisms this slide uses — and how specifically",
      "slide_job": "One sentence: the single job this slide must accomplish"
    },
    {
      "title": "Slide 2 — best insight in the deck",
      "body": "The insight that makes this deck worth completing — max 30 words",
      "visual_note": "...",
      "swipe_driver": "...",
      "slide_job": "..."
    }
  ],
  "caption_preview": "First 150 chars of the carousel caption — amplifies the cover hook, hints at what's inside",
  "production_difficulty": "Low | Medium | High",
  "brand_compliance_notes": "Specific voice or visual flags",
  "key_broll_list": ["Design asset or photography needed 1", "asset 2", "asset 3"],
  "deck_tension_arc": "One paragraph: describe the emotional state of the reader at the end of each slide — what they feel, what question they're carrying, how it builds",
  "best_slide": "Slide number that is the strongest in this deck, and the exact reason why",
  "weakest_risk": "Slide number most likely to cause drop-off, what specifically causes the drop, and the one fix",
  "open_loop_promise": "The exact revelation promised in slide 1 and delivered in the final slide — written as the viewer would think the question",
  "controversy_angle": "The specific slide and claim that will divide the audience in comments — and why it generates two defensible sides",
  "repeatable_format": "One-line format name and structural template: [format name] — [slide-by-slide structure that could repeat weekly]"
}

Rules: no hashtags, no emojis`

// ── Static prompt ─────────────────────────────────────────────

const STATIC_PROMPT = (d: ScriptRequest) => `You are creating a high-impact static social post for ${d.platform}. You understand that a static post has one job — to stop the scroll — and that it must accomplish this in under 1.5 seconds. You know that the best static posts work because they resolve a tension in the viewer's mind the moment they see them.
${languageInstruction(d.language, d.dialect)}

${thinkingPhase(d, 'static')}

─── BRIEF ────────────────────────────────────────────
BRIEF: ${d.brief}
HOOK / MESSAGE: "${d.hook}"
GOAL: ${d.goal}
AUDIENCE: ${d.audience}
${d.brand_voice ? `BRAND VOICE: ${d.brand_voice}` : ''}
${d.client_name ? `CLIENT: ${d.client_name}` : ''}

─── VIRAL CONTENT LAWS (mandatory) ─────────────────────────────────────────────
LAW 1 — CURIOSITY: The text overlay must create a question the viewer cannot answer without reading the caption. One look is not enough — there must be something unresolved that pulls them to read more.
LAW 2 — CONTROVERSY: The post must take a specific position that generates productive disagreement. If everyone would agree immediately, it's an observation, not content. The best static posts say something that 50% nod at and 50% want to challenge.
LAW 3 — DISCUSSION: The caption must end with a question that makes the viewer want to share their OWN answer publicly — a specific question about a choice, belief, or experience they've had.
LAW 4 — PRIZE: The caption must deliver one SPECIFIC insight, number, or reframe the viewer could not have known from the image alone. This is what earns the save.
LAW 5 — REPEATABLE FORMAT: This post must have a structural template (image type + text overlay pattern + caption structure) that could run weekly. Note the format name.

─── VISUAL INTELLIGENCE ──────────────────────────────
A great static post is three simultaneous communications:
1. THE VISUAL communicates an emotional truth — it says something without words
2. THE TEXT OVERLAY says the thing the visual was setting up — they complete each other
3. THE CAPTION extends the conversation — it is the "here's why this matters" follow-up

THE 3-SECOND TEST:
In 3 seconds on a mobile feed, the viewer processes: (1) the dominant visual impression, (2) the text overlay if it's large enough, (3) whether this is for them.
Your design must pass all three. If the text overlay requires 5 seconds to read, it fails. If the visual is beautiful but emotionally neutral, it fails. If the text works without the image, the image is wasted.

VISUAL HIERARCHY LAWS:
- The human eye follows: contrast → movement cue → text → face → color block
- Composition must guide the eye toward the text, not away from it
- The subject's gaze (if any) directs the viewer's gaze — use this intentionally
- Negative space is not empty — it is where the eye rests before reading the text
- At 50% mobile screen size, the text overlay must be legible at a glance. Test it mentally: 6-word max for impact, 3-word max for punch.

TEXT-IMAGE RELATIONSHIP:
- Multiplication rule: text + image together must create a third meaning neither conveys alone
- If the text just labels the image ("Beautiful sunset"), the combination creates zero added value
- If the image just illustrates the text ("Our product is great" + product photo), the combination is advertising, not content
- The ideal: the image creates an emotional context that makes the text hit twice as hard as it would alone

─── OUTPUT FORMAT ────────────────────────────────────
Return ONLY valid JSON — no markdown, no explanation:
{
  "visual_direction": "Full production brief: subject + exact position/pose, background + depth of field, lighting setup + quality + direction, color palette + mood + temperature, composition + focal point + negative space placement, how the viewer's eye enters the frame and travels to the text. Specific enough that a photographer/designer executes without a single question.",
  "text_overlay": "Exact text on the image — maximum 8 words. Must be legible at 50% screen size. No emojis. Each word earns its place.",
  "secondary_text": "Optional supporting text beneath the overlay — max 10 words, or null. Must not repeat the main overlay.",
  "caption_preview": "First 150 chars of the post caption — continues the hook energy, delivers the implied promise, soft CTA at the end",
  "brand_compliance_notes": "Specific voice or visual flags",
  "production_difficulty": "Low | Medium | High",
  "key_broll_list": ["Photography element, prop, or design asset needed 1", "element 2", "element 3"],
  "focal_point": "One sentence: exactly where the viewer's eye lands first, and the specific emotional response that creates",
  "three_second_read": "What a viewer reading this post for exactly 3 seconds would see, understand, and feel — in that order",
  "visual_emotion": "The single emotion the image alone (without text) must communicate — one word, then a one-sentence explanation of how the composition achieves it",
  "controversy_angle": "The specific claim in the text overlay or caption that divides opinion — and the two defensible sides",
  "repeatable_format": "One-line format name and template: [format name] — [image + text + caption structure that could repeat weekly]"
}

Rules: no hashtags, no emojis`

function selectPrompt(d: ScriptRequest): string {
  if (d.content_type === 'carousel') return CAROUSEL_PROMPT(d)
  if (d.content_type === 'static')   return STATIC_PROMPT(d)
  return REEL_PROMPT(d)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await aiGuard()
  if (guard) return guard

  await params

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const geminiKey    = process.env.GEMINI_API_KEY
  if (!anthropicKey && !geminiKey) {
    return NextResponse.json({ error: 'No AI API key configured' }, { status: 500 })
  }

  let body: ScriptRequest
  try {
    body = await req.json() as ScriptRequest
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.hook?.trim()) {
    return NextResponse.json({ error: 'hook is required — complete Phase 3 first' }, { status: 400 })
  }

  let prompt = selectPrompt(body)
  let raw = ''

  // Inject client intelligence + competitor context
  if (body.client_id) {
    const db = adminSupabase()
    if (db) {
      const [intelBlock, compBlock] = await Promise.all([
        buildClientIntelligenceBlock(body.client_id, 'studio_content', db).catch(() => ''),
        buildCompetitorContextBlock(body.client_id, db).catch(() => ''),
      ])
      if (intelBlock) prompt = prompt + intelBlock
      if (compBlock)  prompt = prompt + compBlock
    }
  }

  if (anthropicKey) {
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const msg = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 32000,
      messages:   [{ role: 'user', content: prompt }],
    })
    raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  } else {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 32000, temperature: 0.85 },
        }),
      },
    )
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  }

  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

  // Extract all top-level JSON objects (thinking phase may contain smaller {} fragments)
  // then take the largest, which is always the real output object.
  function extractLargestJsonObject(text: string): string | null {
    const candidates: string[] = []
    let i = 0
    while (i < text.length) {
      if (text[i] === '{') {
        let depth = 0
        let inStr = false
        let esc = false
        let j = i
        while (j < text.length) {
          const ch = text[j]
          if (esc)              { esc = false; j++; continue }
          if (ch === '\\' && inStr) { esc = true;  j++; continue }
          if (ch === '"')       { inStr = !inStr; j++; continue }
          if (!inStr) {
            if (ch === '{') depth++
            else if (ch === '}') { depth--; if (depth === 0) { candidates.push(text.slice(i, j + 1)); i = j + 1; break } }
          }
          j++
        }
        if (depth !== 0) break
      } else { i++ }
    }
    if (!candidates.length) return null
    return candidates.reduce((best, cur) => cur.length > best.length ? cur : best)
  }

  const jsonStr = extractLargestJsonObject(stripped)
  if (!jsonStr) {
    return NextResponse.json({ error: 'Failed to parse script from AI', raw }, { status: 502 })
  }

  let script: unknown
  try {
    script = JSON.parse(jsonStr)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON from AI', raw }, { status: 502 })
  }

  return NextResponse.json({ script })
}
