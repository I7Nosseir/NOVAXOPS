'use client'

import Link from 'next/link'
import { Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#060910] px-4">
      <div className="text-center max-w-md">
        <p className="text-novax font-bold text-6xl mb-4">404</p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Page not found
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-novax text-white text-sm font-medium rounded-lg hover:bg-novax-hover transition-colors"
        >
          <Home className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
