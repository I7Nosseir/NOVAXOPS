import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { buildClientIntelligenceBlock, adminSupabase } from '@/lib/client-intelligence'
import { getArabicDialectGuide, HUMANIZATION_RULES_EN, HUMANIZATION_RULES_AR } from '@/lib/arabic-dialect'
import { getGoogleDriveFileId } from '@/lib/google-drive'
import { aiGuard } from '@/lib/ai-guard'
import type {
  CopyFramework, CopyLength, EmojiStyle, HashtagStyle, CopyLanguage, CopyDialect,
  CopyImage, CopyDocument, SlideCaption,
} from '@/lib/studio-types'

export const maxDuration = 90

// ── Framework instructions ────────────────────────────────────────────────────

const FRAMEWORK_INSTRUCTIONS: Record<CopyFramework, string> = {
  aida: `Apply the AIDA framework:
• Attention — first line must stop the scroll with a specific hook (question, contradiction, or vivid detail)
• Interest — build intrigue with specifics: who it's for, what makes it different
• Desire — emotional resonance + proof: a number, a sensory detail, a relatable truth
• Action — one specific, platform-native CTA. Not "Click here." Something a person would actually say.`,

  pas: `Apply the PAS framework:
• Problem — name the exact pain the audience lives with. Be specific enough that they feel called out.
• Agitate — make them feel the weight of the problem. Not just "it's hard" but what it costs them daily.
• Solution — the offer as the specific answer. Connect it back to the exact problem you named.
Do NOT rush to the Solution. The Agitate phase earns the trust that the Solution converts.`,

  bab: `Apply the BAB framework:
• Before — the limiting, frustrating state. First-person or empathy-bridged. Must be painfully recognizable.
• After — the transformed state. Use specific outcomes, not hyperbole. "Down 8kg" not "amazing transformation."
• Bridge — exactly HOW to get from Before to After. This is the offer, explained simply.`,

  hook_story_offer: `Apply the Hook-Story-Offer framework:
• Hook — exactly one sentence that earns the next sentence. Creates a gap the mind must fill.
• Story — first-person narrative: protagonist (relatable), problem (specific), turning point (the discovery). 2-4 sentences. No filler.
• Offer — positioned as the resolution of the story. Not bolted on — the story leads here organically.`,

  '4ps': `Apply the 4Ps framework:
• Promise — a bold, specific claim. Not "best quality" but "18-month guarantee, zero exceptions."
• Picture — paint the sensory/emotional experience of having/using the product. Slow down here. Use specific details.
• Proof — one specific number, a named testimonial, or a verifiable fact. Vague social proof converts less.
• Push — one clear action. What to do RIGHT NOW. Make it feel immediate, not eventual.`,

  storybrand: `Apply the StoryBrand framework:
• The AUDIENCE is the hero — not the brand. Write "you" as the protagonist.
• They face a problem (external + internal: the external problem and how it makes them feel).
• The brand is the GUIDE — wise, experienced, empathetic. Never the hero.
• Simple plan: 1-3 steps to get the result.
• Clear CTA: one specific action.
• Vision of success: briefly paint the outcome if they act.`,

  pastor: `Apply the PASTOR framework (extended PAS for deeper emotional engagement):
• Problem — name it specifically. The more precise, the more the right person feels seen.
• Amplify — what happens if this problem goes unsolved? Real cost: time, money, emotional.
• Story — someone (a character) who had this problem. What they tried. Why it didn't work. Until...
• Transformation — what changed. Specific, believable, not miraculous.
• Offer — what you're giving them. Framed as the bridge from their current state to the transformation.
• Response — the CTA. Make it feel like the natural next step after the story, not an interruption.`,

  auto: `Analyze the image, brief, client context, and platform — then choose the single best framework for this specific content. Factors to weigh:
• Product launch → Hook-Story-Offer or 4Ps
• Pain-point product → PAS or PASTOR
• Transformation content → BAB
• Brand awareness → StoryBrand
• General engagement → AIDA
State which framework you chose in framework_used and briefly explain why in framework_rationale.`,
}

// ── Length guides ─────────────────────────────────────────────────────────────

