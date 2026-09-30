// ============================================================
// POST /api/studio/strategy
// Two-pass quarterly strategy generator.
//   Pass 1 â€” Deep generation  (Claude Opus â€” full strategy)
//   Pass 2 â€” Reflection agent (Claude Sonnet â€” red-teams every
//             section, sharpens anything generic, adds
//             audience_insight + executive_summary)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildClientIntelligenceBlock, adminSupabase, getClientContextVersion } from '@/lib/client-intelligence'
import type { StrategyDocument } from '@/lib/studio-types'
import { aiGuard } from '@/lib/ai-guard'
import { trackAiUsage } from '@/lib/track-usage'
import { getOrGenerate } from '@/lib/ai-cache'
import { createAdminClient } from '@/lib/supabase'

export const maxDuration = 300

interface StrategyRequest {
  client_id?: string
  user_id?: string
  client_name: string
  industry?: string
  brand_voice?: string
  key_messages?: string[]
  competitors?: string[]
  platforms?: string[]
  brief: string
  quarter: string
  year: number
  campaign_theme?: string
  cultural_moments?: string
  brand_persona?: string
  tenant_notes?: string
  signal_report?: unknown
}

function quarterMonths(quarter: string, year: number): string[] {
  const map: Record<string, string[]> = {
    Q1: ['January', 'February', 'March'],
    Q2: ['April', 'May', 'June'],
    Q3: ['July', 'August', 'September'],
    Q4: ['October', 'November', 'December'],
  }
  return (map[quarter] ?? ['Month 1', 'Month 2', 'Month 3']).map(m => `${m} ${year}`)
}

