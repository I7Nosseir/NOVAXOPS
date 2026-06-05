'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

function NovaLogoMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icon.svg" alt="NOVA" className={className} />
}

export default function OnboardingPage() {
  const { session, loading } = useAuth()
  const router = useRouter()

  const meta = session?.user?.user_metadata ?? {}
  const assignedRole = (meta.role as string | undefined) ?? ''
  const roleLabel = assignedRole.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())

  const [name, setName] = useState((meta.name as string | undefined) ?? '')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If no session after load, redirect to login
  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login')
    }
  }, [loading, session, router])

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-novax" />
      </div>
    )
  }

  if (done) {
    return (
      <div className="w-full max-w-md mx-auto text-center">
        <CheckCircle2 className="w-14 h-14 text-novax-accent mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-900 mb-2">You are all set</h1>
        <p className="text-sm text-slate-500">Redirecting you to the platform…</p>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) { setError('Please enter your full name.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/auth/complete-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, name: name.trim(), phone: phone.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Something went wrong'); setSaving(false); return }

      setDone(true)
      setTimeout(() => router.replace('/dashboard'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-[#1B3D38] px-8 py-6 flex items-center gap-3">
          <NovaLogoMark className="w-9 h-9 shrink-0" />
          <div>
            <p className="text-white font-bold text-base tracking-wide">NOVAX OPS</p>
            <p className="text-[#5BB4AE] text-xs">Complete your account setup</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">
          <div>
            <h1 className="text-lg font-bold text-slate-900 mb-1">Welcome to the team</h1>
            <p className="text-sm text-slate-500">
              Confirm your details and set a permanent password to get started.
            </p>
          </div>

          {/* Assigned role — read-only */}
          <div className="bg-[#EBF4F3] border border-[#9DCCC8] rounded-lg px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#2A6B62] mb-0.5">Your Role</p>
            <p className="text-sm font-semibold text-[#1B3D38]">{roleLabel || 'Team Member'}</p>
          </div>

          {/* Full name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5BB4AE] focus:border-transparent"
            />
          </div>

          {/* Phone number */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Phone Number <span className="text-slate-400 normal-case font-normal">(optional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+1 555 000 0000"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5BB4AE] focus:border-transparent"
            />
          </div>

          {/* New password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                minLength={8}
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5BB4AE] focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat your new password"
                required
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5BB4AE] focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-[#1B3D38] hover:bg-[#163330] text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Setting up your account…' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  )
}
