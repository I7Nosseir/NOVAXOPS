-- 031_copywriting_engine_arabic_v2.sql
-- Deep Saudi Arabic expansion: Najdi dialect specifics, Hejazi register,
-- platform-specific formatting rules, compliance intelligence, Gen-Z psychology,
-- code-switching patterns, seasonal copy (Ramadan / National Day), and
-- Saudi brand voice archetypes.
-- Run AFTER 030_copywriting_engine.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Najdi Dialect (Riyadh / Central Arabia) — TikTok Dominant Register
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO arabic_knowledge_base
  (category, region, rule_name, context_rules, banned_phrases, examples)
VALUES

('genz_vocabulary', 'saudi',
 'Najdi Dialect 2025: Core Grammar and Vocabulary Markers',
 'Najdi is the prestige dialect of Saudi TikTok. Riyadh-origin creators dominate, so their register sets the standard for what feels "authentic Saudi." The key markers that distinguish Najdi from Gulf or MSA — and that make copy feel native rather than translated.

PRONOUN AND VERB FORMS (most visible markers):
• "ذا" = هذا (this, masculine) — "ذا الشيء" not "هذا الشيء"
• "ذي" = هذه (this, feminine) — "ذي المرة" not "هذه المرة"
• "مو" = ليس (not) — "مو زين" not "ليس جيداً"; the most Najdi word in social media
• "ابي/ابغى" = أريد (I want) — "ابي أجرّب" not "أريد أن أجرّب"
• "يبي/يبغي" = يريد (he wants / you want) — "كل واحد يبي"
• "ما هو/ما هي" = isn''t it / is it not (rhetorical tag) — "زين ما هو؟"
• "ترى" = you know / by the way (sentence opener unique to Najdi/Gulf) — used 2-3x per TikTok script as a natural pause marker: "ترى ذا الشيء صعب"
• "عيل" = then / so (Najdi connective) — "عيل شنو تبي؟"
• "شنو/شيش" = what / what is (Najdi form of ماذا) — "شنو هذا؟"
• "اشلون" = how (cross-Gulf but dominant Najdi) — "اشلون أسويها؟"
• "ودّي" = I wish / I''d like to — "ودّي أشوف" (desire expression, softer than ابي)
• "لو سمحت/لو سمحتي" = please (gender-marked request; use female form for female audiences)

NAJDI-SPECIFIC QUALIFIERS:
• "حيل" = very/a lot (Najdi intensifier, signature word) — "حيل زين"
• "واجد" = a lot / very much (slightly more formal) — "واجد عجبني"
• "هيّاط" = exaggerated/too much (calling out overstatement) — "لا تكون هيّاط"
• "مدري" = I don''t know (casual; honest admission that builds trust) — "مدري بصراحة"
• "بعدين" = later / and then — "وبعدين صار كذا"
• "أومال" = well then / so what (rhetorical pivot) — "أومال وش تبي؟"
• "الحين" = right now (present moment emphasis) — "الحين الأسعار مرتفعة"
• "يالحين" = right now this instant (compressed, more urgent) — CTA use: "اطلب يالحين"

SENTENCE OPENERS THAT SIGNAL AUTHENTICITY:
• "ترى..." — by the way / you know... (casual authority marker; starts insights)
• "والله..." — I swear / honestly... (sincerity signal; best before product claims)
• "بصراحة..." — honestly... (builds credibility before potential negative truth)
• "صدق أو لا تصدق..." — believe it or not... (surprise hook opener)
• "ما كنت أتوقع..." — I didn''t expect... (discovery/reveal opener)
• "أقولك شيء..." — I''ll tell you something... (secret/exclusive intel opener)',

ARRAY[
  'هيّاط',
  'وش تبي منها',
  'ما أدري والله صراحة يعني كذا'
],

ARRAY[
  '"ترى ذا الشيء غيّر طريقة تفكيري كلياً" — you know, this thing completely changed how I think (TikTok opener)',
  '"والله مدري كيف عشت بدونه" — I swear I don''t know how I lived without it (product revelation)',
  '"بصراحة ما توقعته يكون بهذا المستوى" — honestly didn''t expect it to be at this level (honest review tone)',
  '"اطلب يالحين، الكميات واجد محدودة" — order right now, quantities are very limited (Najdi CTA)',
  '"ذا الشيء مو عادي، حيل يختلف" — this thing is not normal, it''s very different (Najdi product endorsement)',
  '"ودّي كل واحد يجرّبه مرة وحدة" — I''d like everyone to try it just once (community recommendation)'
]),

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Hejazi Dialect (Jeddah / Western Region) — Instagram Lifestyle Dominant
-- ─────────────────────────────────────────────────────────────────────────────

