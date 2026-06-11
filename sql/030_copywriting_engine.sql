-- 030_copywriting_engine.sql
-- Copywriting Engine: approved copy examples per client, copywriting profile,
-- extended Arabic knowledge base with Saudi Gen-Z 2025–2026 language intelligence,
-- and new knowledge base categories for viral formats + copywriting frameworks.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend arabic_knowledge_base categories
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE arabic_knowledge_base
  DROP CONSTRAINT IF EXISTS arabic_knowledge_base_category_check;

ALTER TABLE arabic_knowledge_base
  ADD CONSTRAINT arabic_knowledge_base_category_check
  CHECK (category IN (
    'vocabulary',
    'tone',
    'banned_phrases',
    'cultural_intelligence',
    'formatting',
    'cta_patterns',
    'genz_vocabulary',
    'viral_formats',
    'copywriting_frameworks'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. copy_examples — approved client copy samples (feeds AI as few-shot context)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS copy_examples (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform         text        NOT NULL DEFAULT 'instagram',
  language         text        NOT NULL DEFAULT 'ar'
                               CHECK (language IN ('ar', 'en', 'both')),
  content_type     text        NOT NULL DEFAULT 'single'
                               CHECK (content_type IN ('single', 'carousel', 'video', 'story', 'reel')),
  caption          text        NOT NULL,
  slide_captions   text[]      DEFAULT '{}',   -- per-slide text for carousels
  framework_used   text,                        -- which copywriting framework was applied
  performance_note text,                        -- optional: what worked / what didn't
  dialect          text        DEFAULT 'saudi'
                               CHECK (dialect IN ('saudi', 'egyptian', 'gulf', 'msa', 'en')),
  hashtags         text[]      DEFAULT '{}',
  is_approved      boolean     DEFAULT true,
  created_by       uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS copy_examples_client_idx
  ON copy_examples (client_id, is_approved, created_at DESC);

ALTER TABLE copy_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_manage_copy_examples" ON copy_examples
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Add copywriting_profile JSONB to clients
--    Stores: default_framework, tone_intensity, platform_voice_notes,
--            banned_words[], preferred_ctas[], hashtag_style,
--            caption_length_preference
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS copywriting_profile JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN clients.copywriting_profile IS
  'Copywriting Engine preferences per client. Schema: { default_framework: string, tone_intensity: 1-5, hashtag_style: none|minimal|full, caption_length: short|medium|long, banned_words: string[], preferred_ctas: string[], platform_voice_notes: { instagram: string, tiktok: string, ... } }';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Extend client_context_bank categories to include Copy Guidelines
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE client_context_bank
  DROP CONSTRAINT IF EXISTS client_context_bank_category_check;

ALTER TABLE client_context_bank
  ADD CONSTRAINT client_context_bank_category_check
  CHECK (category IN (
    'Client Instructions',
    'Brand Update',
    'Campaign Feedback',
    'Market Intel',
    'Meeting Notes',
    'Competitor Intel',
    'Copy Guidelines'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Saudi Gen-Z 2025–2026: Vocabulary, Viral Formats, CTAs
--    Deep language intelligence for the 18–30 Saudi audience on TikTok,
--    Instagram Reels, and X (Twitter).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO arabic_knowledge_base
  (category, region, rule_name, context_rules, banned_phrases, examples)
VALUES

-- ── 5.1 Core Gen-Z Intensifiers & Reactions ───────────────────────────────

('genz_vocabulary', 'saudi',
 'Saudi Gen-Z 2025–2026: Intensifiers and Reactions',
 'Saudi Gen-Z (18–30) uses a distinct intensifier vocabulary on TikTok, Instagram Reels, and X. These are the words that signal "this was written by someone who lives here, not by a brand's translation department." Use these contextually — not all at once. One or two per caption make it feel native; overuse makes it feel performative.

The Najdi dialect (Riyadh / central) is dominant on TikTok. Hejazi (Jeddah / western) runs more freely in lifestyle and fashion content. Know which one fits the client.

INTENSIFIERS — use to amplify a claim or reaction:
• حيل / حيل حيل — "very / extremely" (Najdi: حيل = a lot; the repetition رفع الدرجة amplifies)
• واجد — "very much / a lot" (cross-Gulf, preferred in formal-casual blend)
• مب عادي — "not ordinary" (marks something as exceptional; stronger than "رائع")
• وايد — "very" (lighter Gulf intensifier, softer than حيل for Najdi audiences)
• جداً (used sparingly) — MSA intensifier; still used by Saudi Gen-Z but feels slightly older
• فوق الخيال — "beyond imagination" (peak praise for product reveals)

REACTIONS — use in hooks, comments-bait, and surprise reveals:
• يطير / يطيّر — "mind-blowing" (lit. "it flies / makes it fly"); يطير العقل = blows the mind
• يخبّل / يخبّلك — "drives you crazy" (positively); يخبّلني = it drives me crazy (good crazy)
• يدمّر / تدمير — "destroys" used positively; يدمّر كل شيء = destroys everything (meaning: surpasses all)
• ولا بالأحلام — "not even in dreams" (expressing disbelief at how good something is)
• عيني عيني — expression of awe or overwhelmed positive reaction
• أوف — "oof" (borrowed from English; used for cringe, disappointment, or overwhelm)
• يسبرك / يبريك — "it breaks you" (gaming origin; means something is so impressive it breaks your defenses)
• فرفرة — the state of excitement/hype; "في فرفرة" = in a frenzy
• مجنون/مجنونة — "crazy good"; "هذا مجنون" said approvingly about a product/experience',

ARRAY[]::text[],

ARRAY[
  '"حيل حيل يعجبني" — I really really like it (natural product approval in Najdi)',
  '"مب عادي هذا الشيء" — this thing is not ordinary (opens with punch, drives saves)',
  '"يطيّر العقل والله" — blows the mind by God (highest praise, best after a reveal)',
  '"يخبّلني كل مرة" — it drives me crazy every time (loyalty + emotional hook)',
  '"ولا بالأحلام حسبت إن ـ" — not even in dreams did I think that X (surprise hook)',
  '"أوف هذا مو عادي" — oof this is not normal (cringe-positive reaction)',
  '"في فرفرة كاملة" — in full excitement mode (event/launch hype)',
  '"يدمّر المنافسة" — destroys the competition (competitive positioning, strong CTA support)'
]),

-- ── 5.2 Agreement, Validation, and Community Phrases ─────────────────────

('genz_vocabulary', 'saudi',
 'Saudi Gen-Z 2025–2026: Agreement, Validation, Belonging',
 'Saudi Gen-Z signals in-group membership through specific validation phrases. Brands that use these correctly feel like community members. Brands that misuse them feel like they asked ChatGPT to "sound Saudi." Use selectively — one per caption is powerful; more becomes noise.

AGREEMENT / VALIDATION:
• صح والله / صحيح والله — "true by God" (the strongest agreement; use when making a bold claim the audience already suspects)
• وييي / ويي — enthusiastic "yes!" (softer, more Gen-Z; female skews more but used by both)
• هيه — casual "yeah" (low-energy agreement; useful for soft hooks: "هيه، أعرف الإحساس")
• عدل — "correct / exactly right" (Najdi validation, crisp one-word agreement)
• دقيق — "accurate / precise" (used to validate a claim as well-observed)
• صاح — "true" (Gulf/Saudi; more serious weight than صح in casual contexts)
• طبعاً واضح — "obviously clear" (used sarcastically when pointing out something the audience missed)

BELONGING / COMMUNITY:
• أخوي / خويا — "my brother" (peer address; not formal; works in captions talking to the audience)
• يا الجماعة — "hey everyone / hey guys" (community opener; warms the hook)
• ما بين أهل — "among family" (intimacy signal for loyal community brands)
• الله يرضى عليكم — "God be pleased with you" (warm community sign-off; not religious-heavy, just warm)
• عفية عليك / عفية — "well done" (shortened الله يعطيك العافية; the shortening is what makes it Gen-Z)
• حياك — "welcome / go ahead" (shortened حياك الله; very Saudi, said when welcoming someone or inviting action)',

ARRAY[]::text[],

ARRAY[
  '"صح والله، ما كنت أعرف كيف أختار" — true by God, I didn't know how to choose (relatable opener)',
  '"هيه، أعرف الإحساس ـ ولهذا جبنا ـ" — yeah, I know the feeling, which is why we brought X (empathy bridge)',
  '"عدل، لهذا السبب بالذات" — exactly, for this very reason (validates then delivers)',
  '"يا الجماعة، فيه شيء لازم تعرفونه" — hey guys, there is something you need to know (community hook)',
  '"عفية على كل واحد جرّب" — well done to everyone who tried (community reward phrase)',
  '"حياك، البوابة مفتوحة" — welcome, the gate is open (invitation CTA with Saudi warmth)'
]),

-- ── 5.3 Status, Prestige, and Premium Vocabulary ─────────────────────────

('genz_vocabulary', 'saudi',
 'Saudi Gen-Z 2025–2026: Status, Prestige, Premium Signals',
 'Saudi Gen-Z has a strong luxury-orientation driven by Vision 2030 spending, the entertainment boom, and a culture of publicly sharing premium experiences. Premium brands should lean into this vocabulary. It reads as aspirational without being arrogant.

PRESTIGE VOCABULARY:
• تحفة — "masterpiece / gem" (highest quality marker; يعتبر تحفة = it is considered a masterpiece)
• فاخر / فخامة — "luxurious / luxury" (the Arabic version of "luxury" that does not feel translated)
• نادر — "rare" (scarcity signal; one of the strongest purchase motivators)
• حصري — "exclusive" (pair with نادر for maximum scarcity effect)
• محدود / كميات محدودة — "limited / limited quantities" (urgency + scarcity combo)
• الأصل / أصيل — "the real thing / authentic" (counters knock-off culture; use for authentic premium brands)
• راقي / ترقّى — "refined / to elevate oneself" (aspirational verb for lifestyle brands; "ارقَ مع ـ")
• كلاسيك — "classic" (Arabized English; Gen-Z uses it for timeless quality: كلاسيك ما يتعوّض)
• ليجند — "legend" (Arabized; reserved for brand heroes or iconic products)
• بريميوم — "premium" (fully Arabized; used directly in captions without translation)
• ذوق / بذوق — "taste / with taste" (cultural quality marker beyond just luxury)

ACHIEVEMENT FRAMING (resonates with Saudi male Gen-Z especially):
• إنجاز — achievement (pride framing: هذا إنجازي)
• تميّز — distinction / standing out (aspirational; يتميّز عن الباقين)
• مستوى / لِفت المستوى — level / raising the level (فلوس/مستوى reference from gaming culture)
• فوق المستوى — above the level (expressing something exceeds expectations)',

ARRAY[]::text[],

ARRAY[
  '"تحفة ما يجي له نظير" — a masterpiece that has no equal (premium product endorse)',
  '"نادر تلاقيه بهذا المستوى" — rare to find at this level (scarcity + quality combo)',
  '"حصري لكم ومحدود" — exclusive for you and limited (scarcity + community combo; strong CTA lead-in)',
  '"بذوق وفخامة في كل تفصيل" — with taste and luxury in every detail (premium lifestyle post)',
  '"ارقَ مع [brand]" — elevate yourself with [brand] (aspirational CTA; very Saudi Vision 2030 aligned)',
  '"فوق المستوى، مو مبالغة" — above the level, not an exaggeration (pre-empts skepticism)',
  '"الأصل له طعم ثاني" — the original has a different taste (authenticity + premium positioning)'
]),

-- ── 5.4 Trending Slang and Internet Culture ───────────────────────────────

('genz_vocabulary', 'saudi',
 'Saudi Gen-Z 2025–2026: Trending Slang and Internet Culture',
 'Saudi Gen-Z is heavily shaped by gaming culture, K-pop fandoms, TikTok creator language, and meme culture translated into Najdi dialect. These terms circulate fast and age fast — use with awareness of shelf life. Most relevant for youth, entertainment, food/beverage, and gaming-adjacent brands.

TRENDING SLANG (2024–2026 cycle):
• الحين / الحين حالاً — "right now" (more casual than الآن; Najdi; strong urgency signal)
• يالحين — "right now" (compressed form; even more casual)
• شكله / شكلها — "looks like / seems like" (observation hook: شكله الموضوع أكبر)
• طلع / طلعت — "it turned out to be" (reveal format: طلعت أحسن من المتوقع)
• جاد / جادة — "seriously?" (questioning hook; invites reply)
• ولّا — "or what?" (tag question; drives comments: زين ولّا لا؟)
• ميت / ميتة من الـ — "dying from X" (hyperbolic; ميت من الضحك = dying of laughter)
• أحادية / أحادي — singular focus on something; complete dedication
• تريند / تريند الأسبوع — "trend / trend of the week" (awareness hook)
• فايب / فايبز — "vibe / vibes" (Arabized English; الفايب صح = the vibe is right)
• هايب — "hype" (fully used as-is: الهايب حقيقي = the hype is real)

GAMING AND INTERNET CULTURE VOCABULARY:
• بوص — "boss" (a person/brand that commands respect; هذا بوص = this is a boss move)
• كومبو — "combo" (pairing two things powerfully: الكومبو اللي ما تقاومه)
• ليفل — "level" (رفع الليفل = raised the level)
• أبغريد / أبريتد — "upgraded" (product improvement language: نسخة مأبغريدة)
• فلتر — "filter" (aesthetic or quality; بدون فلتر = raw/authentic reveal)
• إكس بي — "XP / experience points" (for loyalty programs or learning: اكسب إكس بيك)
• تشاليندج — "challenge" (participation hooks: جرّب التشاليندج وورّنا)
• ريأكشن — "reaction" (reaction content hook: ريأكشني لما جرّبته)

IMPORT NOTE: These Arabized English terms are NOT code-switching — Saudi Gen-Z has fully absorbed them into their Arabic. They do not break the reading flow. A pure-Arabic equivalent would often sound older or more formal.',

ARRAY[]::text[],

ARRAY[
  '"طلعت أحسن من اللي توقعته" — it turned out better than I expected (reveal hook; drives saves)',
  '"الحين حالاً، مو بكره" — right now, not tomorrow (urgency CTA in pure Najdi)',
  '"الهايب حقيقي هذي المرة" — the hype is real this time (pre-empts skepticism for launches)',
  '"كومبو ما تقاومه" — a combo you can''t resist (product pairing post; stops scroll)',
  '"بدون فلتر، هذي هي النتيجة" — without a filter, this is the result (authenticity reveal format)',
  '"رفعت الليفل بجدية" — raised the level seriously (achievement/upgrade announcement)',
  '"جاد؟ حسبت إن ـ؟" — seriously? Did you think that X? (questioning hook; invites reply)',
  '"ريأكشني لما شفته أول مرة..." — my reaction when I first saw it... (engagement bait opener)'
]),

-- ── 5.5 Emotional and Storytelling Vocabulary ─────────────────────────────

('genz_vocabulary', 'saudi',
 'Saudi Gen-Z 2025–2026: Emotional Hooks and Storytelling Language',
 'Emotional resonance is the highest-converting copy mode for Saudi Gen-Z. The audience has been over-marketed to with "buy now / احجز الآن" — emotional storytelling cuts through. The Gen-Z Saudi vocabulary for emotions is specific and should be used precisely.

LONGING / NOSTALGIA:
• كل ودّي — "I really want to / all I want is to" (desire + longing: كل ودّي أجرّبها)
• نفسي في — "I wish I could / I want to" (يمنيّ فيها = I wish for it; نفسي في = I want it)
• وحشتني — "I missed you / it" (strong emotional return; brand recall signal)
• اشتقت — "I missed" (more formal longing; used for nostalgic content)
• زمان ما شفنا — "we haven't seen in a long time" (nostalgia hook for returning products)

SURPRISE AND DISCOVERY:
• ما توقعت — "I didn't expect" (opens surprise reveal)
• ما صدّقت — "I couldn't believe / didn't believe" (amplified surprise)
• طريت وـ — "I was passing by and..." (discovery story opener; very native format)
• اكتشفت — "I discovered" (learning/revelation hook)
• ما كنت أعلم إن — "I didn't know that" (education hook; drives saves)

SATISFACTION AND RESOLUTION:
• ريّحت عقلي — "gave my mind rest / peace" (relief from a problem)
• استاهلت — "it was worth it / I deserved it" (post-purchase satisfaction)
• يستاهل — "it deserves / it''s worth it" (third-person recommendation form)
• ما ندمت — "I didn''t regret" (post-experience validation; strong word-of-mouth signal)
• بدّل نظرتي — "changed my perspective" (transformation marker)

FRUSTRATION AND PAIN POINTS (to agitate in PAS/PASTOR framework):
• تعبت — "I got tired / worn out" (opens problem agitation)
• طفشت / طفشت من — "I got bored/fed up with" (product improvement context)
• ما لقيت — "I couldn''t find / didn''t find" (scarcity of solution; sets up the offer)
• ضاق صدري — "my chest tightened" (colloquial; I was frustrated)
• خلّتني أعيد التفكير — "made me rethink" (problem pivot hook)',

ARRAY[]::text[],

ARRAY[
  '"كل ودّي أجرّبها من زمان" — all I wanted was to try it for a long time (longing hook; converts for launches)',
  '"ما توقعت إن التجربة تكون بهذا المستوى" — didn''t expect the experience to be at this level (surprise reveal)',
  '"طريت بالمحل وقفت فيه نص ساعة" — I was passing by the store and spent half an hour in it (story hook)',
  '"ريّحت عقلي بصراحة" — honestly gave my mind rest (relief = strongest emotion for problem-solution brands)',
  '"يستاهل كل ريال" — worth every riyal (price-objection neutralizer; drives purchase intent)',
  '"ما ندمت لحظة" — didn''t regret a single moment (social proof emotion; triggers reciprocity)',
  '"طفشت من الخيارات اللي ما تفيد, لقيت ـ" — fed up with options that don''t help, then found X (PAS hook)',
  '"بدّل نظرتي كلياً لـ[category]" — changed my perspective completely on [category] (transformation hook)'
]),

-- ── 5.6 CTA Patterns: Saudi Gen-Z 2025–2026 ──────────────────────────────

('cta_patterns', 'saudi',
 'Saudi Gen-Z 2025–2026: High-Converting CTA Patterns',
 'Saudi Gen-Z responds to CTAs that feel like peer recommendations, not brand commands. The shift from imperative ("اشترِ") to collaborative ("جرّب وقولنا") dramatically increases click and comment rates. The following patterns are ranked by conversion intent.

HIGHEST CONVERSION (purchase / booking):
• "اطلب الحين" — order right now (Najdi form of "order now"; feels local not translated)
• "احجز مكانك قبل ما يخلص" — book your spot before it runs out (FOMO + action)
• "قرّر الحين، ما تندم" — decide now, you won''t regret (urgency + reassurance combo)
• "خذها وما تفكّر" — take it and don''t think (decisiveness CTA for high-trust moments)
• "جرّب بضمان" — try with a guarantee (risk-reversal CTA; very effective for skeptical Gen-Z)

ENGAGEMENT / COMMUNITY:
• "جرّب وقولنا" — try it and tell us (peer-to-peer; drives both trial and comments)
• "بلّغ اللي يستفيد" — tell whoever benefits (share-bait that feels noble not salesy)
• "وفّر للي يحتاج" — save for someone who needs it (bookmark + share combo)
• "ورّنا تجربتك" — show us your experience (UGC invitation)
• "الرأي عندك" — the opinion is yours (engages without pressure)
• "صوّت بتعليق" — vote with a comment (comment-bait with clear action)

DISCOVERY / AWARENESS:
• "اكتشف الباقي" — discover the rest (multi-part content)
• "الرابط في البايو" — the link is in the bio (Instagram standard; use only once per caption)
• "ابدأ من هنا" — start from here (first step in a journey; low commitment)
• "خطوة خطوة" — step by step (reassuring for complex offers)
• "بدون ما تلتزم" — without commitment (commitment-reduction opener for free trials)

AVOID (these read as old-generation Saudi marketing):
• "للاستفسار تواصل معنا على الواتساب" — overused, reads as small business 2015
• "سارع بالحجز" — "hurry to book" — corporate urgency that Gen-Z ignores
• "لا تفوّت الفرصة" — "don''t miss the opportunity" — worn out across all Arabic markets
• "نسعد بخدمتكم" — "we are happy to serve you" — formal; zero Gen-Z resonance',

ARRAY[
  'للاستفسار تواصل معنا على الواتساب',
  'سارع بالحجز',
  'لا تفوّت الفرصة',
  'نسعد بخدمتكم',
  'للطلب والاستفسار',
  'لا تتردد في التواصل'
],

ARRAY[
  '"اطلب الحين، الكميات محدودة" — order right now, quantities are limited (urgency + scarcity; highest intent)',
  '"جرّب وقولنا رأيك" — try it and tell us your opinion (community loop; drives comments + trial)',
  '"بلّغ اللي يستفيد" — tell whoever benefits (noble share-bait; outperforms "share" alone)',
  '"قرّر الحين ما تندم والله" — decide now you won''t regret it by God (urgency + social proof emotion)',
  '"خذها بضمان أو فلوسك ترجع" — take it with a guarantee or your money back (Gen-Z skepticism neutralizer)',
  '"صوّت بتعليق: زين أو لا" — vote with a comment: good or not (simplest comment-bait; 2x comment rate)'
]),

-- ── 5.7 Viral Caption Formats: Saudi 2025 ────────────────────────────────

('viral_formats', 'saudi',
 'Saudi Gen-Z 2025–2026: Viral Caption Structures',
 'These are the caption skeleton structures that consistently go viral on Saudi Instagram Reels and TikTok in 2024–2025. Each has a proven psychological mechanism. The Copywriting Engine should match content to the closest structure.

FORMAT 1: THE DISCOVERY WALK
"طريت [place/situation] وـ [surprising discovery]... ما توقعت إن ـ [revelation]... [CTA]"
Mechanism: Vicarious discovery. The reader experiences the moment with you.
Best for: Brick-and-mortar brands, product reviews, experience reveals.

FORMAT 2: THE SECRET REVEAL
"أقولك سر: [unexpected truth about category/product]... [brief explanation]... [CTA that feels like insider access]"
Mechanism: Exclusivity + curiosity gap. The word "سر" (secret) stops the scroll.
Best for: Education brands, premium products, insider-knowledge positioning.

FORMAT 3: THE CHALLENGE-YOURSELF HOOK
"تحديت نفسي [verb + challenge] لمدة [period]، والنتيجة: [result]... [lesson/CTA]"
Mechanism: Experiment narrative. Audience wants to see if the result matches their expectation.
Best for: Health, fitness, productivity, self-improvement brands.

FORMAT 4: THE UNDERRATED QUESTION
"ليش ما أحد يتكلم عن [underrated topic/product]؟ [brief case] ... [CTA to discover more]"
Mechanism: Positions both the creator and brand as ahead-of-the-curve.
Best for: Niche products, quality brands fighting for awareness, educational content.

FORMAT 5: THE COMPARISON REVEAL
"الفرق بين [option A] و[option B] اللي ما أحد يقولك إياه: [real difference]... [recommendation]"
Mechanism: Decision simplification. Removes cognitive load. Drives saves.
Best for: Products with alternatives, educational brands, before/after content.

FORMAT 6: THE BEFORE-YOU-BUY
"قبل ما تشتري [category], لازم تعرف: [honest insight 1], [honest insight 2], [honest insight 3]... [honest recommendation]"
Mechanism: Consumer advocacy framing. Audience trusts brands that warn them.
Best for: High-consideration purchases, premium brands, trust-building campaigns.

FORMAT 7: THE COMMUNITY VALIDATOR
"للي [specific group descriptor] بس: [highly specific message for that group]... [CTA that matches their world]"
Mechanism: Identity narrowing. The more specific, the more the target feels seen.
Best for: Niche brands, loyalty campaigns, lifestyle content.

FORMAT 8: THE TRANSFORMATION ARC
"[Before state — honest, vulnerable]... [moment of discovery]... [after state — specific, not hyperbolic]... [invitation]"
Mechanism: Story arc. The vulnerability in the before state creates trust for the after.
Best for: Service brands, coaching, beauty, wellness.',

ARRAY[]::text[],

ARRAY[
  'Discovery Walk: "طريت السوق وقفت قدام [brand] — ما توقعت إن التجربة تكون بهذا المستوى. جرّبوها وقولوا."',
  'Secret Reveal: "أقولك سر عن [category] ما أحد يقوله: [truth]. هذا اللي خلّاني أغيّر رأيي كلياً."',
  'Challenge: "تحديت نفسي أستخدم [product] كل يوم لمدة شهر. النتيجة صدمتني."',
  'Underrated: "ليش ما أحد يتكلم عن [product]؟ من ٣ أشهر وأنا أتساءل."',
  'Before You Buy: "قبل ما تشتري [product]، اعرف هذا: [honest insight]. يستاهل."',
  'Community: "للي عنده [specific trait/situation] بس — هذا اللي يناسبك."',
  'Transformation: "كنت [honest before state]. جرّبت [product/brand]. الحين [specific after]. ما توقعت."'
]),

-- ── 5.8 Banned Phrases: Saudi Marketing 2025 ──────────────────────────────

('banned_phrases', 'saudi',
 'Saudi Marketing: Banned and Overused Phrases 2025',
 'These phrases have been used so heavily in Saudi digital marketing that they have lost all impact. They signal "generic agency copy" and immediately reduce trust with Gen-Z audiences. Beyond staleness, some trigger consumer protection concerns or religious misuse flags.',

ARRAY[
  -- Overused urgency
  'لا تفوّت الفرصة',
  'سارع بالحجز',
  'العرض محدود',
  'الفرصة الأخيرة',
  'أسرع قبل فوات الأوان',
  'لا تضيّع فرصتك',
  -- Overused service phrases
  'نسعد بخدمتكم',
  'يشرّفنا خدمتكم',
  'للاستفسار تواصل معنا',
  'للطلب والاستفسار',
  'تواصل معنا عبر الواتساب',
  'خدمتكم أولويتنا',
  -- Empty quality claims
  'الأفضل دائماً',
  'جودة لا مثيل لها',
  'الأقل سعراً والأعلى جودة',
  'نضمن لك الجودة',
  'معايير عالمية',
  -- Religious misuse (phrases that feel exploitative)
  'إن شاء الله يعجبكم',
  'بإذن الله يستاهل',
  'ربنا يوفقنا في خدمتكم',
  -- Hollow vision 2030 reference
  'نسعى لتحقيق رؤية ٢٠٣٠',
  'في إطار رؤية المملكة',
  'دعماً لرؤية ٢٠٣٠'
],

ARRAY[
  'Replace "لا تفوّت الفرصة" with specific scarcity: "باقي ١٢ مقعد بس"',
  'Replace "نسعد بخدمتكم" with action: "جرّب وقولنا" or "اطلب الحين"',
  'Replace "جودة لا مثيل لها" with specific proof: "١٨ شهر ضمان + ٤.٩ تقييم من ٢٣٠٠ شخص"',
  'Replace vision 2030 hollow reference with specific cultural alignment or omit entirely'
]),

-- ── 5.9 Copywriting Frameworks: Arabic Translations and Structures ────────

('copywriting_frameworks', 'all',
 'Copywriting Frameworks: Arabic Structures and Platform Applications',
 'These are the 8 global copywriting frameworks as applied to Arabic social media content. Each has a native Arabic structure that preserves the framework''s psychological mechanism while sounding natural in Arabic — not like a translated marketing textbook.

1. AIDA — الانتباه، الاهتمام، الرغبة، الفعل
Structure: [Hook that stops scroll] → [Builds interest: the why / what] → [Creates desire: specific benefit, proof, emotion] → [Action: one clear CTA]
Arabic note: AIDA needs the Attention phase to be visceral in Arabic — a question, contradiction, or specific number. "اهتمام" is built through specificity, not adjectives.
Best platforms: Instagram Feed, LinkedIn, long-form X thread opening.

2. PAS — المشكلة، التضخيم، الحل
Structure: [Name the pain the audience recognizes] → [Agitate: make them feel how bad it is, not just describe it] → [Solution: specific, credible, with proof]
Arabic note: PAS converts best in Arabic when the Problem is stated in dialect (feels personal) and the Solution is in slightly more formal Arabic (signals expertise).
Best platforms: Instagram Reels caption, TikTok text overlay, Carousel slide 1–3.

3. BAB — قبل، بعد، الجسر
Structure: [Before: the frustrating/limited state] → [After: the ideal transformed state, specific] → [Bridge: exactly how to get there = the offer]
Arabic note: "Before" should use emotional vocabulary (تعبت، طفشت، ما لقيت). "After" should avoid hyperbole — specific numbers and observations outperform "amazing."
Best platforms: Instagram Story sequence, Carousel, TikTok transformation reveal.

4. Hook-Story-Offer — الخطاف، القصة، العرض
Structure: [1 sentence hook that earns the next sentence] → [Brief story: protagonist, problem, turning point] → [Offer: clear and positioned as the resolution]
Arabic note: The Story section in Arabic should be first-person when possible — يخلق مصداقية (creates credibility). Third-person stories feel like ads; first-person feels like recommendation.
Best platforms: Instagram Reels, TikTok, video caption.

5. 4Ps — الوعد، الصورة، الإثبات، الدفع
Structure: [Promise: bold specific claim] → [Picture: paint the experience they will have] → [Proof: specific evidence, number, testimonial] → [Push: what to do right now]
Arabic note: "الصورة" phase works exceptionally well in Arabic because the language is naturally rich in sensory description. Use this phase to slow down and paint. The Proof must be specific — "٢٣٠٠ عميل" outperforms "آلاف العملاء."
Best platforms: Premium brand campaigns, carousel final slides, LinkedIn brand posts.

6. StoryBrand — الشخصية، المشكلة، المرشد، الخطة، الدعوة، النجاح، الفشل
Simplified for caption use: [Audience as hero facing problem] → [Brand as guide, not hero] → [Simple plan] → [CTA]
Arabic note: The critical insight is that the BRAND is the GUIDE, not the hero. Arabic copy often positions the brand as hero ("نحن الأفضل"). StoryBrand flips this. Use "أنت" (you) as the main character.
Best platforms: Brand awareness campaigns, launch campaigns, long LinkedIn posts.

7. PASTOR — المشكلة، التضخيم، القصة، التحول، العرض، الاستجابة
Extended form of PAS with Story and Transformation added.
Structure: [Problem] → [Amplify pain] → [Story of someone who had the problem] → [Transformation they achieved] → [Offer] → [Response CTA]
Arabic note: PASTOR works in Arabic long-form captions and video scripts. The Story and Transformation phases are where Saudi Gen-Z dialect vocabulary (يخبّل, ما توقعت, يستاهل) creates the most emotional impact.
Best platforms: Long-form Instagram captions, LinkedIn articles, video scripts.

8. AUTO — ذكاء اصطناعي يختار الأنسب
The AI analyzes: the image content, the brief, the platform, the client voice, and the target emotion — then selects the best framework and applies it without labelling the output.
Use when: the copywriter does not want to prescribe a structure and trusts the AI to match framework to content.',

ARRAY[]::text[],

ARRAY[
  'AIDA: "هذا غيّر طريقة تفكيري [Attention] — لأن ٩٠٪ من الناس يفعلون [Interest] — والفرق يظهر في [Desire] — ابدأ الحين [Action]"',
  'PAS: "[المشكلة اللي تعرفها] [وكيف تزيد كل يوم] [هنا الحل اللي يختلف]"',
  'BAB: "[كنت في هذا الوضع] [بعدها صار كذا] [الجسر: هذا اللي غيّر اللعبة]"',
  'Hook-Story-Offer: "[جملة واحدة تكسر التوقع] [قصة قصيرة بضمير المتكلم] [العرض كحل للقصة]"',
  '4Ps: "[وعد جريء ومحدد] [صورة لما ستعيشه] [٣ أرقام/شهادات] [CTA واحد]"',
  'StoryBrand: "[أنت تعاني من X] [نحن مررنا بهذا ونعرف الطريق] [خطوة واحدة] [ما ستصل إليه]"',
  'PASTOR: "[المشكلة] [كيف تتفاقم] [قصة شخص واجهها] [كيف تحوّل] [عرضنا] [قرّر الحين]"'
]);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Copywriting frameworks: English (all regions)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO arabic_knowledge_base
  (category, region, rule_name, context_rules, banned_phrases, examples)
VALUES

('banned_phrases', 'all',
 'Universal English AI Copywriting Signature Phrases — Never Use',
 'These English phrases appear in AI-generated captions and immediately signal that no human wrote this. They destroy credibility with audiences who consume a lot of content and have developed a strong AI-detector instinct.',

ARRAY[
  'In conclusion,',
  'It''s worth noting that',
  'Dive into',
  'Elevate your experience',
  'Unlock the potential',
  'Game-changer',
  'Revolutionize',
  'Seamlessly',
  'Leverage',
  'Delve into',
  'Transformative',
  'Navigate',
  'Paramount',
  'Embark on',
  'In today''s fast-paced world',
  'At the end of the day',
  'The bottom line is',
  'It goes without saying',
  'Needless to say',
  'In the realm of',
  'Foster meaningful connections',
  'Cutting-edge',
  'State-of-the-art',
  'Best-in-class'
],

ARRAY[
  'Replace "game-changer" with what specifically changed: "cut my prep time by 40 minutes"',
  'Replace "elevate your experience" with the actual experience: "the texture is different — you''ll notice it in 3 days"',
  'Replace "seamlessly" with the honest mechanic: "plugs in, no setup, works"',
  'Replace "in today''s fast-paced world" with the specific context that matters to the reader'
]);
