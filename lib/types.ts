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
  source: 'freepik' | 'upload'
  type: 'image' | 'illustration' | 'icon'
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
