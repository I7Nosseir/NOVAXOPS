// ============================================================
// Studio Tools — Canonical Type Definitions (v4 · Definitive)
// All Studio modules import from here.
// ============================================================

export type StudioTool =
  | 'content'
  | 'hooks'
  | 'strategy'
  | 'campaign'
  | 'postmortem'
  | 'formats'
  | 'visual'
  | 'intel'
  | 'trends'
  | 'ads'
  | 'repurpose'
  | 'media_buying'
  | 'copy'
  | 'decks'

export type SessionStatus = 'running' | 'partial' | 'complete' | 'error'

export type PerformanceVerdict = 'exceeded' | 'met' | 'below' | 'significantly_below'

export type HookTier = 'S' | 'A' | 'B' | 'C'

// Used by all loading screens
export interface LoadingStep {
  label: string
  status: 'pending' | 'active' | 'complete'
  insight?: string
}

// ─── Signal Network ──────────────────────────────────────────

export interface SignalReport {
  industry: string
  generated_at: string
  valid_until: string
  trending_topics: Array<{
    topic: string
    platform: string
    velocity: 'rising_fast' | 'rising' | 'peaking' | 'declining'
    evidence: string
  }>
  trending_formats: Array<{
    format: string
    platform: string
    why_working: string
  }>
  cultural_tensions: Array<{
    tension: string
    evidence: string
    opportunity: string
  }>
  trending_sounds: string[]
  breakout_keywords: string[]
}

// ─── Session Performance & Feedback Loop ─────────────────────

export interface SessionPerformance {
  post_id: string
  platform: string
  published_at: string
  measured_at: string
  metrics: {
    reach: number
    impressions: number
    engagement_rate: number
    saves: number
    shares: number
    comments: number
    link_clicks?: number
  }
  performance_verdict: PerformanceVerdict
  vs_client_average: number
  vs_industry_benchmark: number
}

// ─── Boss Brief ───────────────────────────────────────────────

export interface BossBrief {
  what_we_made: string
  why_it_works: string
  the_one_thing: string
  do_this_now: string
  watch_out_for?: string
}

// ─── Campaign Igniter ─────────────────────────────────────────

export interface CampaignConcept {
  campaign_name: string
  tagline: string
  core_idea: string
  why_it_works: string
  cultural_tension: string
  platform: string
  execution_steps: string[]
  participation_mechanic: string
  shareable_moment: string
  scoring: {
    boldness: number
    implementability: number
    virality: number
  }
  budget: string
  timeline: string
  risk?: string
  mitigation?: string
  // Enhanced fields (Phase 7 output)
  content_ladder?: string[]
  seed_strategy?: string
  virality_trigger?: string
  anti_example?: string
  repeatable_format?: string
}

// ─── Content Studio ───────────────────────────────────────────

export interface ContentInputs {
  platforms: string[]
  audience: 'B2C' | 'B2B'
  goal: string
  cta: string
  brief: string
  language: 'english' | 'arabic'
  dialect?: 'saudi' | 'egyptian' | 'gulf' | 'msa'
  emotional_trigger?: string
  content_type?: 'reel' | 'carousel' | 'static'
  piece_count?: 1 | 2 | 3
}

// ─── Structured Interactivity ─────────────────────────────────

export interface BriefConfirmation {
  client_name: string
  platforms: string[]
  goal: string
  audience: string
  language: string
  performance_days: number
  key_signal: string
}

export interface StructuredQuestion {
  question: string
  options: string[]
  type: 'generated' | 'static'
}

// ─── Chat & Edits ─────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export interface EditPayload {
  type: 'edit'
  target: string
  new_content: string
  reasoning: string
}

// ─── Hook Lab ─────────────────────────────────────────────────

export interface HookItem {
  rank: number
  hook_text: string
  hook_type: string
  format: string
  tier: HookTier
  total_score: number
  clarity: number
  context: number
  curiosity: number
  scamper_applied?: string
  headline?: string
  body?: string
  cta?: string
}

export interface ScriptSection {
  section: string
  lines: string[]
  visual_note: string
  duration_estimate: string
}

// ─── Content Studio Document ──────────────────────────────────

export type ContentFormat = 'reel' | 'carousel' | 'static'

export interface ContentPiece {
  type: ContentFormat
  index: number
  hook: {
    text: string
    type: string
    tier: HookTier
    score: number
    clarity: number
    context: number
    curiosity: number
    why_selected?: string
  } | null
  // Reel fields
  script_sections?: ScriptSection[]
  total_duration?: string
  production_difficulty?: string
  brand_compliance_notes?: string
  key_broll_list?: string[]
  // Carousel fields
  slides?: Array<{ title: string; body: string; visual_note?: string }>
  // Static fields
  visual_direction?: string
  text_overlay?: string
  // Shared
  caption_preview?: string
}

