'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { IntroAnimation } from '@/components/intro-animation'

function NovaxMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="16" cy="16" r="16" fill="#1B3D38"/>
      <path d="M7 23V9l5.5 9L18 9v14" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20 9l5 7-5 7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 16.5l3.5-3" stroke="#5BB4AE" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export default function LoginPage() {
  const { signIn } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Show intro once per session
  const [showIntro] = useState(() => {
    if (typeof window === 'undefined') return false
    return !sessionStorage.getItem('novax_intro_shown')
  })
  const [introDone, setIntroDone] = useState(!showIntro)

  const handleIntroComplete = useCallback(() => {
    sessionStorage.setItem('novax_intro_shown', '1')
    setIntroDone(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) {
      setError(error)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <>
      {showIntro && !introDone && (
        <IntroAnimation onComplete={handleIntroComplete} />
      )}

      <div
        className="w-full max-w-sm"
        style={{
          opacity: introDone ? 1 : 0,
          transform: introDone ? 'none' : 'translateY(12px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}
      >
        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <NovaxMark className="w-9 h-9" />
            <div>
              <p className="font-semibold text-slate-900 text-sm leading-tight">NOVAX</p>
              <p className="text-slate-500 text-xs">Operations Platform</p>
            </div>
          </div>

          <h1 className="text-xl font-semibold text-slate-900 mb-1">Sign in</h1>
          <p className="text-sm text-slate-500 mb-6">Internal access only</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@agency.com"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-900 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 pr-10 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-900 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-novax hover:bg-novax-hover disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