// â”€â”€â”€ Pass 1: Deep strategy generation prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildGenerationPrompt(d: StrategyRequest): string {
  const months = quarterMonths(d.quarter, d.year)

  return `You are a senior social media strategist at a world-class creative agency. Your quarterly strategies are referenced internally as benchmarks. You have produced work for leading brands across the Middle East and internationally. The work you produce does not just fill a presentation â€” it changes how a brand shows up in culture.

What separates your strategies from every other strategist's output:
- Every tactic is pinned to a specific cultural moment, not a generic theme
- Platform roles are differentiated by human behavior, not by channel name
- Monthly personas describe the brand's emotional state, not a content calendar
- The arc has momentum: Month 1 sets up something that Month 3 delivers on
- The competitive gap is named, not gestured at
- No filler. No "etc." Every sentence earns its place.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
STRATEGIC THINKING PHASE â€” Complete this analysis before generating the strategy document.
These are INTERNAL REASONING STEPS â€” do NOT include them in the JSON output.
Your thinking here will be invisible in the output but visible in the quality of every line.
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

STEP 1 â€” STRATEGIC SITUATION ANALYSIS
Client: ${d.client_name} | Industry: ${d.industry ?? 'not specified'} | Quarter: ${d.quarter} ${d.year}
Brief: ${d.brief}

Answer internally:
â€¢ What is the single most important cultural or market shift happening in ${months[0].split(' ')[0]}â€“${months[2].split(' ')[0]} ${d.year} that this brand cannot ignore?
â€¢ What is the gap between where this brand's audience is emotionally right now, and where they want to be?
â€¢ What is the one thing this brand could say this quarter that no competitor would dare say?
â€¢ What does the brand's audience fear most this quarter? What do they secretly desire?
â€¢ What does the audience tell themselves they want vs. what they actually need?

STEP 2 â€” COMPETITIVE DIFFERENTIATION FORCING
Competitors: ${d.competitors?.join(', ') ?? 'not specified'}

Answer internally:
â€¢ What content format or theme is oversaturated in this industry right now? The strategy must actively avoid it.
â€¢ What emotional territory is UNCLAIMED in this space?
â€¢ If a viewer sees this brand's content alongside a competitor's, what is the single visual or tonal difference that makes them immediately distinguishable?
â€¢ What would a competitor see in this strategy and think "we can't do that because we don't have the credibility to pull it off"?
â€¢ Name the emotional territory that is so underserved by competitors that any brand claiming it would feel like a relief.

STEP 3 â€” QUARTERLY NARRATIVE ARC
Months: ${months.join(' â†’ ')}

Answer internally:
â€¢ What is the NORTH STAR of this quarter? One sentence: what does the brand stand for by the end of ${months[2].split(' ')[0]}?
â€¢ What does the brand need to ESTABLISH in Month 1 for Month 3 to land?
â€¢ What is the escalation from Month 1 to Month 3? What shifts in the audience relationship?
â€¢ What is the MOMENT in Month 3 that the entire quarter was building toward?
â€¢ What would a viewer who follows this brand for all 3 months feel by the end?
â€¢ What is at STAKE in this strategy? What does the brand risk if Month 1 fails?

STEP 4 â€” PLATFORM BEHAVIOR MAPPING
Platforms: ${d.platforms?.join(', ') ?? 'Instagram, TikTok'}

Answer internally:
â€¢ For each platform: what is the ONE type of content that ONLY makes sense on this platform, and nowhere else?
â€¢ What is the behavioral difference between how the audience uses each platform?
â€¢ What emotional state is the audience in when they open each platform?
â€¢ What content format creates saves? What format creates shares? These need different treatments.

STEP 5 â€” CULTURAL CALENDAR ANCHORING
Months: ${months.join(', ')}

Answer internally:
â€¢ Name 3 specific cultural, seasonal, or audience mindset shifts in ${months[0].split(' ')[0]}â€“${months[2].split(' ')[0]} in this brand's primary region/market.
â€¢ For each month, name the single most important thing happening in the audience's LIFE that shapes their emotional state.
â€¢ Are there religious, national, or seasonal moments this brand should engage with specifically? Name the exact moment and angle.
â€¢ What are people searching for, buying, or worrying about in each of these three months?

STEP 6 â€” AUDIENCE INSIGHT EXCAVATION
Answer internally:
â€¢ What does the audience publicly say they want from this brand? What do they privately need?
â€¢ What is the audience's most honest feeling about the category this brand is in?
â€¢ What belief does the audience hold about themselves that this brand could either validate or gently challenge?
â€¢ What has the audience stopped believing in that this brand could make them believe in again?

STEP 7 â€” QUALITY GATEKEEPING (anti-patterns to eliminate)
Before writing, verify your strategy avoids:
â€¢ Generic pillar names: "Lifestyle", "Education", "Behind the Scenes" â€” these are categories, not territories
â€¢ Generic monthly themes: "Summer vibes", "New year energy" â€” these describe a feeling, not a strategy
â€¢ Platform roles that are just awareness/engagement labels â€” name the BEHAVIOR
â€¢ Monthly tactics without a specific cultural anchor
â€¢ A strategy arc where Month 2 is just "more of Month 1"
â€¢ The word "empower", "inspire", "connect", "enable" in the positioning statement
â€¢ Content pillars that would work for any brand in this industry

STEP 8 â€” VIRAL CONTENT ARCHITECTURE
Before writing, answer internally:
â€¢ CURIOSITY: What is the one thing this brand can REVEAL this quarter that the audience has been waiting to hear but no brand has said? The entire strategy should build toward this revelation. What is Month 3's "prize" for the audience who followed since Month 1?
â€¢ CONTROVERSY: Which content pillar will generate the most productive disagreement in comments? Every great strategy needs at least ONE pillar that says something the audience will actively debate â€” not controversy for shock, but a genuine perspective that divides smart people.
â€¢ DISCUSSION: For each platform role, what specific format makes the audience want to share THEIR OWN VERSION or story? "I do this too" comments. "Send this to someone who..." moments. The content that makes people tag others.
â€¢ REPEATABLE FORMATS: For each monthly tactic, what is the ONE FORMAT that could run weekly for the entire quarter? Not individual post ideas â€” a structural template that becomes the brand's signature. Job Ladder principle: same structure, different subjects, every week, until the audience recognizes the format as the brand.
â€¢ NARRATIVE ARC AS CURIOSITY ENGINE: Month 1 should open a question or tension. Month 2 should deepen it without resolving. Month 3 should deliver the payoff â€” the revelation or transformation the audience has been building toward. The audience should feel the strategy is building toward something real.

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
END OF THINKING PHASE â€” Now produce the strategy document.
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

â”€â”€â”€ CLIENT BRIEF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Client: ${d.client_name}
Industry: ${d.industry ?? 'not specified'}
Quarter: ${d.quarter} ${d.year} â€” Months: ${months.join(', ')}
Platforms: ${d.platforms?.join(', ') ?? 'Instagram, TikTok'}
Brand Voice: ${d.brand_voice ?? 'not specified'}
${d.key_messages?.length ? `Key Messages: ${d.key_messages.join(' | ')}` : ''}
${d.competitors?.length ? `Competitors: ${d.competitors.join(', ')}` : ''}

Strategic Brief: ${d.brief}
${d.campaign_theme ? `Campaign Theme / Line: "${d.campaign_theme}"` : ''}
${d.cultural_moments ? `Key Cultural Moments this quarter: ${d.cultural_moments}` : ''}
${d.brand_persona ? `Brand Persona direction: ${d.brand_persona}` : ''}
${d.tenant_notes ? `Partner / Tenant Integration Notes: ${d.tenant_notes}` : ''}

â”€â”€â”€ QUALITY STANDARDS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
POSITIONING STATEMENT: Names the specific role the brand plays in the audience's life THIS quarter. Not a generic brand promise. Names the exact relationship: what the brand IS for its audience in ${months[0].split(' ')[0]}â€“${months[2].split(' ')[0]} ${d.year}.
Weak: "A brand that empowers women." Strong: "The brand that says out loud what ${months[0].split(' ')[0]} actually feels like for its audience."

CAMPAIGN LINE: 3â€“7 words. Poetic compression. Could anchor a full quarter of content. Owned-sounding â€” no other brand in ${d.industry ?? 'this category'} could use it. If a campaign theme is provided, use it exactly.

CONTENT PILLARS: Each pillar names a specific life territory or cultural tension â€” not a topic category. 5 pillars, each mutually exclusive. Each must pass the test: "Would a competitor see this and think 'we should have claimed this'?"
Weak: "Lifestyle", "Inspiration", "Tips." Strong: "The moments between milestones â€” the Tuesday morning no one posts about."
VIRAL PILLAR REQUIREMENT: At least one pillar must be deliberately controversy-generating â€” a consistent brand perspective that the audience actively debates. The controversy must be about ideas or values, not about the brand. Include in the pillar description: the specific controversial angle and the two sides it generates.

PLATFORM ROLES: Each platform gets a different behavioral role â€” what content ONLY exists on that platform, and why. Named as a specific behavior: "Where the brand gets uncomfortable" / "Where the brand earns trust" â€” not "awareness" / "engagement."
DISCUSSION FORMAT REQUIREMENT: Each platform role must name ONE repeatable format â€” a structural template that runs weekly. "The format is the brand." Example: not "Reels about behind-the-scenes" but "Weekly Reel: One industry rule we broke â€” and what happened." The format must naturally generate comment participation (a question people want to answer about themselves).

MONTHLY TACTICS: Each month must be anchored to a specific cultural/emotional shift. Format: [Role Name] Ã— [Specific Cultural or Emotional Trigger] â€” not a generic theme, a named tension.
CURIOSITY ARC REQUIREMENT: Month 1 opens a question or tension (something the audience has been privately thinking but no brand has said). Month 2 deepens it (goes further, adds proof, challenges the audience more). Month 3 delivers the payoff (the revelation, transformation, or resolution that makes the first two months make sense retrospectively).

STRATEGY ARC: 3-phase arc with narrative momentum. Month 1 plants the seed. Month 2 deepens the investment. Month 3 delivers the payoff. Something is at stake. The audience should feel the brand building toward something real.

AUDIENCE INSIGHT: The single sentence that makes the entire strategy click. The thing the audience has never heard a brand say but immediately recognizes as true.

â”€â”€â”€ OUTPUT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Return ONLY valid JSON â€” no markdown, no commentary:
{
  "positioning_statement": "One specific sentence: what role the brand plays in its audience's life in ${months[0].split(' ')[0]}â€“${months[2].split(' ')[0]} ${d.year}. Must be specific to this brand, this quarter, this moment.",

  "campaign_line": "${d.campaign_theme ? d.campaign_theme : `3â€“7 word campaign line that only ${d.client_name} could own this quarter`}",

  "quarter_role": "2â€“3 sentences: the strategic narrative of this quarter â€” what it builds from, what it builds toward, why this specific moment in the calendar matters for this brand",

  "identity_shift": "One sentence: the single most important shift in how the brand shows up this quarter vs. the previous quarter â€” behavioral and specific, not tonal",

  "north_star": "One sentence: what the brand stands for by the end of ${months[2]} â€” the audience's relationship with the brand after following it for the full quarter",

  "audience_insight": "One sentence: the single most honest insight about what this audience secretly wants or fears this quarter â€” the insight that makes the whole strategy click. Something competitors have missed.",

  "competitive_gap": "One sentence: the specific emotional or creative territory that competitors are NOT occupying that this strategy claims",

  "creative_tension": "One sentence: the specific uncomfortable or bold creative choice in this strategy â€” the thing a generic competitor would not do",

  "executive_summary": "3 sentences: (1) What the strategy claims this quarter â€” the specific positioning move. (2) Why ${months[0].split(' ')[0]}â€“${months[2].split(' ')[0]} ${d.year} is the right moment to claim it â€” the cultural or market reason. (3) What a viewer who follows for all 3 months will feel by the end â€” the emotional transformation.",

  "obstacle": "One sentence: the main obstacle or audience barrier this strategy must overcome to succeed",

  "content_pillars": [
    { "name": "Pillar Name â€” 2â€“3 words, specific and ownable", "description": "One sentence: the specific life territory or cultural tension this pillar covers. What makes it specific to ${d.client_name}." },
    { "name": "...", "description": "..." },
    { "name": "...", "description": "..." },
    { "name": "...", "description": "..." },
    { "name": "...", "description": "..." }
  ],

  "strategy_arc": [
    { "number": "01", "phase_name": "2-word name", "month": "${months[0]}", "description": "One sentence: what this phase establishes â€” specifically what changes in the audience's perception of the brand" },
    { "number": "02", "phase_name": "2-word name", "month": "${months[1]}", "description": "One sentence: the escalation â€” what deepens, what shifts, what gets harder or more specific" },
    { "number": "03", "phase_name": "2-word name", "month": "${months[2]}", "description": "One sentence: the payoff â€” what the entire quarter was building toward, what the audience now believes or does" }
  ],

  "platform_roles": [
    {
      "platform": "Platform name",
      "role": "One specific tagline: the behavioral role this platform plays â€” not 'awareness', a named behavior",
      "description": "2â€“3 sentences: what content type lives ONLY here, the visual and tonal style, why this platform gets this role",
      "content_that_only_lives_here": "One specific content format or series that is platform-native and cannot work on any other platform"
    }
  ],

  "monthly_tactics": [
    {
      "month": "${months[0]}",
      "role": "2-word role name â€” specific to this month's cultural moment",
      "theme_line": "[Role Name] Ã— [Specific Cultural or Emotional Trigger for ${months[0].split(' ')[0]}]",
      "description": "2â€“3 sentences: the specific cultural moment or audience mindset shift in ${months[0].split(' ')[0]}, what the brand does in response, why this approach",
      "cultural_anchor": "The specific event, seasonal shift, or audience life moment that anchors this month â€” a real date or named moment",
      "brand_persona_adjectives": ["Specific adjective for this month only", "Specific adjective", "Specific adjective", "Specific adjective"],
      "brand_persona_description": "One sentence: the brand's emotional posture in ${months[0].split(' ')[0]} â€” a state of being, not a tone list",
      "focus": ["Specific content beat 1 â€” named format + specific topic", "Specific content beat 2", "Specific content beat 3", "Specific content beat 4"],
      "outcome": ["Specific behavioral or relational outcome 1 â€” what the audience does or believes after this month", "Outcome 2", "Outcome 3"]
    },
    {
      "month": "${months[1]}",
      "role": "...", "theme_line": "...", "description": "...", "cultural_anchor": "...",
      "brand_persona_adjectives": ["...", "...", "...", "..."], "brand_persona_description": "...",
      "focus": ["...", "...", "...", "..."], "outcome": ["...", "...", "..."]
    },
    {
      "month": "${months[2]}",
      "role": "...", "theme_line": "...", "description": "...", "cultural_anchor": "...",
      "brand_persona_adjectives": ["...", "...", "...", "..."], "brand_persona_description": "...",
      "focus": ["...", "...", "...", "..."], "outcome": ["...", "...", "..."]
    }
  ],

  "format_roles": {
    "reels": ["Specific use 1 â€” named series or format, not generic", "Specific use 2", "Specific use 3"],
    "motion_graphics": ["Specific use 1", "Specific use 2", "Specific use 3"],
    "static_carousel": ["Specific use 1", "Specific use 2", "Specific use 3"]
  },

  "tenant_integration": [
    "Integration principle 1 â€” how partners appear without feeling like ads: a specific approach",
    "Principle 2",
    "Principle 3"
  ],

  "strategy_flow": [
    { "beat": "1", "label": "${months[0].split(' ')[0]}", "phase": "Phase name from arc", "description": "One sentence: the specific thing that happens at this moment in the arc" },
    { "beat": "2", "label": "Mid-${months[1].split(' ')[0]}", "phase": "Phase name", "description": "..." },
    { "beat": "3", "label": "Late ${months[1].split(' ')[0]}", "phase": "Phase name", "description": "..." },
    { "beat": "4", "label": "${months[2].split(' ')[0]}", "phase": "Phase name", "description": "..." },
    { "beat": "5", "label": "Quarter peak", "phase": "Culmination", "description": "The specific moment the entire quarter was building toward â€” name it" }
  ]
}

ABSOLUTE RULES:
- Every item must be specific to ${d.client_name}, ${d.industry ?? 'this industry'}, ${d.quarter} ${d.year}
- Monthly tactics must reference real cultural/seasonal dynamics in the exact months named
- No placeholder text. No "etc." No ellipsis in any field. Complete every sentence.
- Content pillars must be mutually exclusive â€” if two pillars could produce the same post, rewrite one
- Platform roles must be behaviorally differentiated â€” if two platforms could swap descriptions, rewrite both
- Return ONLY valid JSON â€” no markdown wrapper, no commentary, no apology`
}

