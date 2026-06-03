'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { IntroAnimation } from '@/components/intro-animation'

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
  const { signIn } = useAuth()
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [mounted, setMounted]   = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const [showIntro] = useState(() => {
    if (typeof window === 'undefined') return false
    return !sessionStorage.getItem('nova_intro_shown')
  })
  const [introDone, setIntroDone] = useState(!showIntro)

  const handleIntroComplete = useCallback(() => {
    sessionStorage.setItem('nova_intro_shown', '1')
    setIntroDone(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await signIn(email, password)
    if (err) {
      setError(err)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <>
      {showIntro && !introDone && (
        <IntroAnimation onComplete={handleIntroComplete}/>
      )}

      <div
        style={{
          opacity:    introDone ? 1 : 0,
          transform:  introDone ? 'none' : 'translateY(16px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
          animation:  mounted && introDone ? 'login-card-in 0.6s cubic-bezier(.4,0,.2,1) both' : 'none',
        }}
      >
        {/* Logo */}
        <div className="text-center mb-8"
          style={{ animation: mounted ? 'login-logo-in 0.7s cubic-bezier(.4,0,.2,1) both' : 'none' }}>
          <NovaLogo className="h-9 mx-auto mb-3"/>
          <p className="text-slate-500 text-xs tracking-wide">Operations Platform</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl overflow-hidden"
          style={{
            background:     'rgba(10, 20, 20, 0.75)',
            backdropFilter: 'blur(24px)',
            border:         '1px solid rgba(91, 180, 174, 0.15)',
            boxShadow:      '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
          <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(91,180,174,0.6), transparent)' }}/>

          <div className="p-7">
            <h1 className="text-white font-semibold text-xl mb-1">Sign in</h1>
            <p className="text-slate-500 text-sm mb-6">Access restricted to NOVA team members.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div style={{ animation: mounted ? 'login-field-in 0.5s cubic-bezier(.4,0,.2,1) 0.3s both' : 'none' }}>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required autoFocus
                  placeholder="you@agency.com"
                  autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => { e.currentTarget.style.border = '1px solid rgba(91,180,174,0.5)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
                  onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';  e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                />
              </div>

              <div style={{ animation: mounted ? 'login-field-in 0.5s cubic-bezier(.4,0,.2,1) 0.42s both' : 'none' }}>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    onFocus={e => { e.currentTarget.style.border = '1px solid rgba(91,180,174,0.5)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
                    onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';  e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0"/>
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <div style={{ animation: mounted ? 'login-field-in 0.5s cubic-bezier(.4,0,.2,1) 0.54s both' : 'none' }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white mt-1 disabled:opacity-50 relative overflow-hidden transition-all"
                  style={{ background: 'linear-gradient(135deg, #0D3535 0%, #1E5C57 100%)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #0D3535 0%, #2A7A74 100%)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #0D3535 0%, #1E5C57 100%)' }}
                >
                  {loading
                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Signing in…</span>
                    : 'Sign in'}
                  <span className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(90deg,transparent,rgba(91,180,174,0.15),transparent)', backgroundSize: '200% 100%', animation: 'login-shimmer 3s linear infinite' }}/>
                </button>
              </div>
            </form>
          </div>
          <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(91,180,174,0.2), transparent)' }}/>
        </div>
      </div>
    </>
  )
}
