'use client'

import { AlertTriangle } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#060910] px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 mb-4">
          <AlertTriangle className="w-7 h-7 text-red-500 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Something went wrong
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-1">
          {error.message || 'An unexpected error occurred.'}
        </p>
        {error.digest && (
          <p className="text-slate-400 dark:text-slate-500 text-xs mb-6">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-novax text-white text-sm font-medium rounded-lg hover:bg-novax-hover transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