('genz_vocabulary', 'saudi',
 'Hejazi Dialect 2025: Jeddah Instagram Register',
 'Hejazi (Jeddah origin) runs differently from Najdi. It''s more influenced by Egyptian Arabic due to historical migration, more cosmopolitan, more tolerant of mixed Arabic-English, and dominates Instagram lifestyle, fashion, and food content. Premium brands targeting Jeddah audiences should know these markers.

KEY HEJAZI MARKERS (vs Najdi):
• "أيوه/أيه" = yes (Egyptian-influenced; Jeddah uses this where Riyadh says "إيه" or "آه")
• "مين" = who (Hejazi, not Najdi which uses "مين" sometimes but prefers "من")
• "فين" = where (Hejazi; Najdi uses "وين")
• "وين" = where (used in both, but dominant in Najdi)
• "إيش" = what (Hejazi alternative to شنو/وش)
• "زابط" = perfect / working well / spot on (Hejazi quality marker)
• "مهتوك" = overwhelmed / astonished (Hejazi; not used much in Riyadh)
• "الله" as one-word exclamation of surprise (shorter than "يا إلهي"; very Jeddawi)
• "يا زلمة" / "يا حبيبي" — address forms (Hejazi warmth markers; more casual than Najdi)
• "زفت" = terrible/awful (used humorously; Hejazi); also: "زفتة" as a thing that''s terrible
• "طبّاخة" = things are brewing / it''s cooking (situation is building — Hejazi idiom)

JEDDAH LIFESTYLE CONTENT REGISTER:
• More willingness to mix English and Arabic mid-sentence (code-switch naturally)
• Food culture: "مطبّق / مندي / كبسة" references for authentic Saudi food brands
• Fashion culture: Jeddah fashion week sensibility; modest fashion brand language
• Café culture: Jeddah café scene language ("كوفي كورنر", specialty coffee vocabulary)
• Female empowerment tone: more direct in Jeddah than Riyadh (post-2017 social reforms)
• International awareness: Jeddah audiences compare to Dubai/global; "عالمي المستوى" resonates

HEJAZI APPROVAL PHRASES:
• "تمام" = perfect/complete (more Hejazi than Najdi who prefers "زين")
• "صح بس" = exactly right (Hejazi validation)
• "على بعضه" = all together / as a whole (Hejazi appreciation for completeness)
• "ما فيه أحسن" = there''s nothing better (strong product endorsement)',

ARRAY[]::text[],

ARRAY[
  '"زابط بالظبط اللي كنت دوّر عليه" — exactly right what I was looking for (Jeddah product match)',
  '"الله، ما توقعت المكان يكون بهذا المستوى" — wow, didn''t expect the place to be at this level (Hejazi surprise)',
  '"تمام ١٠٠٪، ما فيه أحسن" — 100% perfect, there''s nothing better (strong Hejazi endorsement)',
  '"طبّاخة والله، في شيء جديد قريباً" — things are brewing, something new coming soon (teaser format)',
  '"على بعضه — الجودة، الخدمة، السعر" — the whole package: quality, service, price (Hejazi completeness praise)'
]),

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Saudi Arabic Numeral Style and Punctuation Rules
-- ─────────────────────────────────────────────────────────────────────────────

('formatting', 'saudi',
 'Saudi Arabic Numerals, Punctuation, and Text Rhythm for Social Media',
 'Formatting details that separate native-feeling Saudi content from translated content. These are invisible when correct and immediately jarring when wrong.

NUMERAL USAGE:
• Full Arabic captions: use Arabic-Indic numerals (١ ٢ ٣ ٤ ٥ ٦ ٧ ٨ ٩ ١٠) — they read as native; western numerals (1 2 3) signal "translated for Arabic"
• Exception: percentages used in an English-heavy post, or model/product codes, can stay Western
• Price: always Arabic-Indic + ريال or ر.س — "٢٩٩ ريال" not "299 ريال" in pure Arabic copy
• Dates: day first — "٢٣ سبتمبر" not "سبتمبر ٢٣"
• Time: "الساعة ٧ مساءً" not "7pm"

PUNCTUATION RULES:
• Arabic comma: use ، (U+060C) not English comma , inside Arabic sentences
• No space before ، or . — they attach to the word before
• Period usage: Saudi Gen-Z often drops the final period in captions — this is correct for informal register
• Three-dot pause: " . . . " (with spaces) used for dramatic build-up in TikTok scripts
• Em dash: — (used increasingly in Gen-Z Arabic, borrowed from English content creation)
• Question mark: ؟ (Arabic form, U+061F) — use it; Western ? is increasingly accepted but ؟ feels more native
• Exclamation: ! is universal; ‼ (double) used in Gen-Z content for strong emotion

LINE BREAKS AND READING RHYTHM:
• One idea per line — Saudi Instagram captions that perform best use hard line breaks between beats
• The first line is the hook — it must work as a standalone sentence
• Never exceed 3-4 lines before a visual break (white line or emoji as separator)
• Carousel slide text: max 8 words per line for mobile readability at full scroll speed
• TikTok text overlay: max 6 words per line, max 2 lines visible at once

RTL/LTR MIXING RULES:
• When mixing Arabic and English words in one sentence, the Arabic grammar governs the sentence
• English product names/brands stay in English script, embedded in Arabic flow
• Numbers mid-sentence: Arabic numerals keep the RTL flow; Western numerals create a mini-LTR island
• App names, hashtags in English can be at the end of an Arabic caption without disrupting flow
• Avoid: long English phrases mid-Arabic sentence — they break the reading rhythm for RTL readers',

ARRAY[]::text[],

ARRAY[
  'Correct: "ذا المنتج مو عادي — جرّبته ١٤ يوم وها هي النتيجة" (Arabic-Indic, em dash, no final period)',
  'Correct: "السعر: ٣٩٩ ريال فقط، وتوصيل مجاني الحين" (Arabic numeral, Arabic comma)',
  'Wrong: "المنتج جيد جدا وثمنه 399 ريال ويمكن طلبه الآن" (Western numerals, no commas, no rhythm)',
  'TikTok overlay: "مو عادي / جرّبته شهر / والنتيجة..." (3 lines, 3-4 words each, builds anticipation)',
  'Carousel slide: "الخطوة الأولى / ابدأ بالأساس / قبل كل شيء" (max 6 words per line)'
]),

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Platform-Specific Arabic Copy Rules (Saudi Context)
-- ─────────────────────────────────────────────────────────────────────────────

