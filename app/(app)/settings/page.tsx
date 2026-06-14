'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, X, Key, Bell, Users, Shield, Zap, Plus, RefreshCw, Eye, EyeOff, Check, Clock, RotateCcw, Trash2, AlertCircle, Copy, Building2, Power, Loader2, Activity, MonitorDot, HardDrive, Mail, LogIn, LogOut } from 'lucide-react'
import { useUsers, usePendingInvitations, useCancelInvitation, useResendInvitation, useUpdateUserPermissions, type InviteResult } from '@/lib/hooks/use-users'
import { useAuth } from '@/lib/auth-context'
import { useClients } from '@/lib/hooks/use-clients'
import { useUpdateClient } from '@/lib/hooks/use-clients'
import { useUserAssignments, useSaveClientAssignments } from '@/lib/hooks/use-client-assignments'
import { cn, hasRole, vendorName } from '@/lib/utils'
import { InviteUserModal } from '@/components/settings/invite-user-modal'
import { BulkInviteModal } from '@/components/settings/bulk-invite-modal'
import { BulkPermissionsPanel } from '@/components/settings/bulk-permissions-panel'
import type { UserRole, User } from '@/lib/types'
import { PAGE_DEFS, ALL_PAGE_KEYS, PAGE_GROUPS, type PageKey } from '@/lib/page-permissions'

const INTEGRATIONS_REAL = [
  {
    id: 'metricool', realName: 'Metricool', maskedName: 'Scheduling Platform', status: 'connected',
    description: 'Social media scheduling, analytics, and publishing',
    fields: [{ label: 'API Token', key: 'token', type: 'password', placeholder: 'mc_xxxxxxxxxx' }],
    color: '#ff4f5a',
  },
  {
    id: 'chatwoot', realName: 'Chatwoot', maskedName: 'Messaging Platform', status: 'connected',
    description: 'Comment moderation and DM management via self-hosted Chatwoot',
    fields: [
      { label: 'Base URL', key: 'base_url', type: 'text', placeholder: 'https://chatwoot.yourdomain.com' },
      { label: 'API Token', key: 'api_token', type: 'password', placeholder: 'user access token' },
      { label: 'Account ID', key: 'account_id', type: 'text', placeholder: '2' },
      { label: 'Webhook Secret', key: 'webhook_secret', type: 'password', placeholder: 'novax-chatwoot-2026' },
    ],
    color: '#1f93ff',
  },
  {
    id: 'claude', realName: 'Claude API (Anthropic)', maskedName: 'AI Engine', status: 'connected',
    description: 'Primary AI engine for all agent tasks',
    fields: [
      { label: 'API Key', key: 'api_key', type: 'password', placeholder: 'sk-ant-xxxxxxxxxx' },
      { label: 'Model', key: 'model', type: 'text', placeholder: 'claude-sonnet-4-6' },
    ],
    color: '#d4790a',
  },
]

