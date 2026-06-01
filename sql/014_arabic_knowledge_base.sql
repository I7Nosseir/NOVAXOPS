-- 014_arabic_knowledge_base.sql
-- Admin-editable Arabic content intelligence rules.
-- The AI route reads from this table (cached 10 min) and injects rules into
-- system prompts for all text-generating agents when a client's dialect is set.

CREATE TABLE arabic_knowledge_base (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category      text        NOT NULL CHECK (category IN (
                              'vocabulary', 'tone', 'banned_phrases',
                              'cultural_intelligence', 'formatting', 'cta_patterns'
                            )),
  region        text        NOT NULL CHECK (region IN ('egyptian', 'saudi', 'gulf', 'msa', 'all')),
  rule_name     text        NOT NULL,
  context_rules text        NOT NULL,
  banned_phrases text[]     DEFAULT '{}',
  examples      text[]      DEFAULT '{}',
  is_active     boolean     DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX arabic_kb_region_category_idx
  ON arabic_knowledge_base (region, category)
  WHERE is_active = true;

ALTER TABLE arabic_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Admins and CEOs manage the table; all authenticated users can read
CREATE POLICY "admin_ceo_manage_arabic_kb" ON arabic_knowledge_base
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid() AND role IN ('admin', 'ceo')
    )
  );

CREATE POLICY "authenticated_read_arabic_kb" ON arabic_knowledge_base
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ─── SEED: Universal rules (region = 'all') ───────────────────────────────────

INSERT INTO arabic_knowledge_base (category, region, rule_name, context_rules, banned_phrases) VALUES

('banned_phrases', 'all', 'Universal AI Signature Phrases',
'These phrases appear in AI-generated Arabic and immediately break reader trust. They signal that no human wrote this. Never use them.',
ARRAY[
  'عزيزي العميل',
  'يسعدنا خدمتكم',
  'نودّ إعلامكم بأن',
  'وفقاً للمعلومات المتوفرة',
  'من الجدير بالذكر أن',
  'في هذا السياق',
  'لا شك أن',
  'بكل تأكيد',
  'دعنا نستكشف',
  'دعنا نتعمق في',
  'يُعدّ هذا نهجاً شاملاً',
  'من خلال هذا المنطلق',
  'تجدر الإشارة إلى',
  'وتجدر الإشارة',
  'وفي هذا الإطار',
  'وفي سياق متصل',
  'الجدير بالذكر',
  'ومن المهم الإشارة',
  'يُشار إلى أن',
  'وبناءً على ما سبق'
]),

('formatting', 'all', 'Arabic Social Media Formatting Rules',
'Right-to-left text on social media platforms renders best when: sentences are short (under 15 words), punctuation goes at the END of lines not the beginning, no mixing of Arabic and English punctuation (use Arabic comma ، not English comma in Arabic sentences), and line breaks are used generously. The platform does NOT automatically right-align — write copy that reads cleanly left-to-right in the code but correctly right-to-left in the feed.',
ARRAY[]::text[]),

('tone', 'all', 'Universal Arabic Social Media Tone',
'Arabic social media copy must feel like it was written by a thoughtful person, not a marketing department. The best Arabic content sounds like advice from a knowledgeable friend. Avoid the "corporate Arabic" register used in government announcements and press releases. The copy should pass the "read it out loud" test — if it sounds unnatural spoken, rewrite it.',
ARRAY['وبناءً على ذلك', 'وفي ضوء ما تقدّم', 'استناداً إلى']);

-- ─── SEED: Egyptian Arabic rules ─────────────────────────────────────────────

INSERT INTO arabic_knowledge_base (category, region, rule_name, context_rules, banned_phrases, examples) VALUES