('formatting', 'saudi',
 'Platform-Specific Arabic Copy Rules for Saudi Audience',
 'Each platform has a different reading contract with the Saudi audience. Copy that performs on X fails on TikTok. The Copywriting Engine must adapt format to platform, not just platform name.

INSTAGRAM REELS CAPTION (Saudi):
• Max 125 characters before the "more" truncation — the first 125 must complete the hook
• Structure: [hook line] + line break + [1-2 lines body] + line break + [CTA]
• Hashtags: either last in caption (max 10) or first comment (max 30)
• "يتابعوني" tag is organic; avoid "اضغط فولو" which sounds desperate
• Caption length sweet spot: 100-220 chars for Reels (caption is secondary; video is primary)
• Best time: Riyadh: Thu-Fri 8-11pm / Daily: post-Asr 4-6pm / Post-Isha 9-11pm

TIKTOK CAPTION (Saudi):
• TikTok captions are mostly ignored — the hook is IN the video
• Text overlays are the real caption: max 6 words per line, 2 lines max visible
• TikTok caption: max 150 chars; used mainly for hashtags and one-line hook
• TikTok hashtags: 3-5 is optimal; mix Arabic + 1 English trending tag
• The first 3 seconds of script = the hook; write it as a spoken sentence under 12 words
• Saudi TikTok peak: Thu 9pm-12am, Fri 2-5pm (post-Jumu''a), Sat 10pm-1am

INSTAGRAM CAROUSEL (Saudi):
• Slide 1: hook only — question or bold claim — drives swipe
• Slide 2: setup/problem — deepens the hook
• Slides 3-4: substance — the value delivery
• Second-to-last slide: peak value or emotional moment
• Last slide: CTA + follow/save ask
• Per-slide caption: 20-40 words max; designed to be read while stopped on slide
• Save rate is the key metric — design every carousel for saves, not just likes
• Most-saved formats: "قبل ما تشتري ـ", "X أشياء ما تعرفها عن ـ", "الفرق بين ـ"

X (TWITTER ARABIC — SAUDI):
• Saudi X is the most text-forward platform; argument and wit are rewarded
• Thread opening tweet: must be standalone + create curiosity for thread
• Saudi X users quote-tweet more than reply — design hooks that beg to be quoted
• Character limit: 280 (full Arabic text per tweet); threads work for long copy
• Hot times: post-Fajr (5-7am), midday break (1-2pm), late night (11pm-2am Fri-Sat)
• Najdi and formal Arabic both work; pure Gen-Z slang can read as low-effort
• Viral formats: "Thread: ـ 🧵" (thread announcement), "سؤال مهم:", "رأي قد يزعجك:"

LINKEDIN (SAUDI PROFESSIONALS):
• Saudi LinkedIn is growing fast (young professionals, Vision 2030 awareness)
• Mix of English and Arabic is common; full Arabic posts get engagement from Saudi-only audience
• Formal-casual hybrid: MSA with Gulf warmth markers
• Achievement and career framing: "تعلّمت", "حققت", "اكتشفت"
• Avoid Najdi slang — undermines professional positioning
• Best format: 3-5 line opener → insight → personal story → lesson → CTA',

ARRAY[]::text[],

ARRAY[
  'Reels: "ما قدرت أمشي لما شفت هذا [hook - 125 chars]\n\nوالسبب بسيط جداً...\n\nاكتشف الباقي في التعليقات"',
  'TikTok overlay: "جرّبته / ٣٠ يوم / والنتيجة صدمتني" — each line 3-4 words, builds in 3 beats',
  'Carousel slide 1: "X أشياء غلطانة تسويها يومياً بدون ما تعرف" — question/problem saves hook',
  'X opening: "رأي قد يزعجك: [bold claim]. Thread عن ليش." — curiosity gap + thread signal',
  'LinkedIn: "قررت أجرّب ـ لمدة ٩٠ يوماً. المفاجأة ما توقعتها. هذا اللي تعلّمته:"'
]),

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Saudi Gen-Z Psychology: Anti-Advertising Immune System
-- ─────────────────────────────────────────────────────────────────────────────

