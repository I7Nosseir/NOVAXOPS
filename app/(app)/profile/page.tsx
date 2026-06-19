'use client'

import { useState, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useOrg } from '@/lib/org-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { User, Mail, Phone, MessageSquare, Shield, Camera, Eye, EyeOff, Save, AlertCircle, Building2, CreditCard } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  ceo: 'CEO',
  creative_director: 'Creative Director',
  account_manager: 'Account Manager',
  strategist: 'Strategist',
  copywriter: 'Copywriter',
  designer: 'Designer',
  video_editor: 'Video Editor',
  web_developer: 'Web Developer',
  social_manager: 'Social Manager',
}

const DEPT_LABELS: Record<string, string> = {
  creative: 'Creative',
  strategy: 'Strategy',
  accounts: 'Accounts',
  social: 'Social',
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 py-4 border-b border-border last:border-0 items-start">
      <span className="text-sm font-medium text-muted-foreground pt-2">{label}</span>
      <div>{children}</div>
    </div>
  )
}

function Card({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon: React.ElementType }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2">
        <Icon size={16} className="text-novax-muted" />
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      <div className="px-6 py-2">{children}</div>
    </div>
  )
}

export default function ProfilePage() {
  const { user, realUser } = useAuth()
  const { org } = useOrg()

  const [name, setName]       = useState(user?.name ?? '')
  const [phone, setPhone]     = useState(user?.phone_number ?? '')
  const [saving, setSaving]   = useState(false)

  const [currentPw, setCurrentPw]   = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [changingPw, setChangingPw] = useState(false)

  const [avatarUrl, setAvatarUrl]     = useState(user?.avatar_url ?? null)
  const [uploadingAvatar, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const initials = user?.initials ?? (user?.name?.slice(0, 2).toUpperCase() ?? '??')

  async function saveProfile() {
    if (!user?.id) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ name: name.trim(), phone_number: phone.trim() || null })
        .eq('id', user.id)

      if (error) throw error
      toast.success('Profile updated')
    } catch (e) {
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  async function changePassword() {
    if (!newPw || newPw !== confirmPw) {
      toast.error('Passwords do not match')
      return
    }
    if (newPw.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setChangingPw(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) throw error
      toast.success('Password changed successfully')
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (e) {
      toast.error('Failed to change password')
    } finally {
      setChangingPw(false)
    }
  }

  async function uploadAvatar(file: File) {
    if (!user?.id) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${user.id}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(path)

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)
      if (updateError) throw updateError

      setAvatarUrl(publicUrl)
      toast.success('Avatar updated')
    } catch {
      toast.error('Failed to upload avatar')
    } finally {
      setUploading(false)
    }
  }

  const creditsPercent = org
    ? Math.min(100, Math.round((org.credits_used / org.credits_monthly) * 100))
    : 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your personal details and account settings.</p>
      </div>

      {/* Avatar + identity */}
      <Card title="Identity" icon={User}>
        <FieldRow label="Avatar">
          <div className="flex items-center gap-4">
            <button
              onClick={() => fileRef.current?.click()}
              className="relative group"
              disabled={uploadingAvatar}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-novax-border" />
              ) : (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl border-2 border-novax-border"
                  style={{ background: user?.color ?? '#1B3D38' }}
                >
                  {initials}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera size={18} className="text-white" />
              </div>
            </button>
            <div>
              <p className="text-sm text-muted-foreground">Click to upload a photo</p>
              <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG — max 5MB</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) uploadAvatar(f)
              }}
            />
          </div>
        </FieldRow>

        <FieldRow label="Display Name">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-novax-border-active"
            placeholder="Your full name"
          />
        </FieldRow>

        <FieldRow label="Email">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted text-sm text-muted-foreground">
            <Mail size={14} />
            {user?.email}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Email cannot be changed. Contact your admin.</p>
        </FieldRow>

        <FieldRow label="Role">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-novax-light text-novax text-xs font-semibold border border-novax-border">
            <Shield size={12} />
            {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
          </div>
        </FieldRow>

        <FieldRow label="Department">
          <span className="text-sm text-foreground">{DEPT_LABELS[user?.department ?? ''] ?? user?.department}</span>
        </FieldRow>

        <FieldRow label="Phone">
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-novax-border-active"
              placeholder="+1 555 000 0000"
            />
          </div>
        </FieldRow>

        <div className="py-4">
          <button
            onClick={saveProfile}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-novax text-white text-sm font-medium rounded-lg hover:bg-novax-hover disabled:opacity-50 transition-colors"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </Card>

      {/* Password change */}
      <Card title="Security" icon={Shield}>
        <FieldRow label="New Password">
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              className="w-full px-3 pr-10 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-novax-border-active"
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </FieldRow>

        <FieldRow label="Confirm Password">
          <input
            type={showPw ? 'text' : 'password'}
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            className={cn(
              'w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-novax-border-active',
              confirmPw && newPw !== confirmPw ? 'border-red-400' : 'border-border'
            )}
            placeholder="Repeat new password"
          />
          {confirmPw && newPw !== confirmPw && (
            <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
              <AlertCircle size={12} /> Passwords do not match
            </p>
          )}
        </FieldRow>

        <div className="py-4">
          <button
            onClick={changePassword}
            disabled={changingPw || !newPw || newPw !== confirmPw}
            className="flex items-center gap-2 px-4 py-2 bg-novax text-white text-sm font-medium rounded-lg hover:bg-novax-hover disabled:opacity-50 transition-colors"
          >
            <Shield size={14} />
            {changingPw ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </Card>

      {/* Organization + credits */}
      {org && (
        <Card title="Workspace" icon={Building2}>
          <FieldRow label="Organization">
            <span className="text-sm font-medium text-foreground">{org.name}</span>
          </FieldRow>
          <FieldRow label="Plan">
            <span className={cn(
              'inline-block px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide',
              org.plan === 'agency'     ? 'bg-novax-light text-novax border border-novax-border' :
              org.plan === 'growth'     ? 'bg-blue-50 text-blue-700 border border-blue-200' :
              org.plan === 'starter'    ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              org.plan === 'white_label'? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                          'bg-muted text-muted-foreground border border-border'
            )}>
              {org.plan.replace('_', ' ')}
            </span>
          </FieldRow>
          <FieldRow label="AI Credits">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{org.credits_used.toLocaleString()} used</span>
                <span>{org.credits_monthly.toLocaleString()} / month</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    creditsPercent >= 90 ? 'bg-red-500' :
                    creditsPercent >= 70 ? 'bg-amber-500' : 'bg-novax-accent'
                  )}
                  style={{ width: `${creditsPercent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {org.credits_monthly - org.credits_used} credits remaining. Resets on {
                  new Date(org.credits_reset_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
                }.
              </p>
            </div>
          </FieldRow>
        </Card>
      )}
    </div>
  )
}