('vocabulary', 'egyptian', 'Core Egyptian Social Media Vocabulary',
'Egyptian Arabic dominates Arab social media. These are the words that make copy feel native to Egyptian audiences aged 18-40.',
ARRAY['ماذا', 'هل تعلم أن', 'عزيزي'],
ARRAY[
  '"يا سلام" — use to open a surprising fact or reveal (drives saves and shares)',
  '"بجد" — adds authenticity to any claim ("بجد مش هتصدق")',
  '"مش كده؟" — rhetorical hook that drives comments and replies',
  '"يلا جرّب" — urgency CTA that feels peer-to-peer not pushy',
  '"أهو" / "أهي" — used before a reveal (builds anticipation)',
  '"أكيد" — confident affirmation (not "بالطبع" which reads formal)',
  '"حلو أوي" — approval phrase (not "ممتاز" which sounds textbook)'
]),

('cta_patterns', 'egyptian', 'Egyptian Arabic CTA Patterns',
'Call-to-action phrases that convert in Egyptian dialect. Avoid English-translated CTAs — they sound unnatural.',
ARRAY['انقر هنا', 'اضغط للمزيد', 'تواصل معنا عبر', 'للاستفسار يرجى'],
ARRAY[
  '"جرّب دلوقتي" — try it now (strongest conversion CTA)',
  '"اتواصل معانا" — contact us (dialect form, not "تواصل معنا")',
  '"شاركنا رأيك" — share your opinion (drives comments)',
  '"احجز مكانك" — reserve your spot (event/product CTAs)',
  '"حمّل الآن" — download now (app campaigns)',
  '"اعرف أكتر" — learn more (awareness stage)'
]),

('cultural_intelligence', 'egyptian', 'Egyptian Cultural Reference Points',
'These cultural anchors make Egyptian copy feel native and not imported. Use sparingly and only when authentic to the client''s brand.',
ARRAY[]::text[],
ARRAY[
  'Egyptian humour: self-aware, witty, never slapstick for premium brands. The audience rewards brands that can laugh at themselves.',
  'Football reference: Al-Ahly/Zamalek is a universal connector but use neutrally — never pick a side.',
  'Ramadan framing: family, togetherness, giving ("فرحة العيد", "روح رمضان") — highest-stakes content season.',
  '"ابن البلد" / "بنت البلد" — authenticity frame. Brands that earn this feel genuinely Egyptian.',
  'Cairo references work for urban brands; national references (Nile, history, pyramids) work for all brands.',
  'Egyptian pride in civilisation and resilience: "بنينا الأهرامات" energy — use for heritage/premium brands.'
]);

-- ─── SEED: Saudi Arabic rules ─────────────────────────────────────────────────

INSERT INTO arabic_knowledge_base (category, region, rule_name, context_rules, banned_phrases, examples) VALUES

('vocabulary', 'saudi', 'Core Saudi Social Media Vocabulary',
'Saudi and Gulf social media users aged 18-40 use a semi-formal hybrid of Gulf dialect and MSA. This is NOT pure dialect — it is the register they actually speak in captions and stories.',
ARRAY['إيه', 'يا سلام', 'أهو', 'دلوقتي', 'أوي'],
ARRAY[
  '"زين" / "خوش" — great/good (preferred over "جيد" which sounds textbook)',
  '"وايد" — very/a lot (natural Gulf intensifier, alongside "جداً")',
  '"الحين" — right now (conversational, alongside "الآن")',
  '"ما قصّرت" — you did great (highest form of Saudi praise)',
  '"يستاهل" — it''s worth it / deserves it',
  '"صج؟" — really? (hooks that drive replies on Saudi X/Twitter)',
  '"بالتوفيق" — good luck (universal Saudi sign-off)'
]),

('cta_patterns', 'saudi', 'Saudi Arabic CTA Patterns',
'CTAs that convert with Saudi audiences. Saudi users respond to aspirational and achievement framing.',
ARRAY['انقر هنا', 'اضغط للمزيد'],
ARRAY[
  '"احجز الآن" — book now (highest converting for premium products)',
  '"جرّبها اليوم" — try it today (product launches)',
  '"شاركنا رأيك" — share your opinion (community engagement)',
  '"اكتشف المزيد" — discover more (awareness campaigns)',
  '"انضم إلينا" — join us (community/loyalty programs)',
  '"سجّل مجاناً" — register free (app/service sign-ups)'
]),