const LENGTH_GUIDE: Record<CopyLength, string> = {
  micro:    'Under 50 characters. Hook only — a single sentence. Perfect for story overlays or TikTok text.',
  short:    '50–150 characters. Punchy. No elaboration. One idea, one punch.',
  medium:   '150–300 characters. Standard caption. Hook + 1-2 body lines + CTA.',
  long:     '300–500 characters. Carousel/educational. Multiple beats. Still every word earns its place.',
  extended: '500+ characters. Deep storytelling or PASTOR format. LinkedIn or long-form feed posts.',
}

// ── Tone descriptions ─────────────────────────────────────────────────────────

const TONE_DESC: Record<number, string> = {
  1: 'Very formal — polished, professional, no contractions, no colloquialisms. Think brand press release register.',
  2: 'Formal-warm — professional but approachable. Like a senior consultant who is also likeable.',
  3: 'Balanced — conversational but not casual. The voice of a smart, friendly expert.',
  4: 'Casual — sounds like a knowledgeable friend. Contractions, informal sentence breaks, direct address.',
  5: 'Gen-Z casual — native dialect vocabulary, current slang, short punchy sentences. Sounds exactly like a human who lives this culture.',
}

// ── Arabic KB fetcher (cached 10 min, region + copywriting categories) ────────

interface KbRow {
  category: string
  region: string
  rule_name: string
  context_rules: string
  banned_phrases: string[] | null
  examples: string[] | null
}

let kbCache: { data: KbRow[]; fetchedAt: number } | null = null
const KB_TTL = 10 * 60 * 1000

async function fetchCopyKbBlock(dialect: CopyDialect): Promise<string> {
  const db = adminSupabase()
  if (!db) return getArabicDialectGuide(dialect)

  const now = Date.now()
  if (!kbCache || now - kbCache.fetchedAt > KB_TTL) {
    const { data } = await db
      .from('arabic_knowledge_base')
      .select('category, region, rule_name, context_rules, banned_phrases, examples')
      .eq('is_active', true)
    kbCache = { data: (data ?? []) as KbRow[], fetchedAt: now }
  }

  const rows = kbCache.data.filter(r =>
    (r.region === dialect || r.region === 'all') &&
    [
      'vocabulary', 'genz_vocabulary', 'cta_patterns',
      'viral_formats', 'banned_phrases', 'tone',
      'cultural_intelligence', 'formatting', 'copywriting_frameworks',
    ].includes(r.category)
  )

  if (rows.length === 0) return getArabicDialectGuide(dialect)

  const byCategory: Record<string, KbRow[]> = {}
  for (const r of rows) {
    ;(byCategory[r.category] ??= []).push(r)
  }

  const parts: string[] = []

  const banned = rows.flatMap(r => r.banned_phrases ?? []).filter(Boolean)
  if (banned.length) {
    parts.push(`BANNED PHRASES — NEVER USE IN ANY ARABIC OUTPUT:\n${banned.map(p => `• "${p}"`).join('\n')}`)
  }

  const vocabRows = [...(byCategory.vocabulary ?? []), ...(byCategory.genz_vocabulary ?? [])]
  if (vocabRows.length) {
    parts.push(
      `AUTHENTIC VOCABULARY AND LANGUAGE RULES:\n` +
      vocabRows.slice(0, 6).map(r => `[${r.rule_name}]\n${r.context_rules}`).join('\n\n')
    )
  }

  if (byCategory.cta_patterns?.length) {
    parts.push(
      `CTA PATTERNS THAT CONVERT:\n` +
      byCategory.cta_patterns.map(r =>
        `${r.context_rules}` +
        (r.examples?.length ? `\nExamples: ${r.examples.slice(0, 3).join(' | ')}` : '')
      ).join('\n\n')
    )
  }

  if (byCategory.viral_formats?.length) {
    parts.push(
      `PROVEN VIRAL CAPTION STRUCTURES:\n` +
      byCategory.viral_formats.map(r =>
        r.context_rules +
        (r.examples?.length ? `\nNative examples: ${r.examples.slice(0, 3).join(' | ')}` : '')
      ).join('\n\n')
    )
  }

  if (byCategory.cultural_intelligence?.length) {
    parts.push(
      `CULTURAL INTELLIGENCE:\n` +
      byCategory.cultural_intelligence.map(r => r.context_rules).join('\n\n')
    )
  }

  if (byCategory.formatting?.length) {
    parts.push(
      `FORMATTING RULES:\n` +
      byCategory.formatting.map(r => r.context_rules).join('\n\n')
    )
  }

  return parts.join('\n\n══════════\n\n')
}