('cultural_intelligence', 'saudi',
 'Saudi Gen-Z Psychology 2025: Anti-Advertising Immune System',
 'Saudi Gen-Z (18-30) has been marketed to heavily since childhood. They have developed a sophisticated radar for "brand voice" versus "human voice." Understanding this is more important than knowing vocabulary — you can use perfect Najdi dialect and still get skipped if the copy feels like an ad.

THE TRUST HIERARCHY (what Saudi Gen-Z trusts, ranked):
1. A friend''s WhatsApp message (highest trust — invisible, feels private)
2. A creator they follow for months reviewing something (earned trust)
3. A comment from a stranger on a post they discovered organically
4. A story reshared by someone they follow
5. A post from a brand account they chose to follow
6. An ad — boosted post or paid placement (lowest trust)

IMPLICATION FOR COPY: Write every caption as if it belongs to level 2 or 3, not level 5 or 6.

TRUST SIGNALS THAT WORK:
• Specific numbers over vague claims: "١٤ يوم من الاستخدام" > "استخدام يومي لأسابيع"
• Honest caveats: "مو مثالي في كل شيء لكن ـ" builds more trust than pure positive
• First-person singular: "أنا جرّبته" > "الجميع يجرّبونه"
• Mentioning alternatives: "جرّبت ـ و ـ قبله، وهذا أفضل لأن ـ" — honesty signals expertise
• Specific context: "لو عندك بشرة جافة بالذات" > "لكل أنواع البشرة"
• Admission of uncertainty: "مدري لو يناسب الجميع لكن أنا ما ندمت"

COPY PATTERNS THAT TRIGGER SKIP:
• Any copy that could apply to any brand in the category = generic = skip
• Superlatives without proof: "الأفضل" / "الأحسن" = ignored
• The word "فرصة" alone: overused to signal nothing
• Three exclamation marks: reads as desperation
• "سارع بالحجز" = 2010 Saudi marketing energy; Gen-Z physically scrolls away
• Capslock Arabic: READS AS SHOUTING, not emphasis
• Four-line hashtag walls below the caption: signals automation

REVIEW CULTURE (most effective Saudi content format 2023-2025):
• "مراجعة صادقة" (honest review) format outperforms promotional copy 3:1 on saves+shares
• Structure: product received → first impression → [x] days/uses later → honest verdict → recommendation
• The key word is "صادق/صادقة" (honest) — using it in the hook signals the post is worth stopping for
• Always include one genuine negative or limitation — it makes the positive claims 3x more believable',

ARRAY[
  'الأفضل بدون منافس',
  'الأقل سعراً',
  'جودة لا مثيل لها',
  'فرصة لا تعوض',
  'سارع قبل فوات الأوان'
],

ARRAY[
  'Review hook: "مراجعة صادقة لـ[product] بعد ٣٠ يوم — الحلو والمش حلو" (balance = trust)',
  'Specific claim: "جرّبته ١٤ يوم في درجة حرارة الرياض في الصيف — والنتيجة..." (context = credibility)',
  'Honest caveat: "مو مثالي لكل واحد — لو [specific condition] هذا مو لك. لو [other condition] جرّبه." (specificity = sales)',
  'Alternative comparison: "جرّبت [competitor generic ref] قبله — ذا أفضل بسبب [specific reason]" (honesty = authority)',
  'Trust signal: "مدري لو يناسب الجميع، لكن أنا ما ندمت ريال واحد" (uncertainty + satisfaction = powerful combo)'
]),

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Code-Switching Patterns: When Arabic-English Mixing Works in Saudi Copy
-- ─────────────────────────────────────────────────────────────────────────────

