export type PipelineStage =
  | 'strategy'
  | 'ideas'
  | 'calendar'
  | 'copy'
  | 'design'
  | 'review'
  | 'approval'
  | 'scheduled'
  | 'published'
  | 'reporting'

export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'active' | 'blocked' | 'completed'
export type UserRole = 'admin' | 'ceo' | 'creative_director' | 'copywriter' | 'designer' | 'social_manager' | 'account_manager' | 'strategist'
export type Department = 'creative' | 'strategy' | 'accounts' | 'social'
export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'twitter' | 'youtube' | 'pinterest'
export type InstagramPostType = 'POST' | 'REEL' | 'STORY'
export type FacebookPostType  = 'POST' | 'REEL' | 'STORY'
export type AgentType = 'task_analyzer' | 'copywriter' | 'researcher' | 'asset_finder' | 'presentation_builder'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  department: Department
  initials: string
  color: string
  phone_number?: string | null
  needs_onboarding?: boolean
  /** Optional page keys this user can access. null = all pages. Set by admin. */
  page_permissions?: string[] | null
}

export interface BrandIdentity {
  primary_color: string
  secondary_color: string
  tone_of_voice: string
  target_audience: string
  key_messages: string[]
  industry: string
  logo_url?: string
}

export interface ClientNormalizedProfile {
  // SECTION 1: Positioning
  positioning_statement?: string      // What you do, for whom, and why differently (≤200 chars)
  primary_offering?: string           // Core product or service
  key_differentiator?: string         // The ONE thing that sets them apart
  price_positioning?: 'ultra_premium' | 'premium' | 'mid_market' | 'value'

  // SECTION 2: Audience
  audience_age_range?: string         // e.g. "25–40"
  audience_gender_skew?: 'female' | 'male' | 'balanced'
  audience_location?: string          // City / Country / Region
  audience_psychographic?: string     // Lifestyle, mindset, values

  // SECTION 3: Voice & Language
  brand_voice?: string[]              // 3–5 adjectives: Bold, Warm, Educational…
  language?: 'arabic_only' | 'english_only' | 'both'
  arabic_dialect?: string             // Gulf / Egyptian / Levantine / MSA
  formality?: 'very_formal' | 'professional' | 'balanced' | 'friendly' | 'very_casual'
  emoji_policy?: 'never' | 'on_request' | 'always'

  // SECTION 4: Content Rules
  content_goal?: 'awareness' | 'lead_gen' | 'sales' | 'retention' | 'launch' | 'community'
  primary_cta?: string                // e.g. "DM us to book", "link in bio"
  banned_topics?: string              // Topics / words / associations to avoid
  hashtag_policy?: 'never' | 'on_request' | 'always'

  // SECTION 5: Social Presence
  primary_platform?: SocialPlatform
  secondary_platforms?: SocialPlatform[]
  posts_per_week?: number
  best_posting_times?: string         // e.g. "Weekdays 7–9 PM Gulf time"
}

export interface Client {
  id: string
  name: string
  initials: string
  color: string
  status: 'active' | 'inactive' | 'prospect'
  brand_identity: BrandIdentity
  competitor_context: string[]
  reference_links: string[]
  metricool_blog_id?: string
  respond_io_channel_id?: string
  chatwoot_inbox_id?: number
  crisis_mode?: boolean
  performance_intel?: PerformanceIntel
  performance_analyzed_at?: string
  design_brief_json?: DesignBrief | null
  normalized_profile?: ClientNormalizedProfile
  created_at: string
}

export interface DesignBrief {
  // Canvas specs
  canvas_sizes: { name: string; width: number; height: number; format: string }[]
  // Brand
  primary_font: string
  secondary_font: string
  brand_colors_extra: string[]  // hex values beyond the main brand color
  // Style
  visual_style_notes: string   // e.g. "Minimal, airy, white space heavy"
  mood_references: string[]    // URLs or text descriptions
  // Motion / Video
  motion_style: string         // e.g. "Smooth transitions, no bounce, max 15s"
  ai_video_notes: string       // e.g. "Cinematic, product focus, no people"
  // Delivery
  file_formats: string[]       // e.g. ["mp4", "png", "pdf"]
  // Notes
  general_notes: string
}

export interface Project {
  id: string
  client_id: string
  name: string
  status: 'active' | 'completed' | 'paused'
  start_date: string
  end_date: string
  quarter_strategy: {
    goals: string[]
    themes: string[]
    kpis: string[]
  }
  created_at: string
}

export interface Task {
  id: string
  project_id: string
  client_id: string
  assigned_to: string
  title: string
  description: string
  final_submission?: string | null
  pipeline_stage: PipelineStage
  priority: Priority
  status: TaskStatus
  sub_type?: string | null
  due_date: string
  created_at: string
  updated_at: string
  tags: string[]
  seen_at?: string | null
  seen_by?: string | null
  read_at?: string | null
  read_by?: string | null
  linked_doc_ids?: string[]
}

export interface AIResponse {
  id: string
  task_id: string
  agent_type: AgentType
  response_text: string
  cost_usd: number
  created_at: string
  is_cached: boolean
  model_used: string
}