('cultural_intelligence', 'saudi', 'Saudi Cultural Intelligence',
'Saudi audiences reward brands that understand Vision 2030, Islamic values, and the balance of modernity and heritage. Brands that ignore either feel foreign.',
ARRAY[]::text[],
ARRAY[
  'Vision 2030: reference when relevant for entertainment, business, innovation, lifestyle brands. Frame as: ambition + heritage.',
  'National Day (23 Sep) and Founding Day (22 Feb): highest-traffic Saudi content dates. Plan anchor posts.',
  'Islamic calendar: Ramadan post-Iftar (7:30-9:30pm) and post-Suhoor (4-5am) are peak engagement windows.',
  '"المملكة" — how Saudis call their country in content (more natural than "السعودية" in casual copy).',
  'Giga-projects (NEOM, Diriyah, Red Sea): resonate for premium and lifestyle brands.',
  'Men''s copy: حظوة (prestige), إنجاز (achievement), تميّز (distinction).',
  'Women''s copy: تمكين (empowerment), أصالة (authenticity), ثقة (confidence).',
  'Humour: dry wit works. Slapstick does not fit premium brands. Self-deprecating humour requires a strong brand to carry.'
]);

-- ─── SEED: Gulf (Pan-Gulf) rules ─────────────────────────────────────────────

INSERT INTO arabic_knowledge_base (category, region, rule_name, context_rules, banned_phrases, examples) VALUES

('vocabulary', 'gulf', 'Pan-Gulf Vocabulary',
'For campaigns targeting UAE, Kuwait, Bahrain, Qatar, Oman simultaneously. Avoid Saudi-specific or Egyptian-heavy vocabulary. Use cross-Gulf phrases that feel native to all.',
ARRAY['إيه', 'يا سلام', 'أهو', 'دلوقتي', 'زين', 'وايد'],
ARRAY[
  '"يا هلا" — welcoming greeting (universally Gulf, never Egyptian)',
  '"يهلا وسهلا" — welcome, more formal version',
  '"يستاهل" — worth it / deserves it (cross-Gulf approval)',
  '"ما شاء الله" — mashallah (achievement and appreciation contexts)',
  '"الله يبارك" — God bless (warm acknowledgment of effort)',
  '"بالقوة" — powerful/strong (Gulf approval expression)'
]),

('cultural_intelligence', 'gulf', 'Pan-Gulf Cultural Intelligence',
'Each Gulf state has distinct characteristics. When targeting all simultaneously, focus on shared values.',
ARRAY[]::text[],
ARRAY[
  'UAE: multicultural, English mixed in is authentic ("بالإنجليزي شوي" is normal for urban Emiratis).',
  'Kuwait: conservative, family-first. Quality and heritage matter above trends.',
  'Qatar: aspirational, sports legacy (World Cup), global positioning.',
  'Bahrain: slightly more liberal, finance/business audience prominent.',
  'Shared values: pearl diving heritage, Islamic hospitality (كرم), family pride, seafaring history.',
  '"نحن" (we) framing: strong for community and loyalty campaigns across all Gulf states.'
]);

-- ─── SEED: MSA rules ─────────────────────────────────────────────────────────

INSERT INTO arabic_knowledge_base (category, region, rule_name, context_rules, banned_phrases, examples) VALUES

('tone', 'msa', 'MSA Social Media Register',
'Modern Standard Arabic for social media is NOT classical Arabic and NOT dialect. It is the register of quality pan-Arab journalism (Al-Jazeera, BBC Arabic). Sentences under 20 words. No archaic constructions. No dual forms unless natural. Accessible to all Arabic speakers while maintaining pan-Arab credibility.',
ARRAY[
  'أيها المتلقّون',
  'وقد جرت العادة أن',
  'اتّخذ مكانه الرياديّ',
  'وفي هذا الإطار العام',
  'إذ تشير المعطيات إلى',
  'ومن هذا المنطلق'
],
ARRAY[
  'Write like BBC Arabic writes — not like a government ministry.',
  'MSA works best for: B2B brands, healthcare, finance, education, pan-Arab campaigns.',
  'Avoid using MSA for: youth brands, food/beverage, entertainment — dialect converts better there.'
]);
