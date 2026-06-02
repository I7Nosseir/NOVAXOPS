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
  | 'intel'
  | 'trends'
  | 'ads'
  | 'repurpose'

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
  budget: 'Low' | 'Medium' | 'High'
  timeline: 'Days' | 'Weeks' | 'Months'
  risk?: string
  mitigation?: string
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
}

export interface ScriptSection {
  section: string
  lines: string[]
  visual_note: string
  duration_estimate: string
}

// ─── Content Studio Document ──────────────────────────────────

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
    why_selected: string
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

export interface StrategyPhase {
  name: string
  diamond_position: string
  key_insight: string
  content: Record<string, unknown>
}

export interface StrategyDocument {
  executive_summary: string
  phases: StrategyPhase[]
  // Optional flat phase data used by strategy/page.tsx
  phase_intelligence?: Record<string, unknown>
  phase_positioning?: Record<string, unknown>
  phase_execution?: Record<string, unknown>
  phase_scale?: Record<string, unknown>
  phase_optimize?: Record<string, unknown>
  obstacle?: string
  brief?: string
  platforms?: string[]
  client_name?: string
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