('vocabulary', 'saudi',
 'Saudi Arabic Code-Switching: When and How to Mix Arabic-English',
 'Saudi Gen-Z is bilingual in practice. They mix Arabic and English in speech and writing. Brands that mirror this naturalness feel modern and local simultaneously. Brands that avoid it entirely feel stiff; brands that overdo it feel like they''re performing at youth.

WORDS THAT ARE FULLY ARABIZED (use directly in Arabic copy):
These have been absorbed into Saudi social media Arabic as standard words — no italics, no quotation marks:
• بريميوم — premium (quality marker; no Arabic equivalent that feels the same)
• ليجند — legend (for iconic products or people)
• كلاسيك — classic (timeless quality)
• فايب / فايبز — vibe / vibes (atmosphere/feeling)
• هايب — hype (buzz around something)
• تريند — trend (current viral topic)
• تشاليندج — challenge (participation format)
• ريأكشن — reaction (response content)
• فيتشر — feature (product feature)
• أبغريد / أبريتد — upgraded
• بوص — boss (impressive person/move, from gaming)
• كومبو — combo (powerful pairing)
• ليفل — level (raising the level = رفع الليفل)
• فلتر — filter (aesthetic lens; "بدون فلتر" = raw reveal)
• كونتنت — content (the content creator word)
• كريتيف — creative
• لوك — look (aesthetic; used in fashion/beauty)
• فيب / كيب إت ريال — vibe / keep it real (used as-is by Jeddah Gen-Z creators)

ENGLISH WORDS THAT SHOULD NOT BE ARABIZED (use Arabic equivalent instead):
• "يوتيلايز" for يستخدم — never; يستخدم / يستغل works fine
• "أبتيمايز" — avoid; يحسّن / يطوّر
• "سينرجي" — avoid; تآزر (but MSA-heavy); usually just explain the concept
• "إنكريدبل" — avoid; مو طبيعي / يخبّل say it better in Arabic
• Long English sentences with Arabic grammar particles = always awkward

NATURAL CODE-SWITCH PATTERNS IN SAUDI COPY:
• Brand name stays English, surrounding words are Arabic: "جرّبت [Brand Name] الجديد و والله..."
• Product category in English when no elegant Arabic exists: "unboxing حق [product]"
• Product specs/model numbers always stay in English/Western numerals
• Social media terms in their English form within Arabic sentences: "الـinstagram stories", "تيك توك trends"
• Reactions using English phonetics: "واو" (wow Arabized) is fine; raw "WOW" mid-Arabic line is jarring',

ARRAY[
  'يوتيلايز',
  'أبتيمايز',
  'سينرجي',
  'إنكريدبل',
  'ماكسيمايز'
],

ARRAY[
  '"ذا الـvibe مو طبيعي" — this vibe is unreal (Arabized English naturally embedded)',
  '"جرّبت أبغريد روتيني الصباح، والنتيجة؟" — tried to upgrade my morning routine, the result? (Arabized verb)',
  '"بدون فلتر — هذي هي النتيجة الحقيقية" — without filter — this is the real result (Arabized noun as authenticity signal)',
  '"هذا مو بس كلاسيك — ذا ليجند" — this isn''t just classic — this is legend (two Arabized English for max impact)',
  '"الـcontent حقه على مستوى عالي" — his/her content is at a high level (English word with Arabic grammar)'
]),

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Seasonal Copy: Ramadan, National Day, Founding Day
-- ─────────────────────────────────────────────────────────────────────────────

('cultural_intelligence', 'saudi',
 'Saudi Seasonal Copy: Ramadan, National Day, Founding Day',
 'Three content seasons dominate Saudi social media engagement. Brands that plan copy specifically for these moments earn disproportionate reach. Each has a distinct emotional register and vocabulary.

RAMADAN (رمضان):
Emotional register: family warmth, generosity, spiritual reflection, nostalgia, joy.
Peak hours: post-Iftar 7:30-9:30pm / post-Suhoor 4:00-5:30am (highest engagement of the year)
Copy tone: slower, warmer, more lyrical than standard copy. Rushed or urgent copy feels dissonant.

CORE RAMADAN VOCABULARY:
• "روح رمضان" — the spirit of Ramadan (evoking nostalgia and warmth)
• "فرحة الإفطار" — the joy of breaking fast (family moment framing)
• "سهرة رمضان" — the Ramadan evening gathering (social occasion framing)
• "بركة رمضان" — the blessing of Ramadan (gratitude and abundance framing)
• "رمضانكم مبارك" — may your Ramadan be blessed (opening greeting)
• "كل رمضان وأنتم بخير" — every Ramadan and you are well (warm address)
• "ليالي رمضان" — the nights of Ramadan (evenings have special cultural weight)
• "لمّة العيلة" — the family gathering (most powerful Ramadan emotion)
• "جودة اللمّة" — quality of the gathering (premium brand Ramadan positioning)

RAMADAN COPY RULES:
• Never use urgency CTA during Ramadan — it clashes with the contemplative register
• "استمتع" (enjoy/savor) and "شارك" (share) CTAs work better than "اطلب الآن"
• Eid run-up (last 10 days of Ramadan): gift-giving copy starts; urgency returns
• Eid al-Fitr: celebratory, abundance, reward framing ("استحققت هذا")

NATIONAL DAY (اليوم الوطني — 23 سبتمبر):
Emotional register: pride, belonging, heritage, achievement, unity.
Copy tone: confident, celebratory but not boastful. First-person plural "نحن" framing.

CORE NATIONAL DAY VOCABULARY:
• "فخور/فخورة بـ" — proud of (the central emotion)
• "بنينا وبنبني" — we built and we build (past achievement + future ambition)
• "المملكة تاريخ وطموح" — the Kingdom: history and ambition
• "في ذكرى وطننا" — on the anniversary of our homeland
• "شكراً يا وطن" — thank you, homeland (emotional peak phrase)
• "٩٢ عاماً من العطاء" (or relevant year) — years of giving (milestone marking)
• "من هنا ننطلق" — from here we launch (Vision 2030 alignment)
• "سواعد أبناء المملكة" — the arms of the Kingdom''s sons (human capital pride)

FOUNDING DAY (يوم التأسيس — 22 فبراير):
Emotional register: heritage, roots, authentic Saudi identity (pre-modern Kingdom).
Copy tone: historical depth, pride in roots, less Vision 2030 and more Al-Diriyah energy.
Distinct from National Day — Founding Day is about origin, not achievement.

CORE FOUNDING DAY VOCABULARY:
• "عراقة المملكة" — the deep-rootedness of the Kingdom
• "من الدرعية" — from Ad-Diriyah (origin point reference)
• "أصالة وهوية" — authenticity and identity (both words together)
• "تاريخنا يُفخر به" — our history is pride-worthy
• "الإرث المؤسِّس" — the founding heritage',

ARRAY[]::text[],

ARRAY[
  'Ramadan: "في ليالي رمضان، كل لمّة تستاهل أفضل لحظاتها. [Product] معك الحين." (warmth + occasion + soft CTA)',
  'Ramadan Eid run-up: "آخر ١٠ ليالي — هديّة تفرّح. استحق اللي تحب." (urgency returns for Eid gifting)',
  'National Day: "فخورين بكل ما بنيناه، ومتحمّسين لكل ما سنبنيه. عيد وطن سعيد." (pride + ambition)',
  'Founding Day: "من الدرعية للعالم — أصالة ما تنكسر. [Brand] بنفس الجذور." (heritage alignment)',
  'Post-Eid: "رجعنا بطاقة جديدة. الحين الوقت المناسب لـ[product/service]." (post-holiday momentum)'
]),

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Saudi Brand Voice Archetypes (for copywriting_profile selection)
-- ─────────────────────────────────────────────────────────────────────────────

