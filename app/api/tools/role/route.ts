import { NextRequest, NextResponse } from 'next/server'

const GEMINI_MODEL = 'gemini-3-flash-preview'

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
    throw new Error(`Gemini ${res.status}: ${err}`)
  }
  const data = await res.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

interface RoleToolRequest {
  role: string
  tool: string
  input: string
  client_id?: string
  client_name?: string
}

function buildPrompt(tool: string, input: string, clientName: string | undefined): string {
  const client = clientName ?? 'the client'

  switch (tool) {

    // ─────────────── COPYWRITER TOOLS ───────────────

    case 'caption_rewriter':
      return `You are a world-class social media copywriter with deep expertise in persuasion science, platform algorithms, and brand voice preservation. Your task is to rewrite the following caption in 3 distinct variants.

ORIGINAL CAPTION:
${input}

Produce exactly 3 variants with these labels and frameworks:

VARIANT 1 — PUNCHY
Framework: Pattern interrupt + single emotional punch. Lead with a counterintuitive or surprising first line (max 8 words). Strip every non-essential word. No pleasantries, no preamble — straight into the hook. Best for Reels and TikTok where dwell time is under 2 seconds.

VARIANT 2 — INFORMATIVE
Framework: Authority + value ladder. Open with a specific fact, number, or expert claim. Build credibility through specificity. Deliver actionable insight the reader cannot get elsewhere. Best for LinkedIn and Facebook carousel posts.

VARIANT 3 — STORY-LED
Framework: Open loop narrative (Pixar structure compressed into 5–8 lines). Drop the reader into a scene mid-action. Build micro-tension. Resolve with the brand message as the natural conclusion — never forced. Best for Instagram feed and Facebook.

RULES FOR ALL VARIANTS:
- No hashtags, no emojis
- First line of each variant must be under 125 characters (what appears before "see more" on Instagram)
- Each variant must use a genuinely different emotional lever — not just tone variation
- Return only the variants. No meta-commentary, no labels beyond "VARIANT 1", "VARIANT 2", "VARIANT 3".`

    case 'tone_checker':
      return `You are a brand voice guardian and copy editor with expertise in professional social media standards. Your task is to analyse the following copy against brand voice best practices.

COPY TO ANALYSE:
${input}

Conduct a rigorous tone analysis using these 5 dimensions:

1. BRAND PROFESSIONALISM SCORE (0–100)
   Assess: Does this copy sound like a competent, confident brand or like an intern guessing? Specific deductions for: filler phrases ("we are excited to...", "we are thrilled..."), passive voice overuse, generic claims without specifics, or hollow corporate speak.
   Score with calibration: 85+ = genuinely strong. 60–84 = serviceable but forgettable. Below 60 = requires significant rework.

2. CLARITY SCORE (0–100)
   Assess: Can the core message be extracted in one read? Apply Flesch Reading Ease principles — shorter sentences, active voice, concrete nouns. Flag any sentence over 25 words.

3. AUTHENTICITY SCORE (0–100)
   Assess: Does it sound like a human brand with a real perspective, or like a template? Deduct points for: rhetorical questions with obvious answers, buzzwords without substance ("innovative", "seamless", "game-changing"), and excessive exclamation marks.

4. PLATFORM FIT
   Identify what platform this copy is best suited for and why. If it does not fit any major platform well, explain what must change.

5. TOP 3 CORRECTIONS
   For each: quote the exact phrase to change → provide the rewritten version → explain the science or principle behind the improvement (e.g. "Active voice reduces cognitive load and increases trust — Nielsen 2006").

Format your response clearly with each numbered section. Be specific — vague feedback like "improve clarity" is not acceptable.`

    case 'hook_generator':
      return `You are a viral content strategist who has analysed 10,000 top-performing social media posts across Instagram, TikTok, LinkedIn, and Facebook. You understand the neuroscience of scroll-stopping content: pre-attentive attributes, curiosity gaps, pattern interrupts, and high-arousal emotion triggers.

TOPIC:
${input}

Generate 5 hooks for this topic, each using a different psychological mechanism. Rank them 1–5 by estimated scroll-stop rate (1 = highest).

For each hook provide:
HOOK [N]: [The exact hook text — written as the first line of a post]
Mechanism: [The specific psychological trigger being used — e.g. "Zeigarnik effect: open loops create cognitive tension that demands resolution"]
Platform fit: [Best 1-2 platforms and the specific reason]
Engagement type: [Will this drive saves, shares, comments, or profile visits — and why]

HOOK TYPES to cover (use each once):
1. Counterintuitive statement — challenges a commonly held belief
2. Specific number + outcome — triggers specificity bias (brains trust numbers)
3. Identity-based open loop — addresses an in-group fear or desire directly
4. Curiosity gap — reveals the question but withholds the answer
5. Social proof reversal — references what the majority does wrong

RULES:
- Each hook must be under 125 characters (Instagram "see more" cutoff)
- No hashtags, no emojis
- No question marks that have obvious answers (weak hooks)
- Write the hooks as if they're going live tomorrow — not as examples or templates`

    case 'arabic_translator':
      return `You are a senior Arabic copywriter specialising in Gulf dialect social media content. You are translating professional marketing copy from English to Arabic for use on Instagram, Facebook, and LinkedIn.

ENGLISH TEXT TO TRANSLATE:
${input}

Produce a professional Gulf dialect (khaleeji) translation optimised for social media. Follow these rules precisely:

DIALECT RULES:
- Use Gulf Arabic vocabulary where natural (e.g. "زين" not "كويس", "شلون" not "كيف" for informal contexts)
- For professional/brand contexts: Modern Standard Arabic with Gulf lexical choices
- Right-to-left text — all punctuation must be correct for Arabic
- Numbers: use Arabic-Indic numerals (٢٠٢٥) for native feel, Western numerals (2025) for statistics and data

COPY STANDARDS:
- No hashtags, no emojis
- Preserve the exact brand message — do not add or remove claims
- Maintain the same emotional tone as the original
- If the original uses a specific persuasion framework (AIDA, PAS, etc.) preserve its structure in Arabic
- Marketing Arabic sounds warm and direct — avoid stiff, bureaucratic MSA constructions

OUTPUT FORMAT:
Provide:
1. The full Arabic translation
2. A brief transliteration guide for any Gulf-specific words used (so non-Arabic speakers on the team can understand the dialect choices)
3. One short note if any English idiom required creative adaptation`

    // ─────────────── DESIGNER TOOLS ───────────────

    case 'design_brief_summarizer':
      return `You are a creative director at a premium social media agency with 15 years of experience briefing designers. Your task is to synthesise a design brief into 5 sharp visual direction points.

CLIENT: ${client}
BRIEF INPUT:
${input}

Extract and crystallise exactly 5 visual direction points. Each point must be:
- Specific and actionable — a designer can make creative decisions from it
- Visual — about what the eye sees, not strategy or copy
- Non-generic — no point should apply to "any client"

FORMAT EACH POINT AS:
[N]. [CATEGORY IN CAPS]: [One sentence of precise visual direction]

Categories to cover (assign the most relevant 5):
- COMPOSITION: grid system, white space, visual hierarchy, focal point
- COLOUR APPLICATION: which palette values to use for which elements, contrast ratios
- TYPOGRAPHY: typeface personality, weight distribution, size hierarchy, letter-spacing
- IMAGERY / PHOTOGRAPHY: subject, mood, lighting style, colour temperature, crop style
- MOTION / ANIMATION: pace, easing style, transition type, duration guidelines
- TEXTURE / DEPTH: surface quality, layering, shadows, dimensional effects
- BRAND MARKS: logo placement, safe zones, co-branding rules

After the 5 points, add one line: "AVOID:" followed by the single most common design mistake for this type of brief.`

    case 'asset_keyword_extractor':
      return `You are a visual research specialist and art director. Your task is to extract the 8 most effective image search keywords from a social media post caption.

CAPTION:
${input}

Extract exactly 8 keywords optimised for finding high-quality stock imagery or triggering AI image generation. Apply these criteria:

KEYWORD SELECTION RULES:
- Specificity over generality: "woman applying serum in soft morning light" beats "skincare"
- Include: subject, setting/environment, lighting, mood/emotion, composition hint where relevant
- Avoid generic single words that will return thousands of irrelevant results
- Mix keyword types: 3–4 subject/scene keywords, 2–3 mood/atmosphere keywords, 1–2 technical/style keywords (e.g. "macro photography", "flat lay", "overhead shot")

OUTPUT FORMAT:
List each keyword on its own line:
1. [keyword or short phrase] — [one-sentence reason: what this will find and why it's relevant to this caption]
2. ...

After the 8 keywords, suggest the single best AI image generation prompt (Midjourney/Flux/DALL-E style) that combines the strongest elements into one complete prompt.`

    case 'format_recommender':
      return `You are a platform specialist and content strategist with expertise in social media format performance data. Recommend the optimal canvas specifications for this content.

CONTENT DESCRIPTION:
${input}

Provide a comprehensive format recommendation covering these 4 areas:

1. PRIMARY FORMAT RECOMMENDATION
   Format name, canvas dimensions (W×H px), aspect ratio, and the specific platform(s) this is optimised for. Explain WHY this format matches the content type described — reference platform algorithm data where relevant (e.g. "Instagram Reels at 9:16 receive 35% more distribution than feed posts — Meta Business Insights 2024").

2. SECONDARY FORMAT
   The second-best format for repurposing — different platform, different dimensions. Explain the content adaptation required.

3. TECHNICAL SPECS
   - Resolution: minimum DPI/PPI required
   - Safe zones: where UI elements (captions, buttons) will overlap — avoid placing key elements here
   - Max file size for platform upload limits
   - Recommended file format (PNG for graphics, JPG for photography, MP4 for video — with codec spec)
   - Character limit for any text overlay (platform-specific)

4. COMMON MISTAKES FOR THIS FORMAT
   The 2 most common production errors for this specific format that result in rejection or poor performance.`

    case 'color_palette_check':
      return `You are a brand identity consultant and colour psychologist. Evaluate the described colour palette against professional brand standards.

COLOUR PALETTE DESCRIPTION:
${input}

Conduct a rigorous brand colour assessment across 4 dimensions:

1. COLOUR PSYCHOLOGY ANALYSIS
   For each colour described: the primary psychological association it triggers in viewers, the industries it signals (correct or incorrect for this brand), the emotional valence (calm/energetic, trust/excitement, premium/accessible), and gender/demographic perception patterns.

2. CONTRAST & ACCESSIBILITY CHECK
   Assess whether the described combination meets WCAG 2.1 AA standard (4.5:1 contrast ratio for normal text, 3:1 for large text). Flag any combination that would fail readability tests. Provide specific guidance: "light text on X background requires a minimum shade of Y to pass AA."

3. BRAND COHERENCE SCORE (0–100)
   Does this combination tell a coherent brand story? Does it suggest a consistent personality? Score with: 80+ = strong, memorable palette. 60–79 = functional but generic. Below 60 = confusing or clashing signals.

4. SPECIFIC RECOMMENDATIONS
   3 concrete adjustments with hex value suggestions where possible. Each recommendation must reference a specific principle (colour harmony rule, psychological impact, or platform rendering consideration).`

    // ─────────────── SOCIAL MANAGER TOOLS ───────────────

    case 'posting_time_optimizer':
      return `You are a social media algorithm specialist with deep knowledge of platform-specific engagement data, audience behaviour science, and timezone optimisation.

PLATFORM:
${input}

Provide the 3 optimal posting time windows for this platform with clinical precision.

For each time window:

TIME SLOT [N]: [Day of week — Time range] (specify timezone: Gulf Standard Time GST/UAE)
Algorithm factor: [The specific platform behaviour driving this window — e.g. "Instagram's Explore feed boost is most active in the first 30 minutes of posting; 9am posts catch morning commute scroll behaviour"]
Audience factor: [The specific audience behaviour driving engagement at this time — reference circadian rhythm, device usage patterns, or lifestyle data]
Competition factor: [Is this slot high or low competition? What is the tradeoff?]
Expected engagement lift vs baseline: [Estimated % above average — be calibrated, not inflated]

PLATFORM-SPECIFIC CONTEXT:
After the 3 time slots, add one paragraph on what NEVER to post on this platform (worst performing times and why — not generic advice).

If the platform is LinkedIn: focus on B2B decision-maker behaviour (Tue–Thu, 8–10am only).
If the platform is TikTok: include For You Page (FYP) algorithm mechanics.
If the platform is Instagram: differentiate between Feed, Reels, and Stories posting optimal times.
If the platform is Facebook: address the reach decay for Pages and the paid boost factor.`

    case 'moderation_reply_generator':
      return `You are a senior community manager and brand communications specialist. Your task is to generate 2 distinct reply tones for an incoming social media comment. Apply the Service Recovery Paradox: a well-handled interaction generates more brand loyalty than a smooth experience (McCollough & Bharadwaj, 1992).

INCOMING COMMENT:
${input}

STEP 1 — SENTIMENT ANALYSIS (internal, not shown to user)
Classify: Positive / Question / Complaint / Criticism / Neutral
Identify the underlying emotion (frustrated, curious, enthusiastic, disappointed, confused)
Identify the single thing this person actually needs from a reply

STEP 2 — TWO REPLY VARIANTS

REPLY 1 — PROFESSIONAL TONE
Characteristics: Composed, authoritative, precise. Reads like a senior brand manager. Uses formal sentence structure. Validates without being submissive. Resolves directly. No exclamation marks for neutral/negative comments.

REPLY 2 — FRIENDLY TONE
Characteristics: Warm, human, peer-to-peer. Reads like a knowledgeable friend of the brand. Uses contractions. Slightly shorter. Conversational without being unprofessional. Ends with a forward-looking statement.

RULES FOR BOTH REPLIES:
- 1–3 sentences maximum — every word must earn its place
- No hashtags, no emojis
- Never use: "We're sorry to hear that", "We apologise for any inconvenience", "Please DM us" as the entire reply
- If a question is asked — answer it directly, do not deflect
- If negative — acknowledge specifically what the person said (linguistic mirroring), do not be defensive

FORMAT:
PROFESSIONAL REPLY:
[reply text]

FRIENDLY REPLY:
[reply text]

SENTIMENT NOTE: [1 line explaining what emotional state this person is in and what they needed]`

    case 'caption_hashtag_audit':
      return `You are a hashtag strategist and organic reach specialist. Your task is to audit a caption and its hashtag set for maximum discoverability.

CAPTION + HASHTAGS:
${input}

Conduct a rigorous hashtag audit using these criteria:

1. CAPTION-HASHTAG ALIGNMENT SCORE (0–100)
   How well do the hashtags match the actual content of the caption? Mismatched hashtags are penalised by the Instagram algorithm — it infers content from hashtag context. Flag any hashtag that a human could reasonably argue does not belong with this specific caption.

2. HASHTAG TIER ANALYSIS
   Categorise each hashtag into:
   - Mega (1M+ posts): reach play, low discovery probability
   - Macro (100K–1M): balanced reach/discovery
   - Micro (10K–100K): high engagement rate per impression
   - Niche (<10K): community-building, highest relevance

   Current tier distribution: [breakdown]
   Recommended tier distribution for this post type: [optimal mix]

3. KEEP / REMOVE / ADD
   KEEP: [list — with brief reason for each]
   REMOVE: [list — with specific reason: too generic / misaligned / over-saturated / banned]
   ADD: [3–5 suggested replacements with tier classification and reason]

4. PLACEMENT RECOMMENDATION
   First comment or end of caption? Platform-specific reasoning.

5. OVERALL VERDICT
   One paragraph: what is working, what is holding back reach, the single highest-impact change.`

    case 'crisis_checklist':
      return `You are a crisis communications specialist with experience managing brand crises on social media. Provide the complete step-by-step crisis response protocol.

Generate the NOVAX Agency Crisis Response Protocol for social media incidents. This is a practical operations checklist — not theory.

PHASE 1 — DETECTION & ASSESSMENT (0–30 minutes)
Numbered steps for the first 30 minutes after a crisis signal is detected. Include: who is alerted first, how severity is classified (use a 3-tier system: Tier 1 = isolated complaint, Tier 2 = spreading negative sentiment, Tier 3 = viral/media coverage), and what information must be gathered before any public response.

PHASE 2 — IMMEDIATE RESPONSE (30 minutes – 2 hours)
What is communicated and on which channels. Include: the holding statement template (fill-in-the-blank format), which platform to respond on first and why, who must approve the response before publishing, and what NOT to say (specific forbidden phrases).

PHASE 3 — CONTENT FREEZE PROTOCOL
Exact steps to pause all scheduled content. Which tools to access (Metricool scheduling pause), who owns this action, and how long the pause window should be for each crisis tier.

PHASE 4 — ESCALATION TRIGGERS
List specific conditions that require escalating from community manager to account manager to CEO. Include media mention thresholds, follower complaint volume thresholds, and legal content triggers.

PHASE 5 — RECOVERY ACTIONS (24–72 hours)
Steps to resume normal content, how to monitor sentiment recovery, and the single follow-up post structure to close the incident.

Format as a numbered checklist under each phase header. No vague guidance — every step must be a concrete action a community manager can execute without guessing.`

    // ─────────────── ACCOUNT MANAGER TOOLS ───────────────

    case 'client_health_summary':
      return `You are a senior account director conducting a weekly client health review. Your task is to produce a concise 3-bullet status brief for ${client}.

CLIENT CONTEXT:
${input}

Produce exactly 3 bullets structured as:

RISK: [The single most significant risk to this account in the next 7 days — be specific about what could go wrong and what the trigger event is. Not "client satisfaction risk" — something like "3 scheduled posts have not received client approval and the window closes Wednesday — risk of publishing delay or client escalation."]

WIN: [The most significant positive result or milestone from the last 7 days — something that can be referenced in a client conversation as proof of value. Specific metrics or deliverables, not generic progress statements.]

PRIORITY — NEXT 7 DAYS: [The single most important action the account team must take in the next 7 days, expressed as an outcome not a task. Not "send the report" — "Deliver the May performance report with engagement trend commentary before the Thursday client call to anchor the renewal conversation."]

After the 3 bullets: one-line account health verdict — Healthy / Needs Attention / At Risk — with a one-sentence explanation.`

    case 'approval_email_drafter':
      return `You are a professional account manager drafting a client-facing approval email. Your task is to write a polished, clear email requesting content approval.

INPUT DETAILS:
${input}

Write a complete approval request email with these components:

SUBJECT LINE: [Short, specific, action-oriented — e.g. "May Content Review — Action Required by [Date]"]

EMAIL BODY:

Opening paragraph: Acknowledge the work completed and the purpose of this email in 2 sentences. Professional but not stiff. Do not start with "I hope this email finds you well."

Content summary paragraph: What has been prepared for review — platform, content type, volume, scheduled period. Be specific.

Action required paragraph: Exactly what the client needs to do, using what tool, by what deadline. Include the approval link naturally in context.

Closing: Professional sign-off that reinforces the agency is managing everything — client's only job is to approve or flag.

TONE RULES:
- Professional services agency standard — not corporate template language
- One sentence per idea — no compound sentences with multiple clauses
- No emojis, no hashtags
- No filler phrases: "Please do not hesitate", "As per our conversation", "I wanted to reach out"

Output: The complete email only. No meta-commentary.`

    case 'report_narrative_generator':
      return `You are a senior data analyst and communications director. Your task is to transform raw KPI values into an executive-ready performance narrative.

KPI VALUES:
${input}

Write one executive-ready narrative paragraph (150–200 words) that:

1. Opens with the single most significant finding — the insight that changes how the reader thinks about the period's performance. Not the largest number — the most meaningful one.

2. Contextualises every metric within the paragraph — do not list them, weave them into a story. Readers should understand performance trend (up/down/flat), relative to what baseline, and why it matters.

3. Identifies the causal relationship between 2–3 metrics if one exists (e.g. "The 23% increase in saves drove the subsequent reach growth — saved posts trigger algorithmic redistribution on Instagram").

4. Closes with a one-sentence forward signal — what this performance data predicts or enables for the next period.

RULES:
- Calibrated language: do not celebrate mediocre results. If growth was modest, say it clearly. Executives trust analysis that acknowledges limitations.
- No hedge words: "approximately", "somewhat", "quite" — be precise
- No bullet points — this must be a single cohesive paragraph
- No emojis, no hashtags`

    case 'meeting_prep_brief':
      return `You are a strategic account director preparing for a client meeting. Produce a pre-meeting briefing document for a client meeting with ${client}.

CONTEXT:
${input}

Produce a structured meeting prep brief with these 4 sections:

TALKING POINTS — LEAD WITH THESE
3 specific points to open the conversation with. Each should be framed as a value demonstration or forward-looking opportunity — not a status report. The client should leave the first 5 minutes feeling the agency is proactively managing their growth.

PERFORMANCE CONTEXT
What the numbers say about this client's current trajectory. Include what is performing well (with a specific metric or observation if the input provides one), what is underperforming, and the honest assessment of why.

RISK FLAGS — KNOW BEFORE YOU WALK IN
Issues that may come up: delayed deliverables, pending approvals, unresolved comments, budget conversations. For each flag: the issue, the likely client reaction, and the prepared response.

CLOSING OBJECTIVES
The 2–3 specific outcomes this meeting must achieve. These are decisions that need to be made or approvals that need to be secured — not "relationship building."

FORMAT: Brief, scannable. Each section header in bold. Bullet points per section. Total length: 250–350 words. Readable in 2 minutes.`

    // ─────────────── STRATEGIST TOOLS ───────────────

    case 'content_calendar_generator':
      return `You are a content strategy scientist applying platform algorithm research, narrative sequencing theory, and audience behaviour science.

INPUT:
${input}

Build a detailed 4-week content plan. Structure it as follows:

WEEK 1 — AWARENESS (Days 1–7)
Theme: Curiosity + Problem Establishment
For each posting day in this week:
- Platform
- Post type (Reel / Carousel / Static / Story)
- Title / concept
- Optimal posting time
- Emotional lever

WEEK 2 — CONSIDERATION (Days 8–14)
Theme: Education + Behind-the-Scenes + Social Proof
Same format per posting day.

WEEK 3 — CONVERSION (Days 15–21)
Theme: Offers + Urgency + Testimonials
Same format per posting day.

WEEK 4 — COMMUNITY (Days 22–28+)
Theme: UGC Requests + Loyalty + Next Chapter Teaser
Same format per posting day.

CONTENT PILLAR RATIO (enforce this):
50% Value/Education — highest save rate
30% Brand Storytelling — highest share rate
20% Direct Promotion — highest conversion
Never place promotional content adjacent to each other.

VIRALITY SEQUENCING:
After every high-arousal post (Reel), schedule a carousel on the same topic within 48h.

PLATFORM TIMING (GST):
Instagram Feed: 9am, 6pm
Instagram Reels: 9am, 12pm, 7pm
TikTok: 7am, 7pm
LinkedIn: 8am–10am Tue–Thu only
Facebook: 9am, 1pm weekdays

No hashtags in the plan. No emojis. Be specific about post concepts — not generic categories.`

    case 'campaign_brief_drafter':
      return `You are a senior strategist writing a campaign brief that will be handed to a creative team. Every section must be precise enough for execution without further clarification.

INPUT:
${input}
Client: ${client}

Write a complete campaign brief with these sections:

CAMPAIGN TITLE: [A working title — evocative, not generic]

CAMPAIGN OBJECTIVE: [Single sentence. What specific, measurable outcome must this campaign achieve? Use a metric format: "Increase Instagram Story link clicks by 30% over 4 weeks" not "drive engagement."]

TARGET AUDIENCE: [Primary audience segment with 3 psychographic details, not just demographics. What is their relationship with this product category? What is their current belief we need to shift?]

KEY MESSAGE: [One sentence. The single idea the audience must take away. Not a list of messages — one core truth.]

CREATIVE TERRITORIES: [3 distinct creative directions the team can explore. Each territory is a 2-line description: the emotional space it occupies and the visual/tonal signature.]

MANDATORY BRAND ELEMENTS: [What must appear in every execution: logo placement, brand colours, copy rules, legal requirements.]

DELIVERABLES: [Specific list: format × quantity × platform × language]

SUCCESS METRICS: [Primary KPI and secondary KPIs with baseline and target values]

TIMELINE: [Key milestones with suggested dates relative to campaign start]

DO NOT: [The 3 most important things this campaign must never do — based on the client's brand, audience, or competitive position]`

    case 'trend_relevance_checker':
      return `You are a cultural intelligence analyst and social media strategist. Assess the relevance of a trending topic for a specific brand.

INPUT:
${input}

Conduct a rigorous trend relevance assessment:

1. TREND ANATOMY
   What is driving this trend? Is it: news event, cultural moment, algorithm push, platform feature, meme evolution, or seasonal pattern? Identifying the source determines longevity and brand fit.

2. AUDIENCE ALIGNMENT SCORE (0–100)
   How closely does this trend's audience overlap with the client's target audience? 80+ = strong overlap with high engagement potential. 50–79 = partial overlap, requires adaptation. Below 50 = misaligned — participation may attract the wrong audience or no audience.

3. BRAND FIT VERDICT: USE / AVOID / ADAPT
   USE: If the brand can participate authentically — explain what authentic participation looks like specifically
   AVOID: If participation would feel forced, tone-deaf, or damage brand positioning — be specific about the risk
   ADAPT: If the core insight of the trend is usable but the execution must change — describe exactly how to adapt it

4. WINDOW OF OPPORTUNITY
   Is this trend at: Early stage (get in now) / Peak (risky, high competition) / Declining (miss this one)? Estimated days remaining in relevance window.

5. EXECUTION CONCEPT (only if USE or ADAPT)
   One specific, ready-to-brief concept for how this brand enters the trend. Platform, format, angle, and first line of copy.`

    case 'quarter_okr_drafter':
      return `You are a strategy consultant applying the OKR (Objectives and Key Results) framework with expert precision. Draft quarterly OKRs for ${client}.

INPUT:
${input}

Draft exactly 3 OKRs following this strict structure:

OBJECTIVE [N]: [One sentence. An Objective must be: qualitative, inspirational, directional, and time-bound to this quarter. Not a metric — that belongs in Key Results. Example: "Establish ${client} as the go-to authority in [industry] for [audience] on Instagram."]

KEY RESULT [N].1: [Quantitative. Specific metric with baseline and target. Example: "Grow Instagram follower count from 12,400 to 18,000 by end of Q3." Must be binary achievable — either you hit the number or you don't.]

KEY RESULT [N].2: [Different metric type than KR1. If KR1 is a vanity metric, KR2 should be a quality metric.]

KEY RESULT [N].3: [A process or output KR — something the team fully controls, not dependent on algorithm. Example: "Publish 52 posts across Instagram and LinkedIn with a minimum brand compliance score of 80%."]

CONFIDENCE SCORE: [For each OKR: 0–10. 7 is the target — 10 means not ambitious enough, 3 means unrealistic.]

After all 3 OKRs: one paragraph on the single biggest risk to achieving these OKRs and the mitigation strategy.

No emojis, no hashtags. Be precise — vague OKRs are worse than no OKRs.`

    // ─────────────── CREATIVE DIRECTOR TOOLS ───────────────

    case 'creative_brief_scorer':
      return `You are a creative director with 15 years of experience evaluating and writing briefs at leading creative agencies. Score the quality of this creative brief and provide specific, actionable improvements.

BRIEF TO EVALUATE:
${input}

SCORING FRAMEWORK

Score each criterion 0–100 and provide a one-line justification:

1. SPECIFICITY (weight: 25%)
   Is the deliverable crystal clear — format, quantity, platform, language, dimensions? Can a designer or copywriter begin work without asking a single clarifying question?

2. INSIGHT QUALITY (weight: 20%)
   Is there a genuine audience or market insight driving the creative direction? Or is it a product feature list dressed as a brief? The strongest briefs open with a human truth, not a product truth.

3. SINGLE-MINDEDNESS (weight: 20%)
   Can you extract one core message from this brief? Briefs with multiple competing messages produce diluted creative. Score lower if the brief contains more than one key message.

4. AMBITION (weight: 15%)
   Does this brief push for something genuinely new, or is it asking for more of the same? High-scoring briefs identify a creative territory the client has not occupied before.

5. EXECUTABILITY (weight: 20%)
   Are the constraints reasonable? Is the timeline achievable? Are brand guidelines clearly referenced? Can this be briefed to a junior creative team without translation?

OVERALL SCORE: [Weighted composite]

TOP 3 IMPROVEMENT POINTS:
For each: quote the specific section that needs improvement → provide a rewritten version → explain what changes and why it matters for creative output quality.`

    case 'copy_quality_gate':
      return `You are a head of copy and brand language guardian conducting a final quality check before copy goes live. This copy must pass all 4 gates before publication.

COPY TO REVIEW:
${input}

GATE 1 — BRAND VOICE CHECK
Does this copy sound like the brand or like a template? Score 0–100. Identify any phrase that breaks brand voice with the exact phrase quoted and a replacement.

GATE 2 — GRAMMAR & STYLE CHECK
Apply professional copy standards:
- Identify any grammatical errors with correction
- Flag passive voice where active would be stronger
- Flag sentences over 25 words (long sentences kill social media copy)
- Flag any filler words or phrases ("very", "really", "in order to", "we would like to")
- Flag unnecessary adjectives that don't add meaning

GATE 3 — PLATFORM COMPLIANCE
Assess for the most likely platform(s) this copy is headed to:
- First line under 125 characters (Instagram "see more" cutoff)?
- Text overlay rules (Facebook penalises >20% text in images)?
- Hashtag count appropriate (3–5 for Instagram, 1–2 for LinkedIn)?
- CTA specificity — does it tell the reader exactly one thing to do?

GATE 4 — CLARITY & CONVERSION CHECK
- Can the core message be extracted in one read?
- Is there exactly one CTA — or multiple competing ones?
- Is the value proposition stated explicitly or assumed?
- Would a member of the target audience (not a marketer) immediately understand what this is for?

FINAL VERDICT: PASS / CONDITIONAL PASS / FAIL
Conditional pass requires: [list specific changes before it can go live]`

    case 'campaign_concept_generator':
      return `You are a creative concepting director. Your task is to generate 3 distinct campaign concepts that each approach the brief from a fundamentally different creative territory.

INPUT:
${input}
Client: ${client}

Generate exactly 3 campaign concepts. Each concept must occupy a completely different emotional territory — not just a tonal variation.

CONCEPT [N]: [Concept Name — evocative, 2–4 words]

EMOTIONAL TERRITORY: [The single emotion or emotional state this concept lives in — be specific: "productive anxiety that gets resolved" not just "motivation"]

CORE INSIGHT: [The human or cultural truth that makes this concept true and relevant. This is the "so what" that makes it land — not a product benefit, a human truth.]

CREATIVE PLATFORM: [One sentence: the idea in its most compressed, memorable form. This is what gets handed to the team. Example: "Every expert was once the person in the room who didn't know."]

HOOK OPTIONS: [3 specific opening lines or visual concepts that execute the platform]

FORMAT INSTINCTS: [The 2 formats best suited to bring this concept to life and why — specific to platform and format type]

RISK: [What could go wrong with this concept — audience misread, competitive clash, brand fit issue. Be honest.]

DIFFERENTIATION: After all 3 concepts, one paragraph on why Concept X is the strongest for this client and brief. Reference the specific input to justify the recommendation.`

    case 'visual_direction_generator':
      return `You are a creative director and visual brand strategist. Generate a complete visual direction guide for ${client}.

CONTEXT:
${input}

Produce a visual direction document with these 5 sections:

1. MOOD DIRECTION
   Describe the visual world this brand should inhabit. Not colour lists — a scene. "Think: early morning light in a minimal apartment, objects deliberately placed, the texture of quality without ostentation." Make it specific enough that two designers would make similar choices from it.

2. PHOTOGRAPHY & IMAGERY REFERENCES
   5 specific visual reference descriptions (no URLs — describe the image in detail):
   Subject matter, lighting quality, colour temperature, composition style, depth of field, mood, and what emotion it should trigger in the target audience. Each reference must be distinctly different from the others.

3. COLOUR APPLICATION RULES
   How should the brand colours be applied specifically to social media content:
   - Which colour dominates in 80% of posts (and in what ratio)
   - Which colour is the accent / attention trigger
   - Which colour combination to never use together (visual conflict)
   - Dark mode vs light mode variation guidance

4. TYPOGRAPHY DIRECTION
   Not just typeface — the personality, weight, and usage:
   - Heading style: weight, capitalisation, letter-spacing, alignment
   - Body/caption style: readability rules for feed vs Reels vs Stories
   - One thing to never do typographically for this brand

5. DO NOT LIST
   The 5 most common visual mistakes for this type of brand that dilute positioning:
   Each as: [Common mistake] → [Why it damages this brand specifically]`

    // ─────────────── DEFAULT / ADMIN / CEO ───────────────

    default:
      return `You are an expert assistant at NOVAX, a social media and creative agency. Provide a precise, professional response to the following request. No emojis, no hashtags unless explicitly part of the task.

INPUT:
${input}

Respond with specific, actionable output. No generic advice. Be direct and expert-level in your response.`
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured.' }, { status: 500 })
  }

  let body: RoleToolRequest
  try {
    body = await req.json() as RoleToolRequest
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { tool, input, client_name } = body

  if (!tool || !input?.trim()) {
    return NextResponse.json({ error: 'tool and input are required.' }, { status: 400 })
  }

  const prompt = buildPrompt(tool, input.trim(), client_name)

  try {
    const result = await callGemini(prompt)
    return NextResponse.json({ result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI generation failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
