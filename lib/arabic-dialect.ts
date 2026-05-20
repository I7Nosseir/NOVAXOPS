// Arabic dialect guidance injected into AI prompts for social media generation.
// Claude has base Arabic knowledge — this sharpens it to specific dialect registers
// and social media vocabulary that native LLMs underperform on.

export type ArabicDialect = 'msa' | 'saudi' | 'egyptian' | 'gulf'

export function getArabicDialectGuide(dialect: ArabicDialect = 'msa'): string {
  const guides: Record<ArabicDialect, string> = {

    msa: `
ARABIC VARIANT: Modern Standard Arabic (الفصحى المعاصرة)
Write in contemporary MSA — formal enough for pan-Arab credibility, accessible enough for social media.
Avoid archaic constructions (classical verb-subject-object order, dual forms unless natural).
Preferred register: quality press Arabic (Al-Jazeera, BBC Arabic level).
Sentence structure: keep under 20 words per sentence for mobile readability.`,

    saudi: `
ARABIC VARIANT: Saudi / Gulf Arabic — Social Media Register
Write in a style that resonates with Saudi users aged 18–40 on Instagram, TikTok, X (Twitter).
This is NOT pure Gulf dialect — it's the semi-formal hybrid Saudi social media users actually speak.

AUTHENTIC VOCABULARY:
• "زين" / "خوش" — great/good (preferred over "جيد" which sounds textbook)
• "وايد" — very/a lot (Gulf: more natural than "جداً" in casual contexts)
• "الحين" — right now (alongside "الآن")
• "ما قصّرت" — you didn't fall short (praise/appreciation)
• "الله يعطيك العافية" — God give you wellness (common sign-off for effort)
• "يستاهل" — it's worth it / he/she deserves it
• "صج؟" / "والله؟" — really? (conversational hooks that drive replies)
• "بالتوفيق" — good luck (universally understood Saudi farewell)

CULTURAL INTELLIGENCE:
• Saudi Vision 2030: reference when relevant (entertainment, business, innovation content)
• Islamic calendar awareness: Ramadan, Eid, Muharram content shifts in tone significantly
• National Day (23 Sep) and Founding Day (22 Feb) — highest-traffic Saudi content dates
• Work week starts Sunday; Friday is the holy day (not weekend brunch content)
• Giga-projects (NEOM, Diriyah, Red Sea Project) resonate for premium/lifestyle brands
• "المملكة" — how Saudis refer to their country in content (not "السعودية" which is more formal)

TONE CALIBRATION FOR SAUDI AUDIENCE:
• Warm, community-oriented — "أسرة واحدة" (one family) framing for brand communities
• Aspirational + rooted in heritage pride — don't choose one, blend both
• Direct CTAs work well: "احجز الآن" / "جرّبها اليوم" / "شاركنا رأيك"
• Avoid overly Egyptian colloquialisms (they read as "imported" content)
• Humour: dry wit works; slapstick doesn't fit premium brands
• Men's content: حظوة (prestige), إنجاز (achievement), تميّز (distinction)
• Women's content: تمكين (empowerment), أصالة (authenticity), ثقة (confidence)

HASHTAG STYLE (if requested):
Saudi hashtags are in Arabic script. Use underscore between words: #منتج_رائع
Gulf trending format: mix one Arabic + one English hashtag`,

    egyptian: `
ARABIC VARIANT: Egyptian Arabic (عامية مصرية) — Social Media Register
Egyptian dialect dominates Arab social media due to Egypt's cultural output (TV, music, cinema).
This is the most universally understood Arabic dialect — safe for pan-Arab campaigns with a warm, accessible tone.

AUTHENTIC VOCABULARY:
• "إيه" — what (replaces "ماذا" in conversation)
• "تمام" / "عظيم" — great/perfect (warmer than "ممتاز")
• "يا سلام" — wow/amazing (positive exclamation, high engagement phrase)
• "بجد" / "فعلاً" — seriously/for real (adds authenticity to claims)
• "مش كده؟" — isn't that right? (rhetorical hook that invites replies)
• "أهو" / "أهي" — there it is (emphasis, pride, reveal)
• "يلا" — come on / let's go (urgency, momentum)
• "يعني" — I mean / which means (natural connector, don't overuse)
• "أكيد" — of course / definitely (confident affirmation)
• "حلو أوي" — very nice/beautiful (Egyptian: "أوي" = very)
• "ربنا يوفقنا" — may God guide us (religious acknowledgment, appropriate sign-off)
• "عيني" / "يا حبيبي" — terms of endearment (use in warm/personal brand voice)

CULTURAL INTELLIGENCE:
• Egyptian humour is a strategic asset — light, relatable wit drives massive engagement
• Cairo vs. rest of Egypt: urban references work for lifestyle brands; national references for all brands
• Ramadan in Egypt = highest-stakes season (TV content, social surges, family values)
• Football (الكرة) is universal connector — Al-Ahly/Zamalek rivalry is cultural touchstone
• "ابن البلد" (son of the country) / "بنت البلد" — authenticity frames that resonate
• Egyptian pride: civilisation, history, pyramids — works for heritage positioning

TONE CALIBRATION FOR EGYPTIAN AUDIENCE:
• Warmest tone of all Arabic dialects — can use "إنت" (you) directly without feeling presumptuous
• Punchy and brief — Egyptians appreciate wit and efficiency in copy
• Playful but not frivolous — Egyptian humour is self-aware, not silly
• Self-deprecating humour works if the brand can carry it
• Emotional storytelling resonates: family, effort, persistence, triumph
• CTAs: "جرّب دلوقتي" / "اتواصل معانا" / "شاركنا" (Egyptian dialect forms)

HASHTAG STYLE (if requested):
Mix Egyptian Arabic + MSA hashtags. Egyptian users mix Arabic and Arabized English: #كول / #لايف_ستايل`,

    gulf: `
ARABIC VARIANT: Pan-Gulf Arabic (خليجي عام)
For campaigns targeting UAE, Kuwait, Bahrain, Qatar, Oman — avoid Saudi-specific or Egyptian-heavy vocabulary.

AUTHENTIC VOCABULARY:
• "يا هلا" — welcoming greeting (universally Gulf)
• "يهلا وسهلا" — welcome (more formal version)
• "تفضّل / تفضّلي" — please, go ahead (hospitality phrase)
• "يستاهل" — worth it / deserves (cross-Gulf)
• "شكراً جزيلاً" — formal thanks (preferred in Emirati/Kuwaiti formal contexts)
• "بالقوة" — powerful/strong (Gulf approval expression)
• "ما شاء الله" — mashallah (appreciation, achievement contexts)
• "الله يبارك" — God bless (warm acknowledgment)

CULTURAL INTELLIGENCE:
• UAE: multicultural, English mixed in is fine and authentic ("بالإنجليزي شوي" is normal)
• Kuwait: conservative, family-first values; quality and heritage matter
• Qatar: aspirational, sports (World Cup legacy), global positioning
• Bahrain: slightly more liberal, finance/business audience prominent
• Shared: pearl diving heritage, seafaring, Islamic values, hospitality (كرم)

TONE:
• Professional hospitality — premium feel without being cold
• Heritage-pride framing: roots, lineage, authenticity
• Aspirational but not Western-aspirational — Gulf-specific success markers
• Avoid Egyptian colloquialisms (reads as "imported" to Gulf audiences)
• "نحن" (we) framing for community brands`,
  }

  return guides[dialect] ?? guides.msa
}