export interface Asset {
  id: string
  task_id: string
  source: 'upload' | 'drive'
  type: 'image' | 'video' | 'illustration' | 'icon' | 'document'
  file_url: string
  thumbnail_url: string
  license_info: string
  title: string
  created_at: string
}

export interface ScheduledPost {
  id: string
  task_id: string
  client_id: string
  platforms: SocialPlatform[]
  caption: string
  media_url?: string
  scheduled_at: string
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  metricool_post_id?: string
  performance?: PostPerformance
  published_at?: string
}

export interface PostPerformance {
  reach: number
  impressions: number
  engagement_rate: number
  likes: number
  comments: number
  shares: number
  saves: number
}

export interface ModerationItem {
  id: string
  client_id: string
  platform: SocialPlatform
  commenter_name: string
  commenter_handle: string
  comment_text: string
  post_caption: string
  ai_suggested_reply?: string
  final_reply?: string
  status: 'pending' | 'replied' | 'ignored' | 'escalated'
  created_at: string
  chatwoot_conversation_id?: number
  chatwoot_message_id?: number
  chatwoot_inbox_id?: number
}

export interface DashboardStats {
  active_tasks: number
  due_today: number
  pending_approvals: number
  pending_moderation: number
  ai_cost_month: number
  posts_scheduled: number
  posts_published: number
  pipeline_velocity: number
}

export interface PostPerformanceSnapshot {
  id: string
  post_id: string
  captured_at: string
  platform: string
  reach: number
  impressions: number
  likes: number
  comments: number
  shares: number
  saves: number
  link_clicks: number
  engagement_rate: number
}

export interface CompetitorSnapshot {
  id: string
  client_id: string
  platform: string
  competitor_handle: string
  followers: number
  avg_er: number
  top_content_types: Record<string, number>
  posting_frequency: number
  captured_at: string
  notes?: string
}

export interface CompetitorPost {
  id: string
  client_id: string
  competitor_handle: string
  platform: string
  post_url?: string
  content_type?: 'reel' | 'carousel' | 'static' | 'story' | 'video' | 'other'
  caption?: string
  hook_text?: string
  likes: number
  comments: number
  views: number
  shares: number
  engagement_rate: number
  posted_at?: string
  scraped_at: string
}

export interface CompetitorRanking {
  handle: string
  platform: string
  followers: number
  avg_er: number
  posting_frequency: number
  growth_signal: 'accelerating' | 'stable' | 'declining' | 'unknown'
}

export interface CompetitorThreat {
  handle: string
  platform: string
  threat_level: 'high' | 'medium' | 'low'
  reasons: string[]
  recommended_response: string
}

export interface CompetitorAnalysis {
  landscape: CompetitorRanking[]
  opportunities: string[]
  threats: CompetitorThreat[]
  hooks_to_avoid: string[]
  hooks_to_try: string[]
  recommended_formats: string[]
  monthly_actions: string[]
  summary: string
  generated_at: string
}

export interface ContentRecommendation {
  title: string
  platform: string
  format: string
  caption_angle: string
  timing: string
  expected_er: string
}

export interface ContentMixRecommendation {
  current: Record<string, number>
  recommended: Record<string, number>
  rationale: string
}

// ── Content Brief Requests ────────────────────────────────────────────────────

export type ContentType = 'static' | 'carousel' | 'reel' | 'story'
export type BriefRequestStatus = 'pending' | 'submitted' | 'expired'

export interface ContentBriefData {
  content_type: ContentType
  // Shared
  visual_feeling?: string
  // Static
  main_message?: string
  subject_focus?: string
  text_on_image?: string
  reference_links?: string[]
  // Carousel
  carousel_topic?: string
  slide_count?: number
  first_slide_type?: string
  last_slide_cta?: string
  text_density?: string
  // Reel
  key_message?: string
  duration?: string
  opening_style?: string
  on_camera?: string
  music_vibe?: string
  reel_goal?: string
  specific_scenes?: string
  // Story
  story_message?: string
  story_purpose?: string
  interactive_elements?: string[]
  // Timeline
  needed_by?: string
  urgency?: string
  // Submission meta
  additional_notes?: string
  submitter_name?: string
}

export interface ContentBriefRequest {
  id: string
  task_id: string
  client_id: string
  token: string
  status: BriefRequestStatus
  brief_data: ContentBriefData | null
  expires_at: string
  submitted_at: string | null
  created_by: string | null
  created_at: string
}

export interface PerformanceIntel {
  viral_patterns: string[]
  failure_patterns: string[]
  optimal_times: Record<string, string>
  content_mix_recommendation: ContentMixRecommendation
  next_recommendations: ContentRecommendation[]
  one_line_summary: string
  // From client SWOT analysis (clients/analyze route)
  strengths?: string[]
  weaknesses?: string[]
  opportunities?: string[]
  threats?: string[]
  market_position?: string
  growth_score?: number
  engagement_trend?: string
  content_gap?: string[]
  key_insights?: string[]
  strategy_90_days?: string[]
}