function IntegrationCard({ integration, showReal }: { integration: typeof INTEGRATIONS_REAL[0]; showReal: boolean }) {
  const [editing, setEditing] = useState(false)
  const connected = integration.status === 'connected'
  const displayName = showReal ? integration.realName : integration.maskedName

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ background: integration.color }}>
            {displayName[0]}
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 text-sm">{displayName}</h4>
            <p className="text-xs text-slate-500">{integration.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn('flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full',
            connected ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
            {connected ? <CheckCircle className="w-2.5 h-2.5"/> : <XCircle className="w-2.5 h-2.5"/>}
            {connected ? 'Connected' : 'Disconnected'}
          </div>
          <button onClick={() => setEditing(!editing)} className="text-[11px] text-novax-muted hover:text-novax font-medium">
            {editing ? 'Done' : 'Configure'}
          </button>
        </div>
      </div>

      {editing && (
        <div className="space-y-3 pt-3 border-t border-slate-100">
          {integration.fields.map(field => (
            <div key={field.key}>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{field.label}</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  defaultValue={field.type === 'password' ? '••••••••••••' : field.placeholder}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all"
                />
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button className="px-3 py-1.5 bg-novax hover:bg-novax-hover text-white text-xs font-medium rounded-lg transition-colors">
              Save Credentials
            </button>
            <button className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
              Test Connection
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricoolClientConfig() {
  const { clients } = useClients()
  const updateClient = useUpdateClient()
  const [localIds, setLocalIds] = useState<Record<string, string>>({})
  const [saving, setSaving]     = useState<string | null>(null)
  const [saved, setSaved]       = useState<string | null>(null)
  const [blogs, setBlogs]       = useState<{ id: string; name: string }[]>([])
  const [blogsLoading, setBlogsLoading] = useState(false)
  const [blogsError, setBlogsError]     = useState<string | null>(null)

  useEffect(() => {
    setBlogsLoading(true)
    fetch('/api/metricool/blogs')
      .then(r => r.json() as Promise<{ blogs?: { id: string; name: string }[]; error?: string }>)
      .then(data => {
        if (data.blogs?.length) setBlogs(data.blogs)
        else setBlogsError(data.error ?? 'No blogs found in this Metricool account')
      })
      .catch(() => setBlogsError('Could not reach Metricool API'))
      .finally(() => setBlogsLoading(false))
  }, [])

  const handleSave = (clientId: string) => {
    const id = localIds[clientId]
    if (!id) return
    setSaving(clientId)
    updateClient.mutate(
      { id: clientId, metricool_blog_id: id } as Parameters<typeof updateClient.mutate>[0],
      {
        onSuccess: () => { setSaved(clientId); setTimeout(() => setSaved(null), 2000) },
        onSettled: () => setSaving(null),
      }
    )
  }

  return (
    <div className="mt-5 pt-5 border-t border-slate-100 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-700">Metricool Workspace per Client</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Each client must map to its own Metricool blog (workspace). Create one workspace per client in Metricool, connect its social profiles, then assign it here.
          </p>
        </div>
        {blogsLoading && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0"/>}
      </div>

      {blogsError && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0"/>
          <p className="text-xs text-amber-700">{blogsError}</p>
        </div>
      )}

      {!blogsLoading && !blogsError && blogs.length === 0 && (
        <p className="text-xs text-slate-400 italic">No workspaces found — check Metricool credentials above.</p>
      )}

      {clients.map(client => {
        const current = localIds[client.id] ?? client.metricool_blog_id ?? ''
        return (
          <div key={client.id} className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: client.color }}>
              {client.initials}
            </div>
            <span className="text-xs font-medium text-slate-700 w-28 truncate">{client.name}</span>

            {blogs.length > 0 ? (
              <select
                value={current}
                onChange={e => setLocalIds(prev => ({ ...prev, [client.id]: e.target.value }))}
                className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-novax-border bg-white"
              >
                <option value="">— select workspace —</option>
                {blogs.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.id})</option>
                ))}
              </select>
            ) : (
              <input
                value={current}
                placeholder="Blog ID (e.g. 6276264)"
                onChange={e => setLocalIds(prev => ({ ...prev, [client.id]: e.target.value }))}
                className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-novax-border"
              />
            )}

            <button
              onClick={() => handleSave(client.id)}
              disabled={saving === client.id || !current}
              className="px-2.5 py-1.5 text-xs text-white rounded-lg disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1"
              style={{ background: '#1B3D38' }}
            >
              {saving === client.id
                ? <RefreshCw className="w-3 h-3 animate-spin"/>
                : saved === client.id
                  ? <Check className="w-3 h-3"/>
                  : null}
              {saved === client.id ? 'Saved' : 'Save'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

const ROLE_CARDS: {
  value: UserRole
  label: string
  description: string
  access: string[]
  restricted: string[]
}[] = [
  {
    value: 'ceo',
    label: 'CEO',
    description: 'Full platform visibility. Sees vendor names. Cannot edit integration credentials.',
    access: ['Dashboard', 'Pipeline', 'Clients', 'Projects', 'Publishing', 'Approval', 'Moderation', 'Assets', 'Reports', 'Workload'],
    restricted: ['Integrations config'],
  },
  {
    value: 'creative_director',
    label: 'Creative Director',
    description: 'Manages the creative team. Full task and client access.',
    access: ['Dashboard', 'Pipeline', 'Tasks', 'Clients', 'Projects', 'Assets', 'Creative Eval', 'Workload', 'Reports'],
    restricted: ['Integrations config', 'Vendor names'],
  },
  {
    value: 'account_manager',
    label: 'Account Manager',
    description: 'Client-facing. Manages approvals, reporting, and client comms.',
    access: ['Dashboard', 'Pipeline', 'Clients (edit)', 'Projects', 'Approval', 'Publishing', 'Reports'],
    restricted: ['Integrations config', 'Vendor names', 'Workload view'],
  },
  {
    value: 'strategist',
    label: 'Strategist',
    description: 'Creates and manages strategy-stage tasks and projects.',
    access: ['Dashboard', 'Pipeline', 'Tasks', 'Clients (read)', 'Projects', 'Content Library'],
    restricted: ['Integrations config', 'Vendor names', 'Publishing', 'Moderation'],
  },
  {
    value: 'copywriter',
    label: 'Copywriter',
    description: 'Assigned copy tasks. Uses AI agents. Limited to own tasks.',
    access: ['Pipeline (own tasks)', 'Tasks', 'Assets', 'Content Library', 'Creative Eval'],
    restricted: ['Integrations config', 'Clients (edit)', 'Reports', 'Workload'],
  },
  {
    value: 'designer',
    label: 'Designer',
    description: 'Assigned design tasks. Access to assets and creative tools.',
    access: ['Pipeline (own tasks)', 'Tasks', 'Assets', 'AI Image', 'Smart Resize', 'Creative Eval'],
    restricted: ['Integrations config', 'Clients (edit)', 'Reports', 'Publishing'],
  },
  {
    value: 'social_manager',
    label: 'Social Manager',
    description: 'Manages publishing schedule and comment moderation.',
    access: ['Dashboard', 'Publishing', 'Approval', 'Moderation', 'Content Library', 'Performance'],
    restricted: ['Integrations config', 'Vendor names', 'Clients (edit)', 'Pipeline'],
  },
]

function RolePreviewTab() {
  const { previewRole, setPreviewRole, isPreviewMode } = useAuth()

  const activate = (role: UserRole) => {
    if (previewRole === role) {
      setPreviewRole(null)
    } else {
      setPreviewRole(role)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-slate-900">Role Preview</h3>
        <p className="text-sm text-slate-500 mt-0.5">
          Switch the platform to any role to see exactly what that user sees. Your admin session is preserved — exit at any time.
        </p>
      </div>

      {isPreviewMode && (
        <div className="flex items-center justify-between p-4 rounded-xl border-2 border-novax-border bg-novax-light">
          <div className="flex items-center gap-2.5">
            <Eye className="w-4 h-4 text-novax-muted"/>
            <div>
              <p className="text-sm font-semibold text-novax">
                Previewing as {ROLE_CARDS.find(r => r.value === previewRole)?.label ?? previewRole}
              </p>
              <p className="text-xs text-novax-muted">Navigate any page to see the role-restricted view</p>
            </div>
          </div>
          <button
            onClick={() => setPreviewRole(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-novax border border-novax-border rounded-lg hover:bg-novax-light-hover transition-colors"
          >
            <EyeOff className="w-3.5 h-3.5"/> Exit Preview
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ROLE_CARDS.map(role => {
          const active = previewRole === role.value
          return (
            <button
              key={role.value}
              onClick={() => activate(role.value)}
              className={cn(
                'text-left p-4 rounded-xl border-2 transition-all hover:shadow-sm',
                active
                  ? 'border-novax bg-novax-light'
                  : 'border-slate-200 bg-white hover:border-novax-border'
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className={cn('text-sm font-semibold', active ? 'text-novax' : 'text-slate-900')}>
                    {role.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{role.description}</p>
                </div>
                {active && (
                  <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ background: '#1B3D38' }}>
                    <Check className="w-3 h-3"/>
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Has access</p>
                <div className="flex flex-wrap gap-1">
                  {role.access.map(item => (
                    <span key={item} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">{item}</span>
                  ))}
                </div>
                {role.restricted.length > 0 && <>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400 mt-1">Restricted</p>
                  <div className="flex flex-wrap gap-1">
                    {role.restricted.map(item => (
                      <span key={item} className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">{item}</span>
                    ))}
                  </div>
                </>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Edit Permissions Modal (Pages + Client Access) ─────────────────────────

const BYPASS_ASSIGNMENT_ROLES: UserRole[] = ['admin', 'ceo', 'creative_director']

function EditPermissionsModal({ user, onClose }: { user: User; onClose: () => void }) {
  const updatePermissions = useUpdateUserPermissions()
  const saveAssignments = useSaveClientAssignments()
  const { clients } = useClients()
  const { clientIds: existingAssignments, isLoading: assignmentsLoading } = useUserAssignments(user.id)

  const initial = user.page_permissions ?? ALL_PAGE_KEYS
  const [activeTab, setActiveTab] = useState<'pages' | 'clients'>('pages')
  const [pages, setPages] = useState<PageKey[]>(initial as PageKey[])
  const [assignedClients, setAssignedClients] = useState<string[]>([])
  const [allClientsAccess, setAllClientsAccess] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Populate client assignments once loaded
  useEffect(() => {
    if (!assignmentsLoading) {
      if (existingAssignments.length === 0) {
        setAllClientsAccess(true)
        setAssignedClients([])
      } else {
        setAllClientsAccess(false)
        setAssignedClients(existingAssignments)
      }
    }
  }, [assignmentsLoading, existingAssignments])

  const isBypassRole = BYPASS_ASSIGNMENT_ROLES.includes(user.role)
  const allPagesSelected = pages.length === ALL_PAGE_KEYS.length

  const togglePage = (key: PageKey) =>
    setPages(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])

  const toggleClient = (id: string) =>
    setAssignedClients(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])

  const save = async () => {
    setSaving(true)
    try {
      // Save page permissions
      const page_permissions: string[] | null = allPagesSelected ? null : pages
      await updatePermissions.mutateAsync({ userId: user.id, page_permissions })

      // Save client assignments (only for non-bypass roles)
      if (!isBypassRole) {
        const finalClientIds = allClientsAccess ? [] : assignedClients
        await saveAssignments.mutateAsync({ userId: user.id, clientIds: finalClientIds })
      }

      setSaved(true)
      setTimeout(onClose, 800)
    } catch { /* errors surfaced by mutations */ }
    setSaving(false)
  }

  const tabs = [
    { id: 'pages' as const,   label: 'Page Access',    icon: Shield },
    { id: 'clients' as const, label: 'Client Access',  icon: Building2 },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: user.color }}>
              {user.initials}
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">{user.name}</p>
              <p className="text-[11px] text-slate-500 capitalize">{user.role.replace(/_/g, ' ')} · {user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <XCircle className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                activeTab === id ? 'bg-novax-light text-novax' : 'text-slate-500 hover:bg-slate-100'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* ── Page Access tab ── */}
          {activeTab === 'pages' && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Page Access</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Dashboard, Pipeline, Tasks and Settings are always visible.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPages([...ALL_PAGE_KEYS])} className="text-[11px] font-semibold text-novax-muted hover:text-novax">
                    Grant all
                  </button>
                  <span className="text-slate-300">·</span>
                  <button onClick={() => setPages([])} className="text-[11px] font-semibold text-slate-400 hover:text-red-500">
                    Revoke all
                  </button>
                </div>
              </div>

              {PAGE_GROUPS.map(group => (
                <div key={group}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {PAGE_DEFS.filter(p => p.group === group).map(({ key, label }) => {
                      const checked = pages.includes(key)
                      return (
                        <button
                          key={key}
                          onClick={() => togglePage(key)}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                            checked
                              ? 'bg-novax-light border-novax-border text-novax'
                              : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600',
                          )}
                        >
                          <span className={cn('w-3 h-3 rounded flex items-center justify-center border shrink-0', checked ? 'bg-novax border-novax' : 'border-slate-300')}>
                            {checked && (
                              <svg viewBox="0 0 10 8" className="w-2 h-2" fill="none">
                                <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </span>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              <div className="pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                {allPagesSelected
                  ? 'Full access — all optional pages enabled'
                  : pages.length === 0
                    ? 'Restricted — only required pages visible'
                    : `${pages.length} of ${ALL_PAGE_KEYS.length} optional pages enabled`}
              </div>
            </>
          )}

          {/* ── Client Access tab ── */}
          {activeTab === 'clients' && (
            <>
              {isBypassRole ? (
                <div className="flex items-center gap-3 p-4 bg-novax-light rounded-xl border border-novax-border">
                  <Building2 className="w-4 h-4 text-novax shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-novax">Always sees all clients</p>
                    <p className="text-xs text-novax-muted mt-0.5">
                      {user.role.replace(/_/g, ' ')} role bypasses client restrictions.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Client Access</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Choose which clients this user can see. Affects tasks, publishing, moderation, and notifications.
                    </p>
                  </div>

                  {/* All clients toggle */}
                  <button
                    onClick={() => { setAllClientsAccess(true); setAssignedClients([]) }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all',
                      allClientsAccess ? 'border-novax bg-novax-light' : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <span className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0', allClientsAccess ? 'border-novax bg-novax' : 'border-slate-300')}>
                      {allClientsAccess && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <div>
                      <p className={cn('text-sm font-medium', allClientsAccess ? 'text-novax' : 'text-slate-700')}>All clients</p>
                      <p className="text-[11px] text-slate-500">No restrictions — user sees every client</p>
                    </div>
                  </button>

                  {/* Specific clients toggle */}
                  <button
                    onClick={() => setAllClientsAccess(false)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all',
                      !allClientsAccess ? 'border-novax bg-novax-light' : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <span className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0', !allClientsAccess ? 'border-novax bg-novax' : 'border-slate-300')}>
                      {!allClientsAccess && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <div>
                      <p className={cn('text-sm font-medium', !allClientsAccess ? 'text-novax' : 'text-slate-700')}>Specific clients only</p>
                      <p className="text-[11px] text-slate-500">Restrict to selected clients below</p>
                    </div>
                  </button>

                  {!allClientsAccess && (
                    <div className="space-y-1.5 pl-1">
                      {assignmentsLoading ? (
                        <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Loading…
                        </div>
                      ) : clients.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No clients found.</p>
                      ) : clients.map(client => {
                        const checked = assignedClients.includes(client.id)
                        return (
                          <button
                            key={client.id}
                            onClick={() => toggleClient(client.id)}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left',
                              checked ? 'border-novax-border bg-novax-light' : 'border-slate-200 hover:border-slate-300 bg-white'
                            )}
                          >
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: client.color }}>
                              {client.initials}
                            </div>
                            <span className={cn('flex-1 text-sm font-medium', checked ? 'text-novax' : 'text-slate-700')}>
                              {client.name}
                            </span>
                            <span className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0', checked ? 'border-novax bg-novax' : 'border-slate-300')}>
                              {checked && (
                                <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none">
                                  <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </span>
                          </button>
                        )
                      })}
                      <p className="text-[11px] text-slate-400 pt-1">
                        {assignedClients.length === 0
                          ? 'No clients selected — user will see nothing'
                          : `${assignedClients.length} client${assignedClients.length !== 1 ? 's' : ''} selected`}
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {(updatePermissions.isError || saveAssignments.isError) && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-600">
                {((updatePermissions.error ?? saveAssignments.error) as Error)?.message ?? 'Update failed'}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || saved}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors',
                saved ? 'bg-emerald-500 text-white' : 'bg-novax hover:bg-novax-hover disabled:opacity-50 text-white',
              )}
            >
              {saved ? <><Check className="w-3.5 h-3.5"/> Saved</> : saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function GoogleDriveCard() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    void fetch('/api/drive/files?folderId=root')
      .then(r => r.json() as Promise<{ error?: string; email?: string | null }>)
      .then(data => {
        if (data.error === 'not_connected') { setConnected(false); return }
        setConnected(true)
        if (data.email) setEmail(data.email)
      })
      .catch(() => setConnected(false))
  }, [])

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await fetch('/api/drive/disconnect', { method: 'POST' })
      setConnected(false)
      setEmail(null)
    } catch { /* ignore */ } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#4285F4' }}>
            <HardDrive className="w-5 h-5 text-white"/>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 text-sm">Google Drive</h4>
            <p className="text-xs text-slate-500">Team-wide file browser — connect once, everyone gets access</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {connected === null && <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400"/>}
          {connected !== null && (
            <div className={cn(
              'flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full',
              connected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500',
            )}>
              {connected ? <CheckCircle className="w-2.5 h-2.5"/> : <XCircle className="w-2.5 h-2.5"/>}
              {connected ? 'Connected' : 'Not connected'}
            </div>
          )}
        </div>
      </div>

      {connected === false && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <a
            href="/api/drive/auth"
            className="inline-flex items-center gap-2 px-4 py-2 bg-novax hover:bg-novax-hover text-white text-xs font-medium rounded-lg transition-colors"
          >
            <LogIn className="w-3.5 h-3.5"/>
            Connect Google Drive
          </a>
          <p className="text-[11px] text-slate-400 mt-2">You will be redirected to Google to authorise access.</p>
        </div>
      )}

      {connected === true && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Mail className="w-3.5 h-3.5 text-slate-400"/>
            {email ?? 'Connected'}
          </div>
          <button
            onClick={() => void handleDisconnect()}
            disabled={disconnecting}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {disconnecting ? <RefreshCw className="w-3 h-3 animate-spin"/> : <LogOut className="w-3 h-3"/>}
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { user: currentUser } = useAuth()
  const { users } = useUsers()
  const { invitations, isLoading: invLoading, refetch: refetchInvitations } = usePendingInvitations()
  const cancelInvitation  = useCancelInvitation()
  const resendInvitation  = useResendInvitation()
  const [resendResult, setResendResult] = useState<(InviteResult & { forId: string }) | null>(null)
  const [copiedResend, setCopiedResend] = useState<'email' | 'password' | null>(null)
  const isAdmin = currentUser?.role === 'admin'
  const canSeeVendorNames = hasRole(currentUser, ['admin', 'ceo'])
  const canManageKillSwitch = currentUser?.role === 'admin' || currentUser?.role === 'ceo'
  const [activeTab, setActiveTab] = useState<'integrations' | 'team' | 'notifications' | 'security' | 'preview' | 'activity'>(isAdmin ? 'integrations' : 'team')
  const [showInvite, setShowInvite] = useState(false)
  const [showBulkInvite, setShowBulkInvite] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [showBulkPerms, setShowBulkPerms] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null)
  const [aiToggling, setAiToggling] = useState(false)

  // Activity tab state
  type ActivityUser = {
    id: string; name: string; email: string; role: string; avatar_url: string | null
    last_seen: string | null; current_page: string | null
    api_calls_this_month: number
    today_ai_calls: number; today_ai_cost_usd: number; today_ai_cached: number
    month_ai_calls: number; month_ai_cost_usd: number
    today_studio_sessions: number; today_docs_created: number
    today_ai_agents: Record<string, number>
  }
  type ActivityTotals = {
    today_ai_calls: number; today_ai_cost_usd: number
    month_ai_calls: number; month_ai_cost_usd: number
    online_now: number
  }
  type AgentBreakdownItem = { agent: string; count: number }
  const [activityUsers, setActivityUsers]         = useState<ActivityUser[]>([])
  const [activityTotals, setActivityTotals]       = useState<ActivityTotals | null>(null)
  const [agentBreakdown, setAgentBreakdown]       = useState<AgentBreakdownItem[]>([])
  const [activityLoading, setActivityLoading]     = useState(false)

  const fetchActivity = useCallback(async () => {
    if (!canManageKillSwitch) return
    setActivityLoading(true)
    try {
      const res  = await fetch('/api/user/activity')
      const data = await res.json() as {
        users?: ActivityUser[]
        totals?: ActivityTotals
        agent_breakdown?: AgentBreakdownItem[]
      }
      setActivityUsers(data.users ?? [])
      setActivityTotals(data.totals ?? null)
      setAgentBreakdown(data.agent_breakdown ?? [])
    } catch { /* non-critical */ }
    finally { setActivityLoading(false) }
  }, [canManageKillSwitch])

  useEffect(() => {
    if (activeTab !== 'activity') return
    void fetchActivity()
    const iv = setInterval(() => { void fetchActivity() }, 30_000)
    return () => clearInterval(iv)
  }, [activeTab, fetchActivity])

  useEffect(() => {
    if (activeTab !== 'security' || !canManageKillSwitch) return
    void fetch('/api/system/settings')
      .then(r => r.json() as Promise<{ settings: Record<string, unknown> }>)
      .then(data => {
        const val = data.settings?.ai_enabled
        setAiEnabled(val !== false && val !== 'false')
      })
      .catch(() => setAiEnabled(true))
  }, [activeTab, canManageKillSwitch])

  const toggleAiEnabled = async () => {
    if (aiEnabled === null || aiToggling) return
    setAiToggling(true)
    const next = !aiEnabled
    try {
      await fetch('/api/system/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'ai_enabled', value: next, updated_by: currentUser?.id }),
      })
      setAiEnabled(next)
    } catch { /* keep current state */ }
    finally { setAiToggling(false) }
  }

  const tabs = [
    ...(isAdmin ? [{ id: 'integrations' as const, label: 'Integrations', icon: Zap }] : []),
    { id: 'team' as const, label: 'Team', icon: Users },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'security' as const, label: 'Security', icon: Shield },
    ...(canManageKillSwitch ? [{ id: 'activity' as const, label: 'Activity', icon: Activity }] : []),
    ...(isAdmin ? [{ id: 'preview' as const, label: 'Role Preview', icon: Eye }] : []),
  ]

  return (
    <div className="max-w-4xl space-y-5">
      {showInvite && <InviteUserModal onClose={() => setShowInvite(false)} />}
      {showBulkInvite && <BulkInviteModal onClose={() => setShowBulkInvite(false)} />}
      {showBulkPerms && (
        <BulkPermissionsPanel
          selectedUsers={users.filter(u => selectedUserIds.has(u.id))}
          onClose={() => setShowBulkPerms(false)}
          onApplied={() => { setSelectedUserIds(new Set()); setShowBulkPerms(false) }}
        />
      )}
      {editingUser && (
        <EditPermissionsModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
        />
      )}
      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap shrink-0',
              activeTab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Icon className="w-3.5 h-3.5"/>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'integrations' && (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-slate-900">Platform Integrations</h3>
            <p className="text-sm text-slate-500">Connect external platforms. All credentials are stored encrypted at rest.</p>
          </div>
          <div className="space-y-3">
            {INTEGRATIONS_REAL.map(i => <IntegrationCard key={i.id} integration={i} showReal={canSeeVendorNames} />)}
          </div>
          {isAdmin && <MetricoolClientConfig/>}
          {isAdmin && <GoogleDriveCard/>}

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm font-semibold text-amber-800">Webhook endpoints</p>
            <p className="text-xs text-amber-700 mt-1">Configure these URLs in your Chatwoot and Metricool dashboards:</p>
            <div className="space-y-1 mt-2">
              {[
                { label: 'Moderation Webhook', url: '/api/webhooks/chatwoot' },
                { label: 'Metricool Publish', url: '/api/webhooks/metricool' },
              ].map(({ label, url }) => (
                <div key={url} className="flex items-center gap-2">
                  <span className="text-[11px] text-amber-700 w-36">{label}:</span>
                  <code className="text-[11px] bg-white px-2 py-0.5 rounded border border-amber-200 text-amber-900 font-mono">{url}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-6">
          {/* Active members */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">Team Members</h3>
                <p className="text-sm text-slate-500">{users.length} active member{users.length !== 1 ? 's' : ''} · Role-based access control</p>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <button onClick={() => setShowBulkInvite(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors">
                    <Plus className="w-3.5 h-3.5" />Bulk Invite
                  </button>
                  <button onClick={() => setShowInvite(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors">
                    <Plus className="w-3.5 h-3.5" />Invite Member
                  </button>
                </div>
              )}
            </div>
            {/* Bulk action bar */}
            {isAdmin && selectedUserIds.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 bg-novax-light border border-novax-border rounded-xl">
                <Users className="w-4 h-4 text-novax shrink-0" />
                <span className="text-sm font-medium text-novax flex-1">
                  {selectedUserIds.size} member{selectedUserIds.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => setShowBulkPerms(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-novax hover:bg-novax-hover text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <Shield className="w-3.5 h-3.5" />
                  Set Page Access
                </button>
                <button
                  onClick={() => setSelectedUserIds(new Set())}
                  className="p-1 text-novax-muted hover:text-novax transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {isAdmin && (
                      <th className="pl-4 pr-2 py-3 w-8">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-novax focus:ring-novax"
                          checked={selectedUserIds.size > 0 && users.filter(u => u.id !== currentUser?.id).every(u => selectedUserIds.has(u.id))}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedUserIds(new Set(users.filter(u => u.id !== currentUser?.id).map(u => u.id)))
                            } else {
                              setSelectedUserIds(new Set())
                            }
                          }}
                        />
                      </th>
                    )}
                    {['Member', 'Role', 'Department', 'Page Access', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => {
                    const perms = u.page_permissions
                    const isRestricted = perms != null
                    const permLabel = !isRestricted
                      ? 'All pages'
                      : perms.length === 0
                        ? 'Required only'
                        : `${perms.length} of ${ALL_PAGE_KEYS.length} pages`
                    const isSelectable = isAdmin && u.id !== currentUser?.id
                    const isChecked = selectedUserIds.has(u.id)
                    return (
                    <tr
                      key={u.id}
                      className={cn('hover:bg-slate-50 transition-colors', isChecked && 'bg-novax-light/40')}
                    >
                      {isAdmin && (
                        <td className="pl-4 pr-2 py-3 w-8">
                          {isSelectable && (
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-novax focus:ring-novax"
                              checked={isChecked}
                              onChange={e => {
                                setSelectedUserIds(prev => {
                                  const next = new Set(prev)
                                  if (e.target.checked) next.add(u.id)
                                  else next.delete(u.id)
                                  return next
                                })
                              }}
                            />
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: u.color }}>
                            {u.initials}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{u.name}</p>
                            <p className="text-[11px] text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 capitalize">{u.role.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 capitalize">{u.department}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                          !isRestricted ? 'bg-novax-light text-novax' : 'bg-amber-50 text-amber-700',
                        )}>
                          {permLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin && u.id !== currentUser?.id && (
                          <button
                            onClick={() => setEditingUser(u)}
                            className="text-xs text-slate-400 hover:text-novax font-medium transition-colors"
                          >
                            Edit access
                          </button>
                        )}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending invitations */}
          {isAdmin && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    Pending Invitations
                    {invitations.length > 0 && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                        {invitations.length}
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-slate-500">Accounts that have not yet completed first login</p>
                </div>
                <button
                  onClick={() => refetchInvitations()}
                  disabled={invLoading}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className={cn('w-3 h-3', invLoading && 'animate-spin')} />
                  Refresh
                </button>
              </div>

              {/* Resend fallback credentials panel */}
              {resendResult && !resendResult.emailSent && resendResult.fallbackCredentials && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Email failed — share credentials manually</p>
                      <p className="text-xs text-amber-700 mt-0.5">{resendResult.emailError}</p>
                    </div>
                    <button onClick={() => setResendResult(null)} className="ml-auto text-amber-400 hover:text-amber-600">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {([
                      { label: 'Email',    value: resendResult.fallbackCredentials.email,        field: 'email' as const },
                      { label: 'Password', value: resendResult.fallbackCredentials.tempPassword,  field: 'password' as const },
                    ] as const).map(({ label, value, field }) => (
                      <div key={field} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-amber-200">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">{label}</p>
                          <p className="text-sm font-mono text-slate-900">{value}</p>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(value).catch(() => {})
                            setCopiedResend(field)
                            setTimeout(() => setCopiedResend(null), 2000)
                          }}
                          className="shrink-0 p-1 text-slate-400 hover:text-novax transition-colors"
                        >
                          {copiedResend === field ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {invLoading ? (
                <div className="flex items-center gap-2 px-4 py-6 bg-white rounded-xl border border-slate-200 text-sm text-slate-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Loading…
                </div>
              ) : invitations.length === 0 ? (
                <div className="flex items-center gap-3 px-4 py-5 bg-white rounded-xl border border-dashed border-slate-200">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <p className="text-sm text-slate-400">No pending invitations</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        {['Invited Member', 'Role', 'Sent', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invitations.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-900">{inv.name || '—'}</p>
                                <p className="text-[11px] text-slate-400">{inv.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-slate-600 capitalize">{inv.role.replace(/_/g, ' ')}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {new Date(inv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={async () => {
                                  setResendResult(null)
                                  const res = await resendInvitation.mutateAsync({
                                    id: inv.id,
                                    inviterName: currentUser?.name,
                                  })
                                  if (!res.emailSent) setResendResult({ ...res, forId: inv.id })
                                }}
                                disabled={resendInvitation.isPending}
                                title="Resend credentials"
                                className="flex items-center gap-1 px-2.5 py-1 text-xs text-novax-muted border border-novax-border rounded-lg hover:bg-novax-light transition-colors disabled:opacity-50"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Resend
                              </button>
                              <button
                                onClick={() => cancelInvitation.mutate(inv.id)}
                                disabled={cancelInvitation.isPending}
                                title="Cancel invitation"
                                className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-400 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3" />
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900">Notification Preferences</h3>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {[
              { label: 'Task due today',              desc: 'Remind me when tasks are due', on: true },
              { label: 'Approval required',           desc: 'When a task reaches Approval stage', on: true },
              { label: 'New moderation item',         desc: `Comment or DM received via ${vendorName(currentUser?.role, 'Respond.io')}`, on: true },
              { label: 'Post published',              desc: `When ${vendorName(currentUser?.role, 'Metricool')} confirms a post is live`, on: true },
              { label: 'AI cost threshold',           desc: 'Alert when monthly AI spend exceeds $100', on: false },
              { label: 'Weekly performance digest',   desc: 'Summary of top posts and metrics', on: true },
            ].map(({ label, desc, on }) => (
              <div key={label} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
                <button className={cn('relative w-9 h-5 rounded-full transition-colors', on ? 'bg-novax' : 'bg-slate-200')}>
                  <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', on ? 'left-4' : 'left-0.5')}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900">Security & Permissions</h3>
          <div className="space-y-3">
            {[
              { label: 'Row-Level Security', status: 'Active',    desc: 'Data access enforced per user role on all tables', ok: true },
              { label: 'Credential Vault',  status: 'Encrypted', desc: 'API keys stored encrypted (AES-256)', ok: true },
              { label: 'Rate Limiting',   status: 'Active',    desc: '10 AI requests per user per minute', ok: true },
              { label: 'Audit Logging',   status: 'Active',    desc: 'All task changes, AI usage, and file access logged', ok: true },
              { label: '2FA',             status: 'Optional',  desc: 'Two-factor authentication for team members', ok: false },
            ].map(({ label, status, desc, ok }) => (
              <div key={label} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200">
                <div className={cn('p-2 rounded-lg', ok ? 'bg-emerald-50' : 'bg-amber-50')}>
                  {ok ? <CheckCircle className="w-4 h-4 text-emerald-600"/> : <Shield className="w-4 h-4 text-amber-500"/>}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{label}</p>
                    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                      ok ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600')}>
                      {status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Security Audit Plan — admin/CEO only */}
          {canManageKillSwitch && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3 mt-6">Security Audit Checklist</h4>
              <div className="space-y-2">
                {[
                  {
                    area:   'Row-Level Security (RLS)',
                    status: 'verified',
                    detail: 'All Supabase tables have RLS enabled. Policies enforced per role. Admin client (`createAdminClient`) used only in server-side API routes — never exposed to browser.',
                  },
                  {
                    area:   'SQL Injection',
                    status: 'verified',
                    detail: 'All DB access via Supabase client SDK (parameterised queries). No raw `rpc()` or string-interpolated SQL anywhere in the codebase.',
                  },
                  {
                    area:   'IDOR — Insecure Direct Object References',
                    status: 'review',
                    detail: 'Document, task, and asset IDs are exposed in URLs. All API routes must verify ownership or RLS before returning data. Audit `/api/docs/[id]`, `/api/studio/content/[id]` routes.',
                  },
                  {
                    area:   'File Upload Security',
                    status: 'review',
                    detail: 'Asset uploads go to Supabase Storage. File type validated client-side only — add server-side MIME check. Max 500MB enforced by bucket policy. No executable files accepted.',
                  },
                  {
                    area:   'AI Rate Limiting',
                    status: 'verified',
                    detail: '10 requests/user/minute enforced in API middleware. Kill switch blocks all generation routes instantly when toggled.',
                  },
                  {
                    area:   'API Key Exposure',
                    status: 'verified',
                    detail: 'All keys in `.env.local` / Vercel env vars. No keys in client bundles. `NEXT_PUBLIC_` prefix only used for Supabase URL and anon key (safe by design).',
                  },
                  {
                    area:   'XSS — Cross-Site Scripting',
                    status: 'verified',
                    detail: 'React escapes JSX by default. `react-markdown` used with `remark-gfm` — no `dangerouslySetInnerHTML` in production paths. Tiptap editor sanitises HTML.',
                  },
                  {
                    area:   'Auth Token Handling',
                    status: 'verified',
                    detail: 'Supabase handles all token lifecycle via `@supabase/ssr`. `middleware.ts` refreshes sessions on every request. No custom JWT implementation.',
                  },
                ].map(({ area, status, detail }) => (
                  <div key={area} className="flex items-start gap-3 p-3.5 bg-white rounded-xl border border-slate-200">
                    <div className={cn('mt-0.5 p-1.5 rounded-lg shrink-0', status === 'verified' ? 'bg-emerald-50' : 'bg-amber-50')}>
                      {status === 'verified'
                        ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600"/>
                        : <AlertCircle className="w-3.5 h-3.5 text-amber-500"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-semibold text-slate-900">{area}</p>
                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                          status === 'verified' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                          {status === 'verified' ? 'Verified' : 'Needs Review'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Kill Switch — admin/CEO only */}
          {canManageKillSwitch && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2 mt-6">AI Generation Control</h4>
              <div className={cn('flex items-center gap-4 p-4 rounded-xl border', aiEnabled === false ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200')}>
                <div className={cn('p-2 rounded-lg shrink-0', aiEnabled === false ? 'bg-red-100' : 'bg-emerald-50')}>
                  <Power className={cn('w-4 h-4', aiEnabled === false ? 'text-red-600' : 'text-emerald-600')}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">AI Generation</p>
                    {aiEnabled === null ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400"/>
                    ) : (
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', aiEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
                        {aiEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {aiEnabled === false
                      ? 'All AI generation routes are currently blocked. Team members will see a 503 error if they attempt to generate.'
                      : 'All AI generation is active. Disable to immediately block all generation routes for the whole team.'}
                  </p>
                </div>
                <button
                  onClick={() => void toggleAiEnabled()}
                  disabled={aiEnabled === null || aiToggling}
                  className={cn(
                    'shrink-0 px-4 py-2 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50',
                    aiEnabled === false
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                      : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200',
                  )}
                >
                  {aiToggling ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : aiEnabled === false ? 'Enable AI' : 'Disable AI'}
                </button>
              </div>
              {aiEnabled === false && (
                <p className="text-[11px] text-red-600 font-medium mt-1.5 px-1">
                  AI is currently OFF. All studio tools, assistant, and task AI agents are blocked for all users.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">User Activity</h3>
            <button
              onClick={() => { void fetchActivity() }}
              disabled={activityLoading}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-novax transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', activityLoading && 'animate-spin')}/>
              Refresh
            </button>
          </div>

          {/* Agency-wide totals */}
          {activityTotals && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Online Now',       value: String(activityTotals.online_now),                           sub: 'active in last 5 min' },
                { label: 'AI Calls Today',   value: String(activityTotals.today_ai_calls),                       sub: `$${activityTotals.today_ai_cost_usd.toFixed(4)} cost` },
                { label: 'AI Calls (Month)', value: String(activityTotals.month_ai_calls),                       sub: `$${activityTotals.month_ai_cost_usd.toFixed(2)} cost` },
                { label: 'Month AI Cost',    value: `$${activityTotals.month_ai_cost_usd.toFixed(2)}`,           sub: `${activityTotals.month_ai_calls} total calls` },
              ].map(card => (
                <div key={card.label} className="bg-white border border-slate-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{card.label}</p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">{card.value}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{card.sub}</p>
                </div>
              ))}
            </div>
          )}

          {activityLoading && activityUsers.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400"/>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">User</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Current Page</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Last Seen</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Today Calls</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Today Cost</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Month Calls</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Month Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activityUsers.map(u => {
                    const nowMs     = Date.now()
                    const lastMs    = u.last_seen ? new Date(u.last_seen).getTime() : null
                    const diffMin   = lastMs ? (nowMs - lastMs) / 60_000 : null
                    const status    = diffMin === null ? 'offline' : diffMin < 5 ? 'online' : diffMin < 30 ? 'idle' : 'offline'
                    const lastLabel = lastMs
                      ? diffMin! < 1    ? 'Just now'
                      : diffMin! < 60   ? `${Math.round(diffMin!)}m ago`
                      : diffMin! < 1440 ? `${Math.round(diffMin! / 60)}h ago`
                      : new Date(lastMs).toLocaleDateString()
                      : 'Never'
                    const page = u.current_page ?? '—'
                    return (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-novax-light flex items-center justify-center shrink-0">
                              <span className="text-[11px] font-bold text-novax">{(u.name || u.email)[0]?.toUpperCase()}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 truncate">{u.name || u.email}</p>
                              <p className="text-[10px] text-slate-400 truncate capitalize">{u.role.replace(/_/g, ' ')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full',
                            status === 'online'  && 'bg-emerald-50 text-emerald-700',
                            status === 'idle'    && 'bg-amber-50 text-amber-700',
                            status === 'offline' && 'bg-slate-100 text-slate-500',
                          )}>
                            <span className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              status === 'online'  && 'bg-emerald-500',
                              status === 'idle'    && 'bg-amber-400',
                              status === 'offline' && 'bg-slate-400',
                            )}/>
                            {status === 'online' ? 'Online' : status === 'idle' ? 'Idle' : 'Offline'}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs text-slate-500 font-mono truncate max-w-[160px] block">{page}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-slate-500">{lastLabel}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn('text-xs font-semibold tabular-nums', u.today_ai_calls > 0 ? 'text-novax-muted' : 'text-slate-300')}>
                            {u.today_ai_calls}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn('text-xs font-semibold tabular-nums', u.today_ai_cost_usd > 0 ? 'text-amber-600' : 'text-slate-300')}>
                            {u.today_ai_cost_usd > 0 ? `$${u.today_ai_cost_usd.toFixed(4)}` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn('text-xs font-semibold tabular-nums', u.month_ai_calls > 0 ? 'text-novax-muted' : 'text-slate-300')}>
                            {u.month_ai_calls}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn('text-xs font-semibold tabular-nums', u.month_ai_cost_usd > 0 ? 'text-amber-600' : 'text-slate-300')}>
                            {u.month_ai_cost_usd > 0 ? `$${u.month_ai_cost_usd.toFixed(4)}` : '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {activityUsers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                        No user data yet — run `031_user_activity.sql` migration in Supabase.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Agent breakdown footer */}
              {agentBreakdown.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Top AI Agents Today</p>
                  <div className="flex flex-wrap gap-2">
                    {agentBreakdown.slice(0, 8).map(({ agent, count }) => (
                      <span key={agent} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-full text-[10px] font-medium text-slate-600">
                        <span className="font-mono text-novax-muted">{count}×</span>
                        {agent.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center gap-1.5 text-[11px] text-slate-400">
                <MonitorDot className="w-3 h-3"/>
                Auto-refreshes every 30 seconds · Online = active in last 5 min · Idle = last 30 min · Costs pulled from api_usage table
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'preview' && <RolePreviewTab />}
    </div>
  )
}