// ── Fetch image as base64 from a Google Drive URL (server-side) ───────────────

async function driveUrlToBase64(driveUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const fileId = getGoogleDriveFileId(driveUrl)
    if (!fileId) return null
    const thumbUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1024`
    const res = await fetch(thumbUrl, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const data = Buffer.from(buf).toString('base64')
    const mimeType = res.headers.get('content-type')?.split(';')[0].trim() ?? 'image/jpeg'
    return { data, mimeType }
  } catch {
    return null
  }
}

// ── Main prompt builder ───────────────────────────────────────────────────────

function buildPrompt(opts: {
  framework: CopyFramework
  language: CopyLanguage
  dialect: CopyDialect
  platform: string
  captionLength: CopyLength
  toneIntensity: number
  emojiStyle: EmojiStyle
  customEmojis: string
  hashtagStyle: HashtagStyle
  hashtagPlacement: string
  preferredHashtags: string[]
  bannedHashtags: string[]
  ctaMode: string
  customCta: string
  variantCount: number
  brief: string
  offerPromo: string
  postGoal: string
  disclosure: string
  toneArchetype: string
  clientIntelBlock: string
  arabicKbBlock: string
  approvedExamples: { caption: string; framework_used: string | null; dialect?: string | null }[]
  imageCount: number
  isCarousel: boolean
  inspirationRefs?: { title: string; description: string; elementBorrowed: string; elementLabel: string }[]
}): string {
  const {
    framework, language, dialect, platform, captionLength, toneIntensity,
    emojiStyle, customEmojis, hashtagStyle, hashtagPlacement,
    preferredHashtags, bannedHashtags, ctaMode, customCta,
    variantCount, brief, offerPromo, postGoal, disclosure,
    toneArchetype, clientIntelBlock, arabicKbBlock, approvedExamples,
    imageCount, isCarousel, inspirationRefs,
  } = opts

  const hasImage = imageCount > 0
  const isArabic = language === 'ar' || language === 'both'
  const isEnglish = language === 'en' || language === 'both'

  const lines: string[] = []

  lines.push(`You are an elite social media copywriter who has studied every viral caption format on ${platform}.`)
  lines.push(`Your only job right now: write ${variantCount} caption variant${variantCount > 1 ? 's' : ''} that stop the scroll, earn the save, and convert.`)

  if (hasImage && isCarousel) {
    lines.push(`\nYou have been shown ${imageCount} carousel slide image${imageCount > 1 ? 's' : ''} in order. Analyze each slide carefully — identify what each slide shows: subject, mood, key visual, any text overlay, and the emotional arc across slides. Use this understanding to:
1. Write per-slide captions (50–120 chars each) — punchy overlays that complement what the viewer sees.
2. Write the overall feed caption — the caption that appears in the post and captures the full carousel story using the chosen framework.`)
  } else if (hasImage) {
    lines.push(`\nYou have been shown the content image. Analyze it carefully — extract: subject, mood, key visual elements, setting, any visible text, and the emotion it conveys. Ground every caption in what you actually see.`)
  }

  if (clientIntelBlock) {
    lines.push(`\n── CLIENT CONTEXT ──\n${clientIntelBlock}`)
  }

  lines.push(`\n── FRAMEWORK ──`)
  lines.push(FRAMEWORK_INSTRUCTIONS[framework])

  if (isArabic) {
    lines.push(`\n── ARABIC LANGUAGE RULES (${dialect.toUpperCase()} DIALECT) ──`)
    lines.push(arabicKbBlock || getArabicDialectGuide(dialect))
    lines.push(HUMANIZATION_RULES_AR)
  }

  if (isEnglish) {
    lines.push(`\n── ENGLISH HUMANIZATION RULES ──`)
    lines.push(HUMANIZATION_RULES_EN)
  }

  if (approvedExamples.length > 0) {
    lines.push(`\n── APPROVED EXAMPLES (match this quality and voice — do not copy, use as style reference) ──`)
    approvedExamples.forEach((ex, i) => {
      const meta = [ex.framework_used, ex.dialect].filter(Boolean).join(' · ')
      lines.push(`Example ${i + 1}${meta ? ` [${meta}]` : ''}:\n${ex.caption}`)
    })
  }

  if (inspirationRefs && inspirationRefs.length > 0) {
    lines.push(`\n── STRUCTURAL INSPIRATION (borrow the pattern, never the words) ──`)
    lines.push(`The copywriter identified these Pinterest captions as structurally valuable. Extract only their structural PATTERN — rhythm, hook mechanic, sentence architecture, or CTA format. Never copy their specific words, brand names, or content.`)
    inspirationRefs.forEach(ref => {
      const excerpt = ref.description.slice(0, 200).replace(/\n/g, ' ')
      lines.push(`[${ref.elementLabel}] "${ref.title || 'Untitled'}" — ${excerpt}`)
    })
    lines.push(`Apply the structural patterns above, translated into the client's voice, brand, and language.`)
  }

  lines.push(`\n── PREFERENCES ──`)
  lines.push(`PLATFORM: ${platform}`)
  lines.push(`LANGUAGE: ${language === 'both' ? `Bilingual — write each variant in ${dialect} Arabic AND English. Deliver natural Arabic first, then English below it in the same caption field, separated by a blank line.` : language === 'ar' ? `Arabic only — ${dialect} dialect` : 'English only'}`)
  lines.push(`LENGTH: ${LENGTH_GUIDE[captionLength]}`)
  lines.push(`TONE: ${TONE_DESC[toneIntensity] ?? TONE_DESC[3]}`)
  if (toneArchetype && toneArchetype !== 'auto') {
    lines.push(`BRAND ARCHETYPE: ${toneArchetype} — apply the vocabulary and rhythm of this archetype consistently across all variants.`)
  }

  // Emoji rules
  if (emojiStyle === 'none') {
    lines.push(`EMOJIS: None — zero emojis anywhere in any variant.`)
  } else if (emojiStyle === 'minimal') {
    lines.push(`EMOJIS: Minimal — 1-2 emojis max per caption. Punctuation-only use (end of line, never mid-sentence).${customEmojis ? ` If using any, prefer from: ${customEmojis}` : ''}`)
  } else if (emojiStyle === 'moderate') {
    lines.push(`EMOJIS: Moderate — 3-5 emojis. Strategic placement only (hook emphasis, CTA, list markers).${customEmojis ? ` Preferred: ${customEmojis}` : ''}`)
  } else {
    lines.push(`EMOJIS: Rich — 6+ emojis. Full expressive use throughout.${customEmojis ? ` Preferred: ${customEmojis}` : ''}`)
  }

  // Hashtag rules
  const hashtagCount = { none: 0, minimal: '3-5', standard: '8-12', max: '20-30' }[hashtagStyle]
  if (hashtagStyle === 'none') {
    lines.push(`HASHTAGS: None — include zero hashtags in any variant.`)
  } else {
    lines.push(`HASHTAGS: Include ${hashtagCount} hashtags. Placement: ${hashtagPlacement === 'first_comment' ? 'add to the hashtags array field (they go in the first comment, NOT in the caption text)' : 'include at the end of the caption text'}.`)
    if (preferredHashtags.length > 0) lines.push(`REQUIRED HASHTAGS (always include): ${preferredHashtags.join(' ')}`)
    if (bannedHashtags.length > 0) lines.push(`BANNED HASHTAGS (never use): ${bannedHashtags.join(' ')}`)
  }

  // CTA
  if (ctaMode === 'none') {
    lines.push(`CTA: No call-to-action. Awareness content only.`)
  } else if (ctaMode === 'custom' && customCta) {
    lines.push(`CTA: Use exactly this CTA (adapt phrasing naturally to each variant's tone): "${customCta}"`)
  } else {
    lines.push(`CTA: Auto — choose the most natural CTA for ${platform} and this ${postGoal} goal. Make it sound like something a person would say, not a brand.`)
  }

  // Post goal context
  const goalContext = {
    awareness: 'Goal: Brand awareness — prioritize saves and shares over clicks.',
    engagement: 'Goal: Engagement — end with a question or invitation that compels replies.',
    conversion: 'Goal: Conversion — the CTA is the most important line. Make it immediate and low-friction.',
    retention: 'Goal: Retention / loyalty — speak to existing fans, reward them with inside information.',
  }[postGoal]
  if (goalContext) lines.push(goalContext)

  // Disclosure
  if (disclosure === 'arabic') lines.push(`DISCLOSURE: Add "#إعلان" as the very first element in the caption (before any other text).`)
  if (disclosure === 'english') lines.push(`DISCLOSURE: Add "Sponsored" or "#Ad" as the very first element in the caption.`)

  if (brief) lines.push(`\nBRIEF: ${brief}`)
  if (offerPromo) lines.push(`PROMOTION / OFFER: ${offerPromo}`)

  if (isArabic) {
    lines.push(`\nARABIC FORMATTING RULES:
• Use Arabic-Indic numerals (١ ٢ ٣) not Western numerals (1 2 3) in full Arabic captions
• Use Arabic comma ، not English comma in Arabic sentences
• Line breaks: one idea per line — never more than 3-4 lines without a visual break
• Never start a line with a punctuation mark — it always attaches to the word before it`)
  }

  lines.push(`\n── OUTPUT RULES ──`)
  lines.push(`• Every variant must use the framework — not just in structure but in spirit`)
  lines.push(`• No AI signature phrases (see banned lists above)`)
  lines.push(`• Vary sentence length across each variant — human rhythm, not AI uniformity`)
  lines.push(`• Each variant must feel distinctly different from the others — different hook type, different emotional angle`)
  lines.push(`• No variant should be a minor reword of another`)
  lines.push(`• alt_text: Write one clear, specific accessibility description of the image(s). If no image, describe what a hypothetical image for this post would show.`)

  if (isCarousel && imageCount > 0) {
    lines.push(`\nCARROUSEL SLIDE CAPTIONS — write one per slide (${imageCount} total). Each must be 50–120 characters: a crisp overlay line that makes sense with just that slide visible. These go in "slide_captions".`)
  }

  const slideCaptionsSchema = isCarousel && imageCount > 0
    ? `
  "slide_captions": [
    { "slide_index": 1, "caption": "Slide 1 overlay caption", "char_count": 72 }
  ],`
    : ''

  lines.push(`\nReturn ONLY valid JSON — no markdown fence, no explanation before or after:
{
  "variants": [
    {
      "variant_index": 1,
      "caption": "full caption text",
      "framework_used": "AIDA",
      "char_count": 187
    }
  ],${slideCaptionsSchema}
  "hashtags": ["#tag1", "#tag2"],
  "alt_text": "Accessible description of the image${isCarousel ? 's across all slides' : ''}",
  "framework_used": "AIDA",
  "framework_rationale": "One sentence explaining why this framework fits this content."
}`)

  return lines.join('\n')
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const guard = await aiGuard()
  if (guard) return guard

  let body: {
    client_id?: string
    language?: CopyLanguage
    dialect?: CopyDialect
    platform?: string
    framework?: CopyFramework
    caption_length?: CopyLength
    tone_intensity?: number
    emoji_style?: EmojiStyle
    custom_emojis?: string
    hashtag_style?: HashtagStyle
    hashtag_placement?: string
    preferred_hashtags?: string[]
    banned_hashtags?: string[]
    cta_mode?: string
    custom_cta?: string
    variant_count?: number
    brief?: string
    offer_promo?: string
    post_goal?: string
    disclosure?: string
    tone_archetype?: string
    image?: CopyImage      // Phase 1 single image (backward compat)
    images?: CopyImage[]   // Phase 2 carousel (1–5 images)
    force_gemini?: boolean // Phase 3 bulk — skip Claude even when key is set
    inspiration_references?: {
      pin_id?:         string   // pinterest_pins UUID — used for copy_inspiration_links
      title:           string
      description:     string
      elementBorrowed: string
      elementLabel:    string
    }[]
    inspiration_session_id?: string   // pinterest_scrape_sessions UUID — for back-link
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    client_id,
    language    = 'ar',
    dialect     = 'saudi',
    platform    = 'instagram',
    framework   = 'auto',
    caption_length = 'medium',
    tone_intensity = 3,
    emoji_style = 'none',
    custom_emojis = '',
    hashtag_style = 'none',
    hashtag_placement = 'caption',
    preferred_hashtags = [],
    banned_hashtags = [],
    cta_mode = 'auto',
    custom_cta = '',
    variant_count = 1,
    brief = '',
    offer_promo = '',
    post_goal = 'engagement',
    disclosure = 'none',
    tone_archetype = 'auto',
    image,
    images,
    force_gemini = false,
    inspiration_references,
    inspiration_session_id,
  } = body

  // Normalise to a single array — images[] wins, falls back to legacy image
  const allImages: CopyImage[] = (images && images.length > 0)
    ? images.filter(img => !!img.data)
    : (image?.data ? [image] : [])
  const isCarousel = allImages.length > 1

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const geminiKey    = process.env.GEMINI_API_KEY
  if (!anthropicKey && !geminiKey) {
    return NextResponse.json({ error: 'No AI API key configured' }, { status: 503 })
  }

  const db = adminSupabase()

  // 1. Fetch client intel block
  let clientIntelBlock = ''
  if (client_id && db) {
    clientIntelBlock = await buildClientIntelligenceBlock(client_id, 'copy_engine', db).catch(() => '')

    // Merge in copywriting_profile preferences (override defaults if set)
    const { data: clientRow } = await db
      .from('clients')
      .select('copywriting_profile')
      .eq('id', client_id)
      .single()

    if (clientRow?.copywriting_profile && typeof clientRow.copywriting_profile === 'object') {
      const cp = clientRow.copywriting_profile as Record<string, unknown>
      if (cp.banned_words && Array.isArray(cp.banned_words) && cp.banned_words.length > 0) {
        clientIntelBlock += `\n── CLIENT BANNED WORDS ──\nNever use these words or phrases for this client: ${(cp.banned_words as string[]).join(', ')}`
      }
      if (cp.platform_voice_notes && typeof cp.platform_voice_notes === 'object') {
        const notes = cp.platform_voice_notes as Record<string, string>
        const platformNote = notes[platform.toLowerCase()]
        if (platformNote) {
          clientIntelBlock += `\n── ${platform.toUpperCase()} VOICE NOTE ──\n${platformNote}`
        }
      }
    }
  }

  // 2. Fetch approved copy examples — Arabic gets dialect-preferred examples first
  const approvedExamples: { caption: string; framework_used: string | null; dialect?: string | null }[] = []
  if (client_id && db) {
    const isArabicGen = language === 'ar' || language === 'both'
    // For Arabic include both 'ar' and 'both' tagged examples; for EN include 'en' and 'both'
    const langFilter  = isArabicGen ? ['ar', 'both'] : language === 'en' ? ['en', 'both'] : ['both']

    if (isArabicGen) {
      // First pass: exact dialect match (highest quality few-shot examples)
      const { data: dialectRows } = await db
        .from('copy_examples')
        .select('caption, framework_used, dialect')
        .eq('client_id', client_id)
        .eq('is_approved', true)
        .in('language', langFilter)
        .eq('dialect', dialect)
        .order('created_at', { ascending: false })
        .limit(3)
      if (dialectRows) approvedExamples.push(...dialectRows)
    }

    // Fill remaining slots (or all for EN) with any language-matching examples
    if (approvedExamples.length < 3) {
      const { data: exRows } = await db
        .from('copy_examples')
        .select('caption, framework_used, dialect')
        .eq('client_id', client_id)
        .eq('is_approved', true)
        .in('language', langFilter)
        .order('created_at', { ascending: false })
        .limit(3 - approvedExamples.length)
      if (exRows) {
        for (const ex of exRows) {
          if (!approvedExamples.some(e => e.caption === ex.caption)) approvedExamples.push(ex)
        }
      }
    }
  }

  // 3. Fetch Arabic KB block (only if generating Arabic)
  let arabicKbBlock = ''
  if (language === 'ar' || language === 'both') {
    arabicKbBlock = await fetchCopyKbBlock(dialect).catch(() => getArabicDialectGuide(dialect))
  }

  // 4. Resolve all images to base64 in parallel
  const resolvedImages: { data: string; mimeType: string }[] = (
    await Promise.all(
      allImages.map(async (img) => {
        if (img.type === 'upload') {
          return { data: img.data, mimeType: img.mime_type || 'image/jpeg' }
        }
        if (img.type === 'drive') {
          return await driveUrlToBase64(img.data)
        }
        return null
      })
    )
  ).filter((r): r is { data: string; mimeType: string } => r !== null)

  // 5. Build prompt
  const prompt = buildPrompt({
    framework,
    language,
    dialect,
    platform,
    captionLength: caption_length,
    toneIntensity: Math.max(1, Math.min(5, tone_intensity)),
    emojiStyle: emoji_style,
    customEmojis: custom_emojis,
    hashtagStyle: hashtag_style,
    hashtagPlacement: hashtag_placement,
    preferredHashtags: preferred_hashtags,
    bannedHashtags: banned_hashtags,
    ctaMode: cta_mode,
    customCta: custom_cta,
    variantCount: Math.max(1, Math.min(3, variant_count)),
    brief,
    offerPromo: offer_promo,
    postGoal: post_goal,
    disclosure,
    toneArchetype: tone_archetype,
    clientIntelBlock,
    arabicKbBlock,
    approvedExamples,
    imageCount: resolvedImages.length,
    isCarousel,
    inspirationRefs: inspiration_references,
  })

  // 6. Call AI
  let raw = ''
  let provider: 'claude' | 'gemini' = 'claude'

  if (anthropicKey && !force_gemini) {
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const contentBlocks: Anthropic.MessageParam['content'] = []

    for (const img of resolvedImages) {
      const mediaType = img.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      contentBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: img.data },
      })
    }
    contentBlocks.push({ type: 'text', text: prompt })

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: contentBlocks }],
    })
    raw = msg.content[0].type === 'text' ? msg.content[0].text : ''

  } else if (geminiKey) {
    provider = 'gemini'
    const geminiModel = process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`
    const parts: object[] = []
    for (const img of resolvedImages) {
      parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } })
    }
    parts.push({ text: prompt })

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { maxOutputTokens: 4000, temperature: 0.75 },
      }),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => res.status.toString())
      return NextResponse.json({ error: `AI error: ${err}` }, { status: 502 })
    }
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  }

  if (!raw) {
    return NextResponse.json({ error: 'Empty response from AI' }, { status: 502 })
  }

  // 7. Parse JSON
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const objMatch = stripped.match(/\{[\s\S]*\}/)
  if (!objMatch) {
    return NextResponse.json({ error: 'Failed to parse AI response', raw }, { status: 502 })
  }

  let parsed: {
    variants?: { variant_index: number; caption: string; framework_used: string; char_count?: number }[]
    slide_captions?: { slide_index: number; caption: string; char_count?: number }[]
    hashtags?: string[]
    alt_text?: string
    framework_used?: string
    framework_rationale?: string
  }
  try {
    parsed = JSON.parse(objMatch[0])
  } catch {
    return NextResponse.json({ error: 'Invalid JSON from AI', raw }, { status: 502 })
  }

  const slideCaptions: SlideCaption[] = isCarousel
    ? (parsed.slide_captions ?? []).map((sc, i) => ({
        slide_index: sc.slide_index ?? i + 1,
        caption:     sc.caption ?? '',
        char_count:  sc.char_count ?? sc.caption?.length ?? 0,
      }))
    : []

  const result: CopyDocument = {
    variants: (parsed.variants ?? []).map((v, i) => ({
      variant_index: v.variant_index ?? i + 1,
      caption:       v.caption ?? '',
      framework_used: v.framework_used ?? framework.toUpperCase(),
      char_count:    v.char_count ?? v.caption?.length ?? 0,
    })),
    hashtags:            parsed.hashtags ?? [],
    alt_text:            parsed.alt_text ?? '',
    framework_used:      parsed.framework_used ?? framework.toUpperCase(),
    framework_rationale: parsed.framework_rationale ?? '',
    language,
    platform,
    provider,
    content_type:   isCarousel ? 'carousel' : 'single',
    slide_captions: slideCaptions.length > 0 ? slideCaptions : undefined,
  }

  // 8. Persist copy session + inspiration attribution (fire-and-forget — never block the response)
  persistSession({
    db,
    client_id,
    language,
    dialect,
    platform,
    framework,
    caption_length,
    emoji_style,
    hashtag_style,
    tone_intensity,
    variant_count,
    isCarousel,
    result,
    inspiration_references,
    inspiration_session_id,
  }).then(copySessionId => {
    if (copySessionId) result.copy_session_id = copySessionId
  }).catch(() => {/* non-blocking */})

  return NextResponse.json(result)
}

// ── Session persistence (called after AI response, non-blocking) ──────────────

async function persistSession(opts: {
  db: ReturnType<typeof adminSupabase>
  client_id?: string
  language: CopyLanguage
  dialect: CopyDialect
  platform: string
  framework: CopyFramework
  caption_length: CopyLength
  emoji_style: EmojiStyle
  hashtag_style: HashtagStyle
  tone_intensity: number
  variant_count: number
  isCarousel: boolean
  result: CopyDocument
  inspiration_references?: { pin_id?: string; elementBorrowed: string }[]
  inspiration_session_id?: string
}): Promise<string | null> {
  const { db, inspiration_references, inspiration_session_id, result, isCarousel } = opts
  if (!db) return null

  // Get caller user ID from cookie (best-effort)
  let userId: string | null = null
  try {
    const cookieStore = await cookies()
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    )
    const { data: { user } } = await authClient.auth.getUser()
    userId = user?.id ?? null
  } catch { /* auth not available in this context */ }

  // Insert copy session
  const { data: sessionRow, error: sessErr } = await db
    .from('copy_sessions')
    .insert({
      client_id:      opts.client_id ?? null,
      session_type:   isCarousel ? 'carousel' : 'single',
      language:       opts.language,
      dialect:        opts.dialect,
      platform:       opts.platform,
      framework:      opts.framework,
      caption_length: opts.caption_length,
      emoji_style:    opts.emoji_style,
      hashtag_style:  opts.hashtag_style,
      tone_intensity: Math.max(1, Math.min(5, opts.tone_intensity)),
      variant_count:  Math.max(1, Math.min(3, opts.variant_count)),
      status:         'complete',
      output_json:    result,
      created_by:     userId,
    })
    .select('id')
    .single()

  if (sessErr || !sessionRow) {
    console.error('[generate] copy_session insert failed:', sessErr?.message)
    return null
  }

  const copySessionId = sessionRow.id as string

  // Save inspiration attribution links
  if (inspiration_references?.length) {
    const links = inspiration_references
      .filter(r => r.pin_id)
      .map(r => ({
        copy_session_id:  copySessionId,
        pin_id:           r.pin_id!,
        element_borrowed: r.elementBorrowed,
      }))

    if (links.length > 0) {
      const { error: linkErr } = await db
        .from('copy_inspiration_links')
        .insert(links)
      if (linkErr) {
        console.error('[generate] copy_inspiration_links insert failed:', linkErr.message)
      }
    }
  }

  // Back-link: update pinterest_scrape_sessions.copy_session_id
  if (inspiration_session_id) {
    await db
      .from('pinterest_scrape_sessions')
      .update({ copy_session_id: copySessionId, status: 'complete' })
      .eq('id', inspiration_session_id)
  }

  return copySessionId
}
