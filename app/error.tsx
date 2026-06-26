'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global error boundary]', error)
  }, [error])

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="max-w-md w-full text-center px-6 py-12">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-slate-500 mb-6">
            An unexpected error occurred. The team has been notified.
          </p>
          <button
            onClick={reset}
            className="inline-flex items-center px-4 py-2 bg-[#1B3D38] text-white text-sm font-medium rounded-lg hover:bg-[#163330] transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