('tone', 'saudi',
 'Saudi Brand Voice Archetypes: 6 Profiles for Copy Generation',
 'When a client''s copywriting_profile.tone_archetype is set, the Copy Engine uses one of these voice profiles as the tonal foundation. Each has a distinct Saudi vocabulary set and sentence rhythm.

ARCHETYPE 1: "الخبير الصادق" — The Honest Expert
Voice: First-person, specific, not afraid to give caveats. Sounds like advice from a well-informed friend.
Vocabulary: بصراحة، صح والله، مدري لكن، الدليل على ذلك، جرّبت بنفسي
Best for: Healthcare, skincare, financial services, professional services, tech reviews
Copy rhythm: Setup (what I found) → Evidence (specific detail) → Honest qualifier → Recommendation

ARCHETYPE 2: "المجتمع المتحمّس" — The Enthusiastic Community
Voice: Warm, plural "نحن", energetic without being pushy. Rewards the in-group.
Vocabulary: يا الجماعة، وييي، عفية عليكم، بلّغوا اللي يستفيد، أنتم تستاهلون
Best for: Lifestyle brands, food/beverage, youth fashion, entertainment, community apps
Copy rhythm: Community address → Shared excitement → Value delivery → Community CTA

ARCHETYPE 3: "المرشد الطموح" — The Ambitious Guide
Voice: Forward-looking, achievement-oriented, Vision 2030 energy. Talks to people who want to improve.
Vocabulary: ارقَ، تميّز، إنجاز، الفرق يصنعه اللي يتقدّم، مستوى جديد
Best for: Education, career platforms, premium fitness, luxury goods, business tools
Copy rhythm: Ambition statement → Gap identification → Path → Achievement vision → Action

ARCHETYPE 4: "الصديق المكتشف" — The Discovery Friend
Voice: Casual, first-person, enthusiastic about sharing finds. The "have you seen this?" energy.
Vocabulary: ما توقعت، طريت، كل ودّي تجرّبوه، مو للكل لكن لو ذوقك كذا، حيل عجبني
Best for: Boutique products, niche brands, artisan/craft, specialty food, hidden gems
Copy rhythm: Discovery story → Specific detail that surprised → Recommendation → Soft nudge

ARCHETYPE 5: "الثقة الهادئة" — The Quiet Confidence
Voice: Minimal words. No over-explanation. The brand doesn''t need to shout; it knows its quality.
Vocabulary: فاخر، نادر، أصيل، الجودة تتكلم، بسيط لأنه راقٍ
Best for: Luxury brands, premium hospitality, fine dining, exclusive products
Copy rhythm: Short visual description → One emotional anchor → Understated CTA (احجز / اكتشف)

ARCHETYPE 6: "الروح الظريفة" — The Witty Spirit
Voice: Dry wit, self-aware, one unexpected observation per post. Never slapstick; always intelligent.
Vocabulary: أومال، ترى، مو معقول، بصراحة مو طبيعي، الجدية تتعب، لا تكون هيّاط
Best for: FMCG, food/beverage, casual fashion, meme-able product moments, campaign activations
Copy rhythm: Observation/contradiction → Light subversion → Brand connection → Witty CTA',

ARRAY[]::text[],

ARRAY[
  'Honest Expert: "بصراحة — مو مثالي لكل بشرة. لكن لو عندك بشرة جافة بالذات، جرّبيه ١٤ يوم."',
  'Enthusiastic Community: "يا الجماعة! البات الجديد وصل — وفية بالوعد ١٠٠٪. بلّغوا اللي ينتظر."',
  'Ambitious Guide: "ارقَ ذا العام. مو بكره — الحين. الخطوة الأولى ما تكلّف شيء."',
  'Discovery Friend: "طريت المعرض بالصدفة — ما توقعت أقعد فيه ساعتين. كل ودّيكم تجرّبوه."',
  'Quiet Confidence: "نادر. فاخر. حصري. كل شيء زيادة عنه كلام." (premium brand — least is most)',
  'Witty Spirit: "ترى الحياة قصيرة على [bad alternative]. [Product] موجود والحين."'
]),

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Saudi Arabic Compliance and Legal Copy Intelligence
-- ─────────────────────────────────────────────────────────────────────────────

