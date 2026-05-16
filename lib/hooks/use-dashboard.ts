import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useWeeklyActivity() {
  return useQuery({
    queryKey: ['dashboard', 'weekly_activity'],
    queryFn: async () => {
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        return d.toISOString().split('T')[0]
      })

      const [{ data: taskData }, { data: postData }] = await Promise.all([
        supabase
          .from('tasks')
          .select('updated_at')
          .eq('status', 'completed')
          .gte('updated_at', days[0]),
        supabase
          .from('scheduled_posts')
          .select('published_at')
          .eq('status', 'published')
          .gte('published_at', days[0]),
      ])

      return days.map(day => ({
        day: new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
        tasks: (taskData ?? []).filter(t => (t.updated_at as string)?.startsWith(day)).length,
        posts: (postData ?? []).filter(p => (p.published_at as string)?.startsWith(day)).length,
      }))
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useAiCostMonth() {
  return useQuery({
    queryKey: ['dashboard', 'ai_cost'],
    queryFn: async () => {
      const start = new Date()
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      const { data } = await supabase
        .from('api_usage')
        .select('cost_usd')
        .gte('created_at', start.toISOString())
      return (data ?? []).reduce((sum, r) => sum + (Number(r.cost_usd) || 0), 0)
    },
    staleTime: 10 * 60 * 1000,
  })
}
