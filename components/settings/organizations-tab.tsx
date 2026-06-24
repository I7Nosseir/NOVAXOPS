'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Building2, Plus, ChevronDown, ChevronUp, Loader2,
  UserPlus, UserMinus, Check, X, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────

interface Org {
  id: string
  name: string
  slug: string
  plan: 'trial' | 'starter' | 'growth' | 'scale'
  status: 'active' | 'suspended' | 'cancelled'
  max_clients: number
  max_users: number
  ai_calls_per_month: number
  member_count: number
  client_count: number
  created_at: string
}

interface Member {
  id: string
  name: string
  email: string
  role: string
  is_super_admin: boolean
  initials: string
  color: string
}

interface AllUser {
  id: string
  name: string
  email: string
  role: string
  organization_id: string
}

// ── Helpers ───────────────────────────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  trial:   'bg-slate-100 text-slate-600',
  starter: 'bg-blue-50 text-blue-600',
  growth:  'bg-purple-50 text-purple-700',
  scale:   'bg-novax-light text-novax',
}

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-emerald-50 text-emerald-700',
  suspended: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-red-50 text-red-600',
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ── Create Org Form ────────────────────────────────────────────

function CreateOrgForm({ onCreated, onCancel }: { onCreated: (org: Org) => void; onCancel: () => void }) {
  const [name,       setName]       = useState('')
  const [slug,       setSlug]       = useState('')
  const [plan,       setPlan]       = useState<string>('trial')
  const [maxClients, setMaxClients] = useState(5)
  const [maxUsers,   setMaxUsers]   = useState(5)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [slugEdited, setSlugEdited] = useState(false)

  const handleNameChange = (v: string) => {
    setName(v)
    if (!slugEdited) setSlug(slugify(v))
  }

  const submit = async () => {
    if (!name.trim() || !slug.trim()) { setError('Name and slug are required'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim(), plan, max_clients: maxClients, max_users: maxUsers }),
      })
      const data = await res.json() as Org & { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      onCreated({ ...data, member_count: 0, client_count: 0 })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create organization')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-novax-light/40 border border-novax-border rounded-xl p-5 space-y-4">
      <p className="text-sm font-bold text-novax">New Organization</p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
          <input
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Acme Agency"
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-novax-muted"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Slug (unique ID)</label>
          <input
            value={slug}
            onChange={e => { setSlug(slugify(e.target.value)); setSlugEdited(true) }}
            placeholder="acme-agency"
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-mono text-slate-700 focus:outline-none focus:border-novax-muted"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Plan</label>
          <select
            value={plan}
            onChange={e => setPlan(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-novax-muted"
          >
            <option value="trial">Trial</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="scale">Scale</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Max Clients</label>
          <input
            type="number" min={1}
            value={maxClients}
            onChange={e => setMaxClients(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-novax-muted"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Max Users</label>
          <input
            type="number" min={1}
            value={maxUsers}
            onChange={e => setMaxUsers(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-novax-muted"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={() => void submit()}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-novax text-white text-sm font-semibold rounded-lg hover:bg-novax-hover disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Create Organization
        </button>
        <button onClick={onCancel} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Org Members Panel ──────────────────────────────────────────

function OrgMembersPanel({ org, allUsers, onMembersChanged }: {
  org: Org
  allUsers: AllUser[]
  onMembersChanged: () => void
}) {
  const [members,    setMembers]    = useState<Member[]>([])
  const [loading,    setLoading]    = useState(true)
  const [addUserId,  setAddUserId]  = useState('')
  const [adding,     setAdding]     = useState(false)
  const [removing,   setRemoving]   = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  const memberIds = new Set(members.map(m => m.id))
  const candidates = allUsers.filter(u => !memberIds.has(u.id))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/organizations/${org.id}/members`)
      const data = await res.json() as Member[]
      setMembers(Array.isArray(data) ? data : [])
    } catch { /* keep empty */ }
    finally { setLoading(false) }
  }, [org.id])

  useEffect(() => { void load() }, [load])

  const addMember = async () => {
    if (!addUserId || adding) return
    setAdding(true); setError(null)
    try {
      const res = await fetch(`/api/organizations/${org.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: addUserId }),
      })
      if (!res.ok) throw new Error('Failed to add member')
      setAddUserId('')
      await load()
      onMembersChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setAdding(false)
    }
  }

  const removeMember = async (userId: string) => {
    if (removing) return
    setRemoving(userId); setError(null)
    try {
      const res = await fetch(`/api/organizations/${org.id}/members/${userId}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? 'Failed')
      }
      await load()
      onMembersChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setRemoving(null)
    }
  }

  const isNovax = org.slug === 'novax'

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 space-y-3">
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading members…
        </div>
      ) : (
        <>
          {/* Members list */}
          {members.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No members yet.</p>
          ) : (
            <div className="space-y-1.5">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ background: m.color || '#1B3D38' }}
                    >
                      {m.initials?.slice(0, 2) ?? '?'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-slate-800">{m.name}</p>
                        {m.is_super_admin && (
                          <span className="flex items-center gap-0.5 text-[9px] font-bold text-novax bg-novax-light px-1.5 py-0.5 rounded-full">
                            <Shield className="w-2.5 h-2.5" /> Super Admin
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">{m.email} · {m.role.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  {!isNovax && !m.is_super_admin && (
                    <button
                      onClick={() => void removeMember(m.id)}
                      disabled={!!removing}
                      className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                      title="Move back to NOVAX"
                    >
                      {removing === m.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <UserMinus className="w-3 h-3" />}
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add member */}
          <div className="flex items-center gap-2">
            <select
              value={addUserId}
              onChange={e => setAddUserId(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-novax-muted"
            >
              <option value="">Add existing user to this org…</option>
              {candidates.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email}) · {u.role.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <button
              onClick={() => void addMember()}
              disabled={!addUserId || adding}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-novax text-white text-xs font-semibold rounded-lg hover:bg-novax-hover disabled:opacity-50 transition-colors"
            >
              {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
              Add
            </button>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </>
      )}
    </div>
  )
}

// ── Main Tab ───────────────────────────────────────────────────

export function OrganizationsTab() {
  const [orgs,         setOrgs]         = useState<Org[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [allUsers,     setAllUsers]     = useState<AllUser[]>([])

  const loadOrgs = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [orgsRes, usersRes] = await Promise.all([
        fetch('/api/organizations'),
        fetch('/api/users'),
      ])
      const orgsData  = await orgsRes.json()  as Org[]  | { error: string }
      const usersData = await usersRes.json() as AllUser[] | { error: string }
      if (!orgsRes.ok)  throw new Error((orgsData as { error: string }).error ?? 'Failed to load orgs')
      setOrgs(Array.isArray(orgsData) ? orgsData : [])
      setAllUsers(Array.isArray(usersData) ? usersData : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadOrgs() }, [loadOrgs])

  const handleCreated = (org: Org) => {
    setOrgs(prev => [...prev, org])
    setShowCreate(false)
  }

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  const refreshCounts = () => {
    void loadOrgs()
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading organizations…
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-6 text-sm text-red-600">
        {error}
        <button onClick={() => void loadOrgs()} className="ml-2 underline text-novax-muted">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-900">{orgs.length} Organization{orgs.length !== 1 ? 's' : ''}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Only visible to super admins. Each org is fully isolated.</p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-novax text-white text-xs font-semibold rounded-lg hover:bg-novax-hover transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Organization
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateOrgForm
          onCreated={handleCreated}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Orgs list */}
      <div className="space-y-2">
        {orgs.map(org => (
          <div key={org.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Org row */}
            <button
              onClick={() => toggleExpand(org.id)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-novax-light border border-novax-border flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-novax-muted" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">{org.name}</p>
                    <span className="text-[10px] font-mono text-slate-400">{org.slug}</span>
                    {org.slug === 'novax' && (
                      <span className="text-[9px] font-bold text-novax bg-novax-light px-1.5 py-0.5 rounded-full">
                        Founding Org
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', PLAN_COLORS[org.plan] ?? 'bg-slate-100 text-slate-600')}>
                      {org.plan}
                    </span>
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', STATUS_COLORS[org.status] ?? 'bg-slate-100 text-slate-500')}>
                      {org.status}
                    </span>
                    <span className="text-[10px] text-slate-400">{org.member_count} member{org.member_count !== 1 ? 's' : ''}</span>
                    <span className="text-[10px] text-slate-400">{org.client_count} client{org.client_count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] text-slate-400">Limits</p>
                  <p className="text-[11px] font-mono text-slate-600">
                    {org.max_clients === 9999 ? '∞' : org.max_clients}c · {org.max_users === 9999 ? '∞' : org.max_users}u · {org.ai_calls_per_month >= 999999 ? '∞' : org.ai_calls_per_month} AI/mo
                  </p>
                </div>
                {expandedId === org.id
                  ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
              </div>
            </button>

            {/* Expanded members panel */}
            {expandedId === org.id && (
              <OrgMembersPanel
                org={org}
                allUsers={allUsers}
                onMembersChanged={refreshCounts}
              />
            )}
          </div>
        ))}
      </div>

      {orgs.length === 0 && (
        <p className="text-sm text-slate-400 py-4 text-center">No organizations yet. Create one above.</p>
      )}
    </div>
  )
}
