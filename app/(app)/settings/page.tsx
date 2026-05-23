'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Key, Bell, Users, Shield, Zap, Plus, RefreshCw, Eye, EyeOff, Check, Clock, RotateCcw, Trash2, AlertCircle, Copy } from 'lucide-react'
import { useUsers, usePendingInvitations, useCancelInvitation, useResendInvitation, type InviteResult } from '@/lib/hooks/use-users'
import { useAuth } from '@/lib/auth-context'
import { useClients } from '@/lib/hooks/use-clients'
import { useUpdateClient } from '@/lib/hooks/use-clients'
import { cn, hasRole, vendorName } from '@/lib/utils'
import { InviteUserModal } from '@/components/settings/invite-user-modal'
import type { UserRole } from '@/lib/types'

const INTEGRATIONS_REAL = [
  {
    id: 'metricool', realName: 'Metricool', maskedName: 'Scheduling Platform', status: 'connected',
    description: 'Social media scheduling, analytics, and publishing',
    fields: [{ label: 'API Token', key: 'token', type: 'password', placeholder: 'mc_xxxxxxxxxx' }],
    color: '#ff4f5a',
  },
  {
    id: 'respond_io', realName: 'Respond.io', maskedName: 'Messaging Platform', status: 'connected',
    description: 'Comment moderation and DM management via webhooks',
    fields: [
      { label: 'API Key', key: 'api_key', type: 'password', placeholder: 'rio_xxxxxxxxxx' },
      { label: 'Webhook Secret', key: 'webhook_secret', type: 'password', placeholder: 'whsec_xxxxxxxxxx' },
    ],
    color: '#5865f2',
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
  const [saving, setSaving] = useState<string | null>(null)

  const handleSave = async (clientId: string) => {
    setSaving(clientId)
    updateClient.mutate({ id: clientId, metricool_blog_id: localIds[clientId] } as Parameters<typeof updateClient.mutate>[0], {
      onSettled: () => setSaving(null),
    })
  }

  return (
    <div className="mt-5 pt-5 border-t border-slate-100 space-y-3">
      <p className="text-xs font-semibold text-slate-700">Metricool Blog ID per Client</p>
      <p className="text-xs text-slate-400">Each client maps to a blogId in your Metricool workspace. Get IDs from Metricool → Settings → Accounts.</p>
      {clients.map(client => (
        <div key={client.id} className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: client.color }}>
            {client.initials}
          </div>
          <span className="text-xs font-medium text-slate-700 w-32 truncate">{client.name}</span>
          <input
            defaultValue={client.metricool_blog_id ?? ''}
            placeholder="e.g. 123456"
            onChange={e => setLocalIds(prev => ({ ...prev, [client.id]: e.target.value }))}
            className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-novax-border"
          />
          <button
            onClick={() => handleSave(client.id)}
            disabled={saving === client.id}
            className="px-2.5 py-1.5 text-xs text-white rounded-lg disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1"
            style={{ background: '#1B3D38' }}
          >
            {saving === client.id ? <RefreshCw className="w-3 h-3 animate-spin"/> : null}
            Save
          </button>
        </div>
      ))}
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
  const [activeTab, setActiveTab] = useState<'integrations' | 'team' | 'notifications' | 'security' | 'preview'>(isAdmin ? 'integrations' : 'team')
  const [showInvite, setShowInvite] = useState(false)

  const tabs = [
    ...(isAdmin ? [{ id: 'integrations' as const, label: 'Integrations', icon: Zap }] : []),
    { id: 'team' as const, label: 'Team', icon: Users },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'security' as const, label: 'Security', icon: Shield },
    ...(isAdmin ? [{ id: 'preview' as const, label: 'Role Preview', icon: Eye }] : []),
  ]

  return (
    <div className="max-w-4xl space-y-5">
      {showInvite && <InviteUserModal onClose={() => setShowInvite(false)} />}
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

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm font-semibold text-amber-800">Webhook endpoints</p>
            <p className="text-xs text-amber-700 mt-1">Configure these URLs in your Respond.io and Metricool dashboards:</p>
            <div className="space-y-1 mt-2">
              {[
                { label: 'Moderation Webhook', url: '/api/webhooks/respond-io' },
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
                <button onClick={() => setShowInvite(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors">
                  <Plus className="w-3.5 h-3.5" />Invite Member
                </button>
              )}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Member', 'Role', 'Department', 'Access Level', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: user.color }}>
                            {user.initials}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{user.name}</p>
                            <p className="text-[11px] text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{user.role.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{user.department}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                          user.role === 'admin' || user.role === 'creative_director'
                            ? 'bg-novax-light text-novax'
                            : 'bg-slate-100 text-slate-600')}>
                          {user.role === 'admin' || user.role === 'creative_director' ? 'Full Access' : 'Standard'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin && (
                          <button className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Edit</button>
                        )}
                      </td>
                    </tr>
                  ))}
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
        </div>
      )}

      {activeTab === 'preview' && <RolePreviewTab />}
    </div>
  )
}
