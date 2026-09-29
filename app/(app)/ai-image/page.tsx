'use client'

import { ImageIcon } from 'lucide-react'

export default function AIImagePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] text-center px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-novax mb-6">
        <ImageIcon className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">AI Image Generation</h1>
      <p className="text-base font-semibold text-novax-muted mb-3">Coming Soon</p>
      <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
        This feature is being configured. AI image creation via Flux 2 and Ideogram will be
        available once the required API keys are set up.
      </p>
    </div>
  )
}