export interface ContentDocument {
  // Canonical shape (used by document renderer)
  hook?: {
    text: string
    type: string
    tier: HookTier
    score: number
    clarity: number
    context: number
    curiosity: number
    why_selected?: string
  } | null
  audience_intelligence?: {
    functional_job: string
    emotional_job: string
    social_job: string
    key_insights?: string[]
  }
  script_sections?: ScriptSection[]
  total_duration?: string
  production_difficulty?: string
  brand_compliance_notes?: string
  key_broll_list?: string[]
  caption_preview?: string
  platform_notes?: Record<string, string>

  // Multi-piece support
  pieces?: ContentPiece[]
  content_type?: ContentFormat
  piece_count?: number

  // Page-built shape (assembled by content/page.tsx)
  what_we_built?: string
  selected_hook?: {
    hook_text: string
    hook_type: string
    virality_tier: HookTier
    clarity_score: number
    context_score: number
    curiosity_score: number
    total_score: number
    why_selected: string
  } | null
  script?: {
    sections: ScriptSection[]
    total_duration: string
    production_difficulty: string
    brand_compliance_notes: string
  } | null
  broll_list?: string[]
  caption?: string
  platforms?: string[]
  language?: string
  cold_start?: boolean
}

export interface HookDocument {
  hooks: Array<HookItem | {
    hook_text: string
    hook_type: string
    virality_tier: HookTier
    clarity_score: number
    context_score: number
    curiosity_score: number
    total_score: number
    format_rec?: string
    format_note?: string
  }>
  generated_count?: number
  top_tier_count?: number
  tier_summary?: { S: number; A: number; B: number; C: number }
  best_hook?: {
    hook_text: string
    hook_type: string
    virality_tier: HookTier
    clarity_score: number
    context_score: number
    curiosity_score: number
    total_score: number
  } | null
  platform?: string
  language?: string
  boldness?: string
}

// ─── Strategy ─────────────────────────────────────────────────

export interface StrategyContentPillar {
  name: string
  description: string
}

export interface StrategyArcPhase {
  number: string
  phase_name: string
  description: string
}

export interface StrategyPlatformRole {
  platform: string
  role: string
  description: string
}

export interface StrategyMonthTactic {
  month: string
  role: string
  theme_line: string
  description: string
  brand_persona_adjectives: string[]
  brand_persona_description: string
  focus: string[]
  outcome: string[]
}

export interface StrategyFormatRoles {
  reels: string[]
  motion_graphics: string[]
  static_carousel: string[]
}

export interface StrategyFlowBeat {
  beat: string
  label: string
  phase: string
  description: string
}

export interface StrategyDocument {
  // Legacy fields kept for backward compat
  executive_summary?: string
  phases?: Array<{ name: string; diamond_position: string; key_insight: string; content: Record<string, unknown> }>
  phase_intelligence?: Record<string, unknown>
  phase_positioning?: Record<string, unknown>
  phase_execution?: Record<string, unknown>
  phase_scale?: Record<string, unknown>
  phase_optimize?: Record<string, unknown>

  // New Esplanade-style fields
  positioning_statement?: string
  campaign_line?: string
  quarter_role?: string
  identity_shift?: string
  content_pillars?: StrategyContentPillar[]
  strategy_arc?: StrategyArcPhase[]
  platform_roles?: StrategyPlatformRole[]
  monthly_tactics?: StrategyMonthTactic[]
  format_roles?: StrategyFormatRoles
  tenant_integration?: string[]
  strategy_flow?: StrategyFlowBeat[]

  // Deep-strategy fields (added by reflection agent)
  north_star?: string
  competitive_gap?: string
  creative_tension?: string
  audience_insight?: string

  // Metadata
  obstacle?: string
  brief?: string
  platforms?: string[]
  client_name?: string
  quarter?: string
  year?: number
  campaign_theme?: string
}

// ─── Post-Mortem ──────────────────────────────────────────────

export interface PostMortemAnalysis {
  verdict: 'likely_cause' | 'contributing' | 'not_issue'
  finding: string
  fix?: string
  status?: string
}

export interface PostMortemDiagnosis {
  session_name: string
  platform: string
  published_at: string
  engagement_rate: number
  vs_client_avg: number
  analyses: {
    hook: PostMortemAnalysis
    format: PostMortemAnalysis
    timing: PostMortemAnalysis
    caption: PostMortemAnalysis
  }
  hook_analysis?: PostMortemAnalysis
  format_analysis?: PostMortemAnalysis
  timing_analysis?: PostMortemAnalysis
  caption_analysis?: PostMortemAnalysis
  verdict: string
  verdict_brief?: string
  rerun_constraints: Record<string, string>
  result?: {
    er: number
    vs_avg: number
    vs_client_average?: number
    client_avg_er?: number
    reach?: number
    saves?: number
    status?: string
  }
}

// ─── Campaign Document ────────────────────────────────────────

export interface CampaignDocument {
  cultural_tensions: Array<{
    tension: string
    evidence: string
    opportunity: string
  }>
  inverted_rules: Array<{
    rule: string
    inversion: string
  }>
  creative_domains: string[]
  concepts: CampaignConcept[]
}