// â”€â”€â”€ Pass 2: Reflection + deepening prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildReflectionPrompt(initial: StrategyDocument, d: StrategyRequest): string {
  const months = quarterMonths(d.quarter, d.year)

  return `You are the Creative Director at a world-class social media agency. A senior strategist has submitted this quarterly strategy for final approval. Your job: red-team every section ruthlessly, then return an improved strategy.

THE BRIEF:
Client: ${d.client_name}
Industry: ${d.industry ?? 'not specified'}
Quarter: ${d.quarter} ${d.year} â€” Months: ${months.join(', ')}
Brief: ${d.brief}

THE SUBMITTED STRATEGY:
${JSON.stringify(initial, null, 2)}

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WHAT SEPARATES AN EXCELLENT STRATEGY FROM AN AVERAGE ONE
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

POSITIONING: Excellent names the EXACT relationship between brand and audience this quarter.
  Generic (reject): "The brand that empowers its community" â€” any brand could say this.
  Excellent (keep): Names the specific role this brand plays in the audience's life in these exact months.

AUDIENCE INSIGHT: Must be the sentence the audience has never heard a brand say but immediately recognizes as true. Not a market observation â€” a felt truth.
  Generic (reject): "Audiences want authentic content" â€” this is always true.
  Excellent (keep): Names the specific unspoken desire or fear that is uniquely strong in these three months for this audience.

CONTENT PILLARS: Must be cultural territories, not topic categories.
  Generic (reject): "Education", "Lifestyle", "Inspiration", "Community", "Behind the Scenes"
  Excellent (keep): Pillars that name a specific life moment, tension, or question that ONLY ${d.client_name}'s audience would recognize.

MONTHLY TACTICS: Each month's theme_line must contain a SPECIFIC tension happening in that exact month.
  Generic (reject): "New energy", "Building momentum", "Community focus"
  Excellent (keep): "[Named role] Ã— [Specific cultural/emotional trigger for that exact month in this region]"

PLATFORM ROLES: Must describe a BEHAVIORAL STATE, not a channel function.
  Generic (reject): "Instagram: awareness platform | TikTok: engagement hub"
  Excellent (keep): Describes what the audience is DOING emotionally when they encounter this brand on each platform.

STRATEGY ARC: Must have something at stake. Month 2 must NOT be "more of Month 1."
  Generic (reject): Month 1: Establish â†’ Month 2: Grow â†’ Month 3: Convert
  Excellent (keep): A named emotional transformation â€” what the audience believes or feels differently at the end of each month.

EXECUTIVE SUMMARY: Must read like a creative brief, not a slide deck intro.
  Generic (reject): A paragraph summarizing the sections.
  Excellent (keep): 3 sentences that make a reader think "yes, that's exactly the right move right now."

â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
YOUR TASK
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
For each section above:
1. Ask: "Could a generic competitor brand in this industry use this exact text without changing a word?"
2. If yes â†’ rewrite it to be specific, owned, and impossible to swap out.
3. If no â†’ keep it exactly as submitted.

Then: Ensure the executive_summary and audience_insight are sharp enough to anchor the whole document. Rewrite them if they are not.

Return the COMPLETE improved strategy as valid JSON. Every field must be present. No "..." placeholders.

CRITICAL: Return ONLY valid JSON â€” no markdown, no commentary, no preamble:
{
  "positioning_statement": "...",
  "campaign_line": "${d.campaign_theme ? d.campaign_theme : '...'}",
  "quarter_role": "...",
  "identity_shift": "...",
  "north_star": "...",
  "audience_insight": "The sentence that makes the whole strategy click â€” what the audience secretly wants/fears in ${months[0].split(' ')[0]}â€“${months[2].split(' ')[0]} that competitors have missed",
  "competitive_gap": "...",
  "creative_tension": "...",
  "executive_summary": "Sentence 1: What the strategy claims for ${d.client_name} this quarter â€” the specific positioning move. Sentence 2: Why ${months[0].split(' ')[0]}â€“${months[2].split(' ')[0]} ${d.year} is the right moment â€” the cultural or market reason. Sentence 3: What a viewer who follows for all 3 months will feel by the end.",
  "obstacle": "...",
  "content_pillars": [
    { "name": "...", "description": "..." },
    { "name": "...", "description": "..." },
    { "name": "...", "description": "..." },
    { "name": "...", "description": "..." },
    { "name": "...", "description": "..." }
  ],
  "strategy_arc": [
    { "number": "01", "phase_name": "...", "month": "${months[0]}", "description": "..." },
    { "number": "02", "phase_name": "...", "month": "${months[1]}", "description": "..." },
    { "number": "03", "phase_name": "...", "month": "${months[2]}", "description": "..." }
  ],
  "platform_roles": [ ... ],
  "monthly_tactics": [ ... ],
  "format_roles": { "reels": [...], "motion_graphics": [...], "static_carousel": [...] },
  "tenant_integration": [...],
  "strategy_flow": [...]
}`
}

