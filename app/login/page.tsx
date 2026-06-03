'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'

// ─── Inline NOVA logo ──────────────────────────────────────────────────────────
function NovaLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 72" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M12 56V16h7.5l18 26.4V16H45v40h-7.5L19.5 29.6V56H12z" fill="white"/>
      <path d="M52 36c0-12.2 8.6-21 20-21s20 8.8 20 21-8.6 21-20 21S52 48.2 52 36zm31.4 0c0-8.4-4.8-14-11.4-14S60.6 27.6 60.6 36s4.8 14 11.4 14 11.4-5.6 11.4-14z" fill="white"/>
      <line x1="94" y1="62" x2="148" y2="10" stroke="white" strokeWidth="3.5" strokeLinecap="round"
        style={{ strokeDasharray: 80, animation: 'login-slash-draw 0.6s cubic-bezier(.4,0,.2,1) 0.7s both' }}/>
      <path d="M148 16h8.6l11.4 30.8L179.4 16H188l-16 40h-8z" fill="white"/>
      <path d="M195.6 56l16-40h8.4l16 40h-8.2l-3.4-8.8H207l-3.4 8.8h-8zm14-15.2h10.8L215.8 24l-6.2 16.8z" fill="white"/>
      <text x="238" y="20" fontFamily="system-ui,sans-serif" fontSize="8" fontWeight="600" fill="white" opacity="0.6">TM</text>
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const { signIn, session, loading: authLoading } = useAuth()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [mounted, setMounted]   = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Redirect if already signed in
  useEffect(() => {
    if (!authLoading && session) router.replace('/dashboard')
  }, [session, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)
    const { error: err } = await signIn(email.trim(), password)
    if (err) {
      setError(err)
      setLoading(false)
    } else {
      router.replace('/dashboard')
    }
  }

  if (authLoading) return null

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #060a0a 0%, #0a1515 40%, #0D3535 100%)' }}>

      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute rounded-full"
          style={{
            width: 600, height: 600,
            top: '-10%', left: '-10%',
            background: 'radial-gradient(circle, rgba(91,180,174,0.12) 0%, transparent 70%)',
            animation: 'login-orb-drift 18s ease-in-out infinite',
          }}/>
        <div className="absolute rounded-full"
          style={{
            width: 500, height: 500,
            bottom: '-15%', right: '-8%',
            background: 'radial-gradient(circle, rgba(13,53,53,0.8) 0%, rgba(91,180,174,0.08) 50%, transparent 70%)',
            animation: 'login-orb-drift2 22s ease-in-out infinite',
          }}/>
        <div className="absolute rounded-full"
          style={{
            width: 300, height: 300,
            top: '40%', left: '60%',
            background: 'radial-gradient(circle, rgba(91,180,174,0.06) 0%, transparent 70%)',
            animation: 'login-orb-drift 28s ease-in-out infinite reverse',
          }}/>
        {/* Grid dots */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="white"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)"/>
        </svg>
      </div>

      {/* Main card */}
      <div
        className="relative w-full max-w-[420px] mx-4"
        style={{
          animation: mounted ? 'login-card-in 0.6s cubic-bezier(.4,0,.2,1) 0.1s both' : 'none',
          opacity: mounted ? undefined : 0,
        }}
      >
        {/* Logo section */}
        <div className="text-center mb-10"
          style={{ animation: mounted ? 'login-logo-in 0.7s cubic-bezier(.4,0,.2,1) both' : 'none' }}>
          <NovaLogo className="h-10 mx-auto mb-6"/>
          <p className="text-slate-400 text-sm tracking-wide">Operations Platform</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(10, 20, 20, 0.7)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(91, 180, 174, 0.15)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>

          {/* Card top accent line */}
          <div className="h-px w-full"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(91,180,174,0.6), transparent)' }}/>

          <div className="p-8">
            <h1 className="text-white font-semibold text-xl mb-1">Sign in</h1>
            <p className="text-slate-500 text-sm mb-7">Enter your credentials to access the platform.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div style={{ animation: mounted ? 'login-field-in 0.5s cubic-bezier(.4,0,.2,1) 0.3s both' : 'none' }}>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@agency.com"
                  autoComplete="email"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  onFocus={e => { e.currentTarget.style.border = '1px solid rgba(91,180,174,0.5)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
                  onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                />
              </div>

              {/* Password */}
              <div style={{ animation: mounted ? 'login-field-in 0.5s cubic-bezier(.4,0,.2,1) 0.42s both' : 'none' }}>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                    onFocus={e => { e.currentTarget.style.border = '1px solid rgba(91,180,174,0.5)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
                    onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0"/>
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              {/* Submit */}
              <div style={{ animation: mounted ? 'login-field-in 0.5s cubic-bezier(.4,0,.2,1) 0.54s both' : 'none' }}>
                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all mt-2 disabled:opacity-50 relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #0D3535 0%, #1E5C57 100%)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #0D3535 0%, #2A7A74 100%)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #0D3535 0%, #1E5C57 100%)' }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                      Signing in…
                    </span>
                  ) : 'Sign in'}
                  {/* Button shimmer overlay */}
                  <span className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(91,180,174,0.15) 50%, transparent 100%)',
                      backgroundSize: '200% 100%',
                      animation: 'login-shimmer 3s linear infinite',
                    }}/>
                </button>
              </div>
            </form>
          </div>

          {/* Card bottom accent */}
          <div className="h-px w-full"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(91,180,174,0.2), transparent)' }}/>
          <div className="px-8 py-4 text-center">
            <p className="text-[11px] text-slate-600">Access restricted to NOVA team members</p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-700 text-[11px] mt-6">
          NOVA Operations Platform · Confidential
        </p>
      </div>
    </div>
  )
}
