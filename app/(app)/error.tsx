'use client'

import { AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 mb-4">
          <AlertTriangle className="w-7 h-7 text-red-500 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Something went wrong
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-1">
          {error.message || 'An unexpected error occurred on this page.'}
        </p>
        {error.digest && (
          <p className="text-slate-400 dark:text-slate-500 text-xs mb-6">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-novax text-white text-sm font-medium rounded-lg hover:bg-novax-hover transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
