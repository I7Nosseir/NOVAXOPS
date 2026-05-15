import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { User, UserRole } from '@/lib/types'

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    role: row.role as UserRole,
    department: row.department as User['department'],
    initials: row.initials as string,
    color: row.color as string,
  }
}

export function useUsers() {
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, department, initials, color')
        .order('name')
      if (error) throw error
      return (data ?? []).map(mapUser)
    },
  })
  return { users, isLoading, error }
}