('cultural_intelligence', 'saudi',
 'Saudi Arabic Marketing Compliance and Legal Copy Intelligence',
 'Saudi marketing is regulated by GAZT (tax/commerce), CITC (telecoms/digital media), and SFDA (food/drug/cosmetics). Violating these in copy can lead to account suspension or fines. The following rules apply to any AI-generated copy for Saudi market clients.

INFLUENCER AND PAID CONTENT DISCLOSURE (CITC regulations):
• All paid/sponsored content MUST include #إعلان or "إعلان مدفوع" prominently
• This applies to all platforms. Non-disclosure is a CITC violation.
• Placement: must be visible BEFORE the "more" truncation — in the first 125 characters
• Exception: organic brand partnerships where no payment exists — but when in doubt, disclose

FOOD AND BEVERAGE (SFDA regulations):
• Health claims require SFDA approval — never write "يشفي", "يعالج", "يقضي على"
• "يحسّن", "يدعم" (improves, supports) are permissible hedged forms
• Halal certification: when mentioned, must be accurate. "حلال ١٠٠٪" needs SFDA-certified backing
• Supplement claims: very restricted; stick to functional descriptions, not health outcomes
• Do NOT use: "ينقص الوزن بضمان", "يحرق الدهون", "يشفي من" — all SFDA violations

COMMERCE AND PRICING (Ministry of Commerce):
• "خصم [X]٪" must reflect actual previous price — fabricated original prices are a violation
• "أسعار لا تُصدّق" = potential false advertising flag
• Scarcity must be real: "كميات محدودة" when product is abundant = consumer deception
• Competition prizes: must comply with Ministry of Commerce prize promotion rules

REAL ESTATE (REGA):
• No yield or return promises ("عائد استثماري مضمون")
• Project names must match REGA registration

COPY RULES DERIVED FROM COMPLIANCE:
• Write scarcity specifically: "٥٠ قطعة متبقية" > "كميات محدودة" (specific = believable + compliant)
• Health: always use "قد يساعد في" / "يدعم" not "يعالج" / "يشفي"
• Discounts: always say "قبل: X / الحين: Y" with real numbers — never vague percentage without context
• Testimonials: "تجربتي الشخصية" framing is compliant; "ضمان النتيجة" framing is not',

ARRAY[
  'يشفي',
  'يعالج بشكل نهائي',
  'يقضي على',
  'ينقص الوزن بضمان',
  'يحرق الدهون بشكل مثبت',
  'عائد مضمون',
  'أسعار لا تُصدّق',
  'أرخص سعر في المملكة'
],

ARRAY[
  'Health claim: "يدعم الجهاز الهضمي" ✓ vs "يعالج مشاكل الهضم" ✗ (SFDA line)',
  'Scarcity: "باقي ٣٠ قطعة" ✓ vs "كميات محدودة جداً" ✗ (specific = compliant + believable)',
  'Discount: "كان ٢٩٩ ريال، الحين ١٩٩ ريال لمدة ٤٨ ساعة" ✓ vs "خصم ٣٣٪ لا يُصدّق" ✗',
  'Paid content: "#إعلان | [product review]" — disclosure in first line, before truncation ✓',
  'Supplement: "يدعم مستويات الطاقة خلال التمرين" ✓ vs "يرفع مستوى الطاقة بشكل مثبت علمياً" ✗'
]),

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Additional Viral Hook Structures: Saudi 2025 Deep Research
-- ─────────────────────────────────────────────────────────────────────────────