// â”€â”€â”€ JSON helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function extractJSON(raw: string): string | null {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const match = stripped.match(/\{[\s\S]*\}/)
  return match ? match[0] : null
}

function mergeStrategy(base: StrategyDocument, reflection: StrategyDocument): StrategyDocument {
  // Use reflection output as the primary â€” it has gone through quality checks.
  // Fall back to base for any field the reflection left null/undefined/empty.
  const merged: StrategyDocument = { ...base }
  const keys = Object.keys(reflection) as (keyof StrategyDocument)[]
  for (const key of keys) {
    const val = reflection[key]
    if (val === null || val === undefined) continue
    if (typeof val === 'string' && val.trim() === '') continue
    if (Array.isArray(val) && val.length === 0) continue
    // @ts-expect-error dynamic key assignment
    merged[key] = val
  }
  return merged
}

// â”€â”€â”€ Gemini fallback (single pass only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function runGemini(prompt: string, geminiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 32000, temperature: 0.80 },
      }),
    },
  )
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Gemini error: ${err}`)
  }
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// â”€â”€â”€ Route handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function POST(req: NextRequest) {
  const guard = await aiGuard(req)
  if (guard) return guard

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const geminiKey    = process.env.GEMINI_API_KEY
  if (!anthropicKey && !geminiKey) {
    return NextResponse.json({ error: 'No AI API key configured' }, { status: 500 })
  }

  let body: StrategyRequest
  try {
    body = await req.json() as StrategyRequest
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.client_name || !body.brief || !body.quarter) {
    return NextResponse.json({ error: 'client_name, brief, and quarter are required' }, { status: 400 })
  }

  // Cache setup
  const cacheDb = createAdminClient()
  const contextVersion = body.client_id
    ? await getClientContextVersion(body.client_id, cacheDb).catch(() => '0')
    : '0'

  let cacheResult: { result: StrategyDocument; fromCache: boolean }
  try {
    cacheResult = await getOrGenerate<StrategyDocument>(
      cacheDb,
      {
        entityType: 'client',
        entityId:   body.client_id ?? body.client_name,
        agentType:  'strategy',
        inputs: {
          brief:            body.brief,
          quarter:          body.quarter,
          year:             body.year,
          client_name:      body.client_name,
          industry:         body.industry         ?? null,
          platforms:        body.platforms        ?? null,
          campaign_theme:   body.campaign_theme   ?? null,
          cultural_moments: body.cultural_moments ?? null,
          brand_persona:    body.brand_persona    ?? null,
          key_messages:     body.key_messages     ?? null,
          competitors:      body.competitors      ?? null,
          contextVersion,
        },
      },
      async () => {
        let generationPrompt = buildGenerationPrompt(body)

        // Inject client intelligence memory
        if (body.client_id) {
          const db = adminSupabase()
          if (db) {
            const block = await buildClientIntelligenceBlock(body.client_id, 'strategy', db).catch(() => '')
            if (block) generationPrompt = block + '\n\n' + generationPrompt
          }
        }

        // Gemini-only path (no Anthropic key)
        if (!anthropicKey && geminiKey) {
          const raw = await runGemini(generationPrompt, geminiKey)
          const jsonStr = extractJSON(raw)
          if (!jsonStr) throw new Error('Failed to parse strategy from AI')
          const result = JSON.parse(jsonStr) as StrategyDocument
          result.client_name    = body.client_name
          result.platforms      = body.platforms
          result.brief          = body.brief
          result.quarter        = body.quarter
          result.year           = body.year
          result.campaign_theme = body.campaign_theme
          return { result, model: 'gemini-3-flash-preview' }
        }

        // Two-pass Claude path
        const anthropic = new Anthropic({ apiKey: anthropicKey! })

        // Pass 1: Deep strategy generation (Opus)
        let pass1Doc: StrategyDocument
        let pass1Raw = ''

        const msg1 = await anthropic.messages.create({
          model:      'claude-opus-4-7',
          max_tokens: 10000,
          messages:   [{ role: 'user', content: generationPrompt }],
        })
        pass1Raw = msg1.content[0].type === 'text' ? msg1.content[0].text : ''
        void trackAiUsage({ service: 'claude', endpoint: 'studio/strategy/pass1', user_id: body.user_id, tokens_in: msg1.usage.input_tokens, tokens_out: msg1.usage.output_tokens, model: 'claude-opus-4-7' })

        const pass1JSON = extractJSON(pass1Raw)
        if (!pass1JSON) throw new Error('Failed to parse strategy from AI (pass 1)')
        pass1Doc = JSON.parse(pass1JSON) as StrategyDocument

        // Pass 2: Reflection agent (Sonnet)
        let finalDoc: StrategyDocument = pass1Doc
        try {
          const reflectionPrompt = buildReflectionPrompt(pass1Doc, body)
          const msg2 = await anthropic.messages.create({
            model:      'claude-sonnet-4-6',
            max_tokens: 10000,
            messages:   [{ role: 'user', content: reflectionPrompt }],
          })
          const pass2Raw = msg2.content[0].type === 'text' ? msg2.content[0].text : ''
          void trackAiUsage({ service: 'claude', endpoint: 'studio/strategy/pass2', user_id: body.user_id, tokens_in: msg2.usage.input_tokens, tokens_out: msg2.usage.output_tokens, model: 'claude-sonnet-4-6' })
          const pass2JSON = extractJSON(pass2Raw)
          if (pass2JSON) {
            const pass2Doc = JSON.parse(pass2JSON) as StrategyDocument
            finalDoc = mergeStrategy(pass1Doc, pass2Doc)
          }
        } catch {
          // Reflection failed - use pass 1 output (still a full strategy)
          finalDoc = pass1Doc
        }

        // Attach metadata
        finalDoc.client_name    = body.client_name
        finalDoc.platforms      = body.platforms
        finalDoc.brief          = body.brief
        finalDoc.quarter        = body.quarter
        finalDoc.year           = body.year
        finalDoc.campaign_theme = body.campaign_theme

        return {
          result:     finalDoc,
          model:      'claude-opus-4-7',
          tokensUsed: msg1.usage.input_tokens + msg1.usage.output_tokens,
        }
      }
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Strategy generation failed' },
      { status: 502 }
    )
  }

  return NextResponse.json({ strategy: cacheResult.result, fromCache: cacheResult.fromCache })
}