// Client dialect preference — stored in brand_identity_json as `dialect`
export function getClientDialect(brandIdentity: Record<string, unknown>): ArabicDialect {
  const d = brandIdentity?.dialect as string | undefined
  if (d === 'saudi' || d === 'egyptian' || d === 'gulf' || d === 'msa') return d
  return 'msa'
}

// Humanization rules — baked into prompts to defeat AI detectors
export const HUMANIZATION_RULES_EN = `
HUMANIZATION RULES (apply to every variant — content must pass AI detection):

SENTENCE RHYTHM (burstiness):
AI text has uniform sentence length. Human text does not.
Short sentences hit harder. Then a slightly longer one builds momentum and gives the reader context before the next beat lands.
Alternate: short. Medium-length sentence with a natural qualifier. Short punch. Longer flowing thought. Short close.

BANNED WORDS (AI signature vocabulary — never use):
delve, certainly, absolutely, straightforward, comprehensive, leverage, showcase, pivotal,
seamless, tailored, realm, nuances, "it's worth noting", "in conclusion", "in summary",
commendable, invaluable, revolutionize, transformative, wholeheartedly, embark, facilitate,
utilize (use "use"), demonstrate (use "show"), commence (use "start"), endeavor (use "try")

NATURAL SYNTAX:
• Start some sentences with "And" or "But" — humans do this, AI avoids it
• Use em dashes — like this — instead of parentheses or semicolons
• Use contractions: "you'll", "it's", "they're" (AI defaults to the full form)
• One rhetorical question per post is fine. Two is one too many.
• Fragments work. Use them.

VOCABULARY NATURALNESS:
• Choose the word that feels right, not the most impressive synonym
• "good" beats "exceptional" if "good" is what a human would say
• One unexpected, specific word per variant (the kind humans actually use)

PERSONAL VOICE:
• Add one grounding phrase: "Here's the thing —" / "Honestly," / "Most people don't realize..."
• A small opinion or observation: "I'd argue...", "What most brands miss..."
• This creates the personal stake that AI text always lacks`

export const HUMANIZATION_RULES_AR = `
قواعد الأسلوب الإنساني (لتجاوز كواشف الذكاء الاصطناعي):

إيقاع الجمل:
• النص البشري يتنوّع في طوله — جملة قصيرة. ثم جملة أطول تبني السياق وتمنح القارئ لحظة تنفّس. ثم ضربة قصيرة.
• تجنّب الجمل المتماثلة في الطول — هذه علامة الذكاء الاصطناعي الأولى

كلمات محظورة (بصمة الذكاء الاصطناعي — لا تستخدمها):
• "بالتأكيد" في بداية الجملة
• "من الجدير بالذكر أن"
• "في الختام" / "خلاصة القول"
• "يُعدّ هذا نهجاً شاملاً"
• "دعنا نستكشف" / "دعنا نتعمّق"
• "بشكل لافت للنظر"

الأسلوب الطبيعي:
• استخدم الواو والفاء في بداية الجمل (البشر يفعلون هذا)
• الأسئلة البلاغية: جملة واحدة كافية — لا تُكثر منها
• الجمل الناقصة مقبولة. تُضيف إيقاعاً.
• استخدم الشرطة — هكذا — بدلاً من الأقواس

الصوت الشخصي:
• أضف إشارة رأي صغيرة: "والحقيقة أن..." / "ما يغفل عنه الكثيرون..."
• هذا ما يميّز الكتابة البشرية عن الاصطناعية`