// ─── Metricool Context ────────────────────────────────────────

export interface MetricoolContext {
  client_id: string
  data_available: boolean
  days_of_history: number
  best_format: string
  best_posting_time: string
  avg_engagement_rate: number
  industry_avg_er: number
  top_posts: Array<{
    post_id: string
    format: string
    hook_type: string
    er: number
    posted_at: string
  }>
  worst_posts: Array<{
    post_id: string
    format: string
    hook_type: string
    er: number
    posted_at: string
  }>
  observed_pattern: string
  cold_start: boolean
  cache_hit: boolean
  fetched_at: string
}

// ─── Visual Content Engine ────────────────────────────────────

export type VideoFormat = '9:16' | '16:9' | '1:1' | '4:5'
export type NarrativePurpose = 'HOOK' | 'AGITATE' | 'SHIFT' | 'SOLUTION' | 'SOCIAL_PROOF' | 'CTA' | 'BUILDUP' | 'REVEAL'

export interface VisualApproach {
  id: string
  name: string
  tagline: string
  narrative_arc: string
  hook_type: string
  hook_moment: string
  vibe: string
  emotional_journey: string
  scene_structure: string[]
  why_it_works: string
  boldness: number
  best_for: string
}

export interface VisualAnchor {
  style: string
  pov: string
  subject: string
  environment: string
  lighting: string
  color_treatment: string
  technical: string
  full_anchor_text: string
}

export interface ScenePrompt {
  scene_number: number
  duration: string
  narrative_purpose: NarrativePurpose
  voiceover: string | null
  image_prompt: string
  video_prompt: string
  camera_angle: string
  emotion_direction: string
  continuity_note: string
}

export interface VisualProductionNotes {
  hook_checklist: {
    grabs_instantly: boolean
    visually_disruptive: boolean
    hook_format_used: string
    note: string
  }
  platform_notes: {
    aspect_ratio: string
    pacing: string
    thumbnail_scene: number
    cta_placement: string
  }
  sound_direction: {
    music_mood: string
    sfx_moments: string[]
    voiceover_tone: string
  }
  upscale_priority: string[]
  editing_notes: string[]
}

export interface VisualDocument {
  anchor: VisualAnchor
  scenes: ScenePrompt[]
  production_notes: VisualProductionNotes
  boss_brief: BossBrief
}

export interface VisualInputs {
  client_id: string | null
  platform: string
  format: VideoFormat
  length: string
  objective: string
  audience: string
  core_message: string
  vibe: string
  cta_type: string
  additional_notes?: string
}

// ─── Copy Engine ─────────────────────────────────────────────

export type CopyFramework =
  | 'auto'
  | 'aida'
  | 'pas'
  | 'bab'
  | 'hook_story_offer'
  | '4ps'
  | 'storybrand'
  | 'pastor'

export type CopyLength   = 'micro' | 'short' | 'medium' | 'long' | 'extended'
export type EmojiStyle   = 'none'  | 'minimal' | 'moderate' | 'rich'
export type HashtagStyle = 'none'  | 'minimal' | 'standard' | 'max'
export type CopyLanguage = 'en' | 'ar' | 'both'
export type CopyDialect  = 'saudi' | 'egyptian' | 'gulf' | 'msa'

export interface CopyImage {
  type: 'upload' | 'drive'
  data: string           // base64 for upload; raw Drive URL for drive
  mime_type: string      // e.g. 'image/jpeg'
  slide_index: number    // 0-based; 0 = single post image
  slide_note?: string    // optional per-slide brief
}

export interface CopyVariant {
  variant_index: number
  caption: string
  framework_used: string
  char_count: number
}

export interface SlideCaption {
  slide_index: number   // 1-based
  caption: string
  char_count: number
}

export interface CopyDocument {
  variants: CopyVariant[]
  hashtags: string[]
  alt_text: string
  framework_used: string
  framework_rationale: string
  language: CopyLanguage
  platform: string
  provider: 'claude' | 'gemini'
  content_type?: 'single' | 'carousel'
  slide_captions?: SlideCaption[]
  copy_session_id?: string        // set after DB persistence in generate route
  inspiration_ref_count?: number  // how many Pinterest refs informed this output
}

// ─── Studio Session (Core Record) ────────────────────────────

export interface StudioSession {
  id: string
  name: string
  client_id: string | null
  tool: StudioTool
  created_by: string | null
  status: SessionStatus
  brief: string | null
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  executive_summary: string | null
  boss_brief: BossBrief | null
  structured_answers: Record<string, string>
  chat_history: ChatMessage[]
  edit_history: Array<{
    target: string
    old: string
    new: string
    timestamp: string
  }>
  signal_report_used: SignalReport | null
  metricool_snapshot: MetricoolContext | null
  performance: SessionPerformance | null
  performance_verdict: PerformanceVerdict | null
  created_at: string
  updated_at: string
}
