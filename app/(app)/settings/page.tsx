'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Key, Bell, Users, Shield, Zap, Plus } from 'lucide-react'
import { useUsers } from '@/lib/hooks/use-users'
import { useAuth } from '@/lib/auth-context'
import { cn, hasRole } from '@/lib/utils'
import { InviteUserModal } from '@/components/settings/invite-user-modal'

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
    id: 'freepik', realName: 'Freepik', maskedName: 'Asset Library', status: 'connected',
    description: 'Premium and free asset search and download',
    fields: [{ label: 'API Key', key: 'api_key', type: 'password', placeholder: 'fpik_xxxxxxxxxx' }],
    color: '#00c9a7',
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

export default function SettingsPage() {
  const { user: currentUser } = useAuth()
  const { users } = useUsers()
  const isAdmin = currentUser?.role === 'admin'
  const canSeeVendorNames = hasRole(currentUser, ['admin', 'ceo'])
  const [activeTab, setActiveTab] = useState<'integrations' | 'team' | 'notifications' | 'security'>(isAdmin ? 'integrations' : 'team')
  const [showInvite, setShowInvite] = useState(false)

  const tabs = [
    ...(isAdmin ? [{ id: 'integrations' as const, label: 'Integrations', icon: Zap }] : []),
    { id: 'team' as const, label: 'Team', icon: Users },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'security' as const, label: 'Security', icon: Shield },
  ]

  return (
    <div className="max-w-4xl space-y-5">
      {showInvite && <InviteUserModal onClose={() => setShowInvite(false)} />}
      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
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
            <p className="text-sm text-slate-500">Connect external platforms. All credentials are stored encrypted in Supabase Vault.</p>
          </div>
          <div className="space-y-3">
            {INTEGRATIONS_REAL.map(i => <IntegrationCard key={i.id} integration={i} showReal={canSeeVendorNames} />)}
          </div>
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Team Members</h3>
              <p className="text-sm text-slate-500">{users.length} members · Role-based access via Supabase RLS</p>
            </div>
            {isAdmin && (
              <button onClick={() => setShowInvite(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors">
                <Plus className="w-3.5 h-3.5" />Invite Member
              </button>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
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
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900">Notification Preferences</h3>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {[
              { label: 'Task due today',              desc: 'Remind me when tasks are due', on: true },
              { label: 'Approval required',           desc: 'When a task reaches Approval stage', on: true },
              { label: 'New moderation item',         desc: 'Comment or DM received via Respond.io', on: true },
              { label: 'Post published',              desc: 'When Metricool confirms a post is live', on: true },
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
              { label: 'Supabase RLS',    status: 'Active',    desc: 'Row-level security enforced on all tables', ok: true },
              { label: 'Credential Vault', status: 'Encrypted', desc: 'API keys stored in Supabase Vault (AES-256)', ok: true },
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
    </div>
  )
}