('viral_formats', 'saudi',
 'Saudi Gen-Z 2025: Extended Viral Hook Structures and Caption Patterns',
 'Additional hook and caption patterns identified through deep analysis of top-performing Saudi content 2024-2025. These complement the 8 formats in 030_copywriting_engine.sql.

FORMAT 9: THE HONEST NUMBER
"[Specific number] [surprising unit] و[observation]... [context]... [what this means for the audience]"
Mechanism: Specificity creates instant credibility. Round numbers feel made up; odd numbers feel measured.
Example: "١٤ يوم استخدام يومي — والنتيجة: [specific observation]"
Best for: Beauty, health, fitness, product reviews, case studies.

FORMAT 10: THE CONTRARIAN TAKE
"الكل يقول [common advice]. الحقيقة: [contradiction]. [evidence]. [reframe]."
Mechanism: Challenges the majority opinion — activates the audience''s independent-thinking identity.
Example: "الكل يقول [X]. أنا جرّبت العكس لمدة شهر. والنتيجة غيّرت رأيي."
Best for: Thought leadership, education, coaching, brands that want authority positioning.

FORMAT 11: THE REGRET PREVENTION HOOK
"لو رجعت للوراء، كنت [action]. لأن [reason]. الحين تعرف."
Mechanism: Time-travel regret is one of the strongest emotional motivators. Works especially for Saudis because of strong decision-quality culture.
Example: "لو رجعت للوراء، كنت أبدأ باستخدام [product] أبكر. والسبب واحد: [specific benefit]."
Best for: Long-consideration products, financial products, professional development, any "invest in yourself" category.

FORMAT 12: THE PERMISSION GIVE
"مو لازم [guilt-inducing assumption]. يكفي إنك [low-commitment action]."
Mechanism: Removes friction by lowering the perceived commitment threshold.
Example: "مو لازم تغيّر كل شيء بيوم. يكفي إنك تبدأ بـ[one small action]."
Best for: Wellness, education, fitness, any behavior-change category.

FORMAT 13: THE QUIET REVEAL
"[Simple statement.] [Pause beat.] [Unexpected detail that reframes the first statement.]"
Mechanism: Two-beat structure; the pause creates a micro-story tension that resolves in the second beat.
Example: "اشتريته بـ٨٠ ريال. استخدمته ٣ سنين. الحين أفهم ليش غالي."
Best for: Premium brands defending price point, quality positioning, long-term value products.

FORMAT 14: THE SOCIAL PROOF WITH SPECIFICITY
"[Specific number] شخص جرّب [product/service] في [time period]. [Specific surprising result collective]. [Implication for the reader]."
Mechanism: Specific numbers feel measured; collective results create FOMO; implication closes the logic.
Example: "٢٣٠٠ شخص جرّب [product] هذا العام. ٩ من كل ١٠ رجّعوا اشترى. السؤال: وش تستنى؟"
Best for: Established brands, apps, services with real user data, SaaS.

FORMAT 15: THE SINGLE SENSORY DETAIL
"[Single vivid sensory detail that grounds the reader in the experience.] [One sentence on what this means.] [Invitation to experience it.]"
Mechanism: Sensory specificity bypasses the intellectual skepticism that broad claims trigger. The reader imagines, not evaluates.
Example: "رائحة القهوة تملأ المكان من الطابق الأرضي. هذا النوع من الاستقبال." (coffee brand example)
Best for: Hospitality, food/beverage, fragrance, experience brands, real estate.',

ARRAY[]::text[],

ARRAY[
  'Honest Number: "١٤ يوم، مرتين يومياً — الملاحظة الأولى بعد اليوم السابع." (specific timeline creates credibility)',
  'Contrarian: "الكل يقول ابدأ بالكمية الكبيرة. أنا جرّبت العكس لشهر. النتيجة فاجأتني." (challenges convention)',
  'Regret Prevention: "لو رجعت للوراء، كنت أبدأ به أبكر بسنة. والسبب بسيط جداً:" (time-travel emotion)',
  'Permission Give: "مو لازم تكون خبير. يكفي إنك تعرف هذا الشيء الواحد." (lowers barrier to engagement)',
  'Quiet Reveal: "اشتريته ظننته مبالغة. استخدمته ٣ أشهر. الحين ما أتخيّل بدونه." (two-beat structure)',
  'Sensory: "النسيج مختلف من أول لمسة. هذا النوع من الاختلاف اللي لازم تحس فيه." (sensory bypass)'
]);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Copywriting Engine: copy_sessions tracking
-- ─────────────────────────────────────────────────────────────────────────────

-- Track individual and bulk copy generation sessions for history + resuming
CREATE TABLE IF NOT EXISTS copy_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid        REFERENCES clients(id) ON DELETE SET NULL,
  session_type    text        NOT NULL DEFAULT 'single'
                              CHECK (session_type IN ('single', 'bulk', 'calendar')),
  language        text        NOT NULL DEFAULT 'ar'
                              CHECK (language IN ('ar', 'en', 'both')),
  dialect         text        DEFAULT 'saudi',
  platform        text        NOT NULL DEFAULT 'instagram',
  framework       text        NOT NULL DEFAULT 'auto',
  caption_length  text        DEFAULT 'medium'
                              CHECK (caption_length IN ('micro', 'short', 'medium', 'long', 'extended')),
  emoji_style     text        DEFAULT 'none'
                              CHECK (emoji_style IN ('none', 'minimal', 'moderate', 'rich')),
  hashtag_style   text        DEFAULT 'none'
                              CHECK (hashtag_style IN ('none', 'minimal', 'standard', 'max')),
  preferred_hashtags text[]   DEFAULT '{}',
  custom_cta      text,
  tone_intensity  smallint    DEFAULT 3 CHECK (tone_intensity BETWEEN 1 AND 5),
  variant_count   smallint    DEFAULT 1 CHECK (variant_count BETWEEN 1 AND 3),
  bulk_rows_total int         DEFAULT 0,
  bulk_rows_done  int         DEFAULT 0,
  bulk_rows_error int         DEFAULT 0,
  status          text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'processing', 'complete', 'partial_error')),
  output_json     jsonb       DEFAULT '[]'::jsonb, -- array of generated results per row
  created_by      uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS copy_sessions_client_idx
  ON copy_sessions (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS copy_sessions_user_idx
  ON copy_sessions (created_by, session_type, created_at DESC);

ALTER TABLE copy_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_manage_copy_sessions" ON copy_sessions
  FOR ALL USING (auth.uid() IS NOT NULL);
