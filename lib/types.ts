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
export type AgentType = 'task_analyzer' | 'copywriter' | 'researcher' | 'asset_finder' | 'presentation_builder'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  department: Department
  initials: string
  color: string
}

export interface BrandIdentity {
  primary_color: string
  secondary_color: string
  tone_of_voice: string
  target_audience: string
  key_messages: string[]
  industry: string
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
  crisis_mode?: boolean
  is_in_crisis?: boolean
  performance_intel?: PerformanceIntel
  performance_analyzed_at?: string
  created_at: string
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
  due_date: string
  created_at: string
  updated_at: string
  tags: string[]
  seen_at?: string | null
  seen_by?: string | null
  read_at?: string | null
  read_by?: string | null
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
