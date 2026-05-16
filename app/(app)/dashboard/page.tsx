'use client'

import { useTasks } from '@/lib/hooks/use-tasks'
import { useClients } from '@/lib/hooks/use-clients'
import { useUsers } from '@/lib/hooks/use-users'
import { usePosts } from '@/lib/hooks/use-posts'
import { useModerationItems } from '@/lib/hooks/use-moderation'
import { useWeeklyActivity, useAiCostMonth } from '@/lib/hooks/use-dashboard'
import { useAuth } from '@/lib/auth-context'
import { hasRole, STAGE_CONFIG, PRIORITY_CONFIG, PIPELINE_STAGES, formatDate, formatNumber, formatCurrency } from '@/lib/utils'
import {
  CheckSquare, Clock, AlertCircle, MessageSquare,
  DollarSign, Calendar, Globe, TrendingUp, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

const PIE_COLORS = ['#7c3aed','#3b82f6','#06b6d4','#f59e0b','#f97316','#f43f5e','#ec4899','#6366f1','#10b981','#64748b']

export default function DashboardPage() {
  const { user } = useAuth()
  const { tasks } = useTasks()
  const { clients } = useClients()
  const { users } = useUsers()
  const { posts } = usePosts()
  const { items: moderationItems } = useModerationItems()
  const { data: activityData = [] } = useWeeklyActivity()
  const { data: aiCostRaw = 0 } = useAiCostMonth()

  const canSeeAiCost = hasRole(user, ['admin', 'ceo', 'creative_director'])

  const today = new Date().toISOString().split('T')[0]
  const activeTasks     = tasks.filter(t => t.status === 'active').length
  const dueToday        = tasks.filter(t => t.due_date === today && t.status !== 'completed').length
  const pendingApprovals = tasks.filter(t => t.pipeline_stage === 'approval').length
  const pendingModeration = moderationItems.filter(m => m.status === 'pending').length
  const postsScheduled  = posts.filter(p => p.status === 'scheduled').length
  const postsPublished  = posts.filter(p => p.status === 'published').length

  // Pipeline distribution derived from real tasks
  const stageDistribution = PIPELINE_STAGES.map(stage => ({
    name: STAGE_CONFIG[stage].label,
    value: tasks.filter(t => t.pipeline_stage === stage).length,
  }))

  // Recent tasks sorted by last update
  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6)

  const topPosts = [...posts]
    .filter(p => p.performance?.engagement_rate)
    .sort((a, b) => b.performance!.engagement_rate - a.performance!.engagement_rate)
    .slice(0, 3)

  const statCards = [
    { label: 'Active Tasks',       value: activeTasks,      icon: CheckSquare,   color: 'bg-blue-50 text-blue-600',      delta: `${tasks.filter(t => t.status === 'blocked').length} blocked` },
    { label: 'Due Today',          value: dueToday,         icon: Clock,         color: 'bg-amber-50 text-amber-600',    delta: `${tasks.filter(t => t.due_date < today && t.status !== 'completed').length} overdue` },
    { label: 'Pending Approvals',  value: pendingApprovals, icon: AlertCircle,   color: 'bg-rose-50 text-rose-600',      delta: 'Needs attention' },
    { label: 'Pending Moderation', value: pendingModeration,icon: MessageSquare, color: 'bg-purple-50 text-purple-600',  delta: `${moderationItems.filter(m => m.status === 'escalated').length} escalated` },
    {
      label: 'AI Cost (Month)',
      value: canSeeAiCost ? formatCurrency(aiCostRaw) : '—',
      icon: DollarSign,
      color: 'bg-emerald-50 text-emerald-600',
      delta: canSeeAiCost ? 'via API usage log' : 'Restricted',
    },
    { label: 'Posts Scheduled',    value: postsScheduled,   icon: Calendar,      color: 'bg-novax-light text-novax',     delta: 'Upcoming' },
    { label: 'Posts Published',    value: postsPublished,   icon: Globe,         color: 'bg-cyan-50 text-cyan-600',      delta: 'This month' },
    { label: 'Pipeline Velocity',  value: tasks.length > 0 ? '3d' : '—', icon: TrendingUp, color: 'bg-orange-50 text-orange-600', delta: 'Avg days/stage' },
  ]

  return (
    <div className="space-y-6">
      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, delta }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[11px] text-slate-400">{delta}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Weekly activity — real data */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Weekly Activity</h3>
              <p className="text-xs text-slate-500">Tasks completed &amp; posts published</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={activityData.length > 0 ? activityData : [{ day: '—', tasks: 0, posts: 0 }]}>
              <defs>
                <linearGradient id="tasks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1B3D38" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#1B3D38" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="posts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}/>
              <Area type="monotone" dataKey="tasks" stroke="#1B3D38" strokeWidth={2} fill="url(#tasks)" name="Tasks completed"/>
              <Area type="monotone" dataKey="posts" stroke="#10b981" strokeWidth={2} fill="url(#posts)" name="Posts published"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline distribution — real data */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-1">Pipeline Distribution</h3>
          <p className="text-xs text-slate-500 mb-4">Tasks per stage</p>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={stageDistribution}
                cx="50%" cy="50%"
                innerRadius={35} outerRadius={60}
                paddingAngle={2}
                dataKey="value"
              >
                {stageDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]}/>)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1 mt-2">
            {stageDistribution.slice(0, 4).map((s, i) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i] }}/>
                <span className="text-[10px] text-slate-500 truncate">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Recent tasks — sorted by updated_at */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Recent Tasks</h3>
            <a href="/pipeline" className="text-xs text-novax hover:text-novax-hover font-medium">View pipeline →</a>
          </div>
          <div className="space-y-2">
            {recentTasks.map(task => {
              const stage    = STAGE_CONFIG[task.pipeline_stage]
              const priority = PRIORITY_CONFIG[task.priority]
              const client   = clients.find(c => c.id === task.client_id)
              const user     = users.find(u => u.id === task.assigned_to)
              return (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate group-hover:text-novax transition-colors">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-400">{client?.name}</span>
                      <span className="text-slate-200">·</span>
                      <span className="text-[11px] text-slate-400">{task.due_date ? `Due ${formatDate(task.due_date)}` : 'No due date'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${stage.bg} ${stage.color}`}>{stage.label}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priority.bg} ${priority.color}`}>{priority.label}</span>
                    {user && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: user.color }}>
                        {user.initials}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {recentTasks.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">No tasks yet.</p>
            )}
          </div>
        </div>

        {/* Top posts */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Top Performing Posts</h3>
            <a href="/reports" className="text-xs text-novax hover:text-novax-hover font-medium">Reports →</a>
          </div>
          <div className="space-y-3">
            {topPosts.map(post => {
              const client = clients.find(c => c.id === post.client_id)
              const isUp = post.performance!.engagement_rate > 5
              return (
                <div key={post.id} className="p-3 rounded-lg bg-slate-50">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: client?.color }}>
                        {client?.initials}
                      </span>
                      <span className="text-[11px] font-medium text-slate-700">{client?.name}</span>
                    </div>
                    <div className={`flex items-center gap-0.5 text-[11px] font-semibold ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isUp ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownRight className="w-3 h-3"/>}
                      {post.performance!.engagement_rate}%
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2">{post.caption}</p>
                  <div className="flex gap-3 mt-2 text-[10px] text-slate-400">
                    <span>{formatNumber(post.performance!.reach)} reach</span>
                    <span>{formatNumber(post.performance!.likes)} likes</span>
                    <span>{post.performance!.comments} comments</span>
                  </div>
                </div>
              )
            })}
            {topPosts.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">No published posts with data yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Client health */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Client Health</h3>
          <a href="/clients" className="text-xs text-novax hover:text-novax-hover font-medium">All clients →</a>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {clients.map(client => {
            const clientTasks = tasks.filter(t => t.client_id === client.id)
            const completed   = clientTasks.filter(t => t.status === 'completed').length
            const active      = clientTasks.filter(t => t.status === 'active').length
            const health      = Math.min(100, Math.round((completed / Math.max(clientTasks.length, 1)) * 100) + 40)
            const scheduled   = posts.filter(p => p.client_id === client.id && p.status === 'scheduled').length
            return (
              <div key={client.id} className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: client.color }}>
                    {client.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{client.name}</p>
                    <p className="text-[10px] text-slate-400">{client.brand_identity.industry}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Health score</span>
                    <span className="font-semibold text-slate-700">{health}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${health}%`, background: health > 70 ? '#10b981' : health > 40 ? '#f59e0b' : '#f43f5e' }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                    <span>{active} active</span>
                    <span>{scheduled} scheduled</span>
                  </div>
                </div>
              </div>
            )
          })}
          {clients.length === 0 && (
            <p className="col-span-4 text-sm text-slate-400 text-center py-6">No clients yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
