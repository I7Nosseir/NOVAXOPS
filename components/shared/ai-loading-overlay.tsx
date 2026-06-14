'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'

/**
 * Full-screen AI generation overlay — covers sidebar, header, everything.
 * Renders via portal into document.body.
 *
 * Usage (simple):
 *   {isGenerating && <AILoadingOverlay message="Building your strategy…" />}
 *
 * Usage (cycling messages):
 *   {isGenerating && <AILoadingOverlay messages={['Analysing…', 'Scoring…', 'Writing verdict…']} sub="Scroll stop · emotional pull · brand fit" />}
 */
export function AILoadingOverlay({
  message = 'Thinking…',
  sub,
  messages,
}: {
  message?: string
  sub?: string
  /** Cycles through these messages automatically if provided (replaces `message`) */
  messages?: string[]
}) {
  const [idx, setIdx] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Trigger fade-in
    const t = setTimeout(() => setMounted(true), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!messages || messages.length < 2) return
    const id = setInterval(() => setIdx(i => (i + 1) % messages.length), 2800)
    return () => clearInterval(id)
  }, [messages])

  if (typeof document === 'undefined') return null

  const displayMsg = messages?.[idx] ?? message

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: 'rgba(4,11,10,0.92)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.35s ease',
      }}
    >
      <style>{`
        @keyframes alo-orbit      { from { transform:rotate(0deg) }   to { transform:rotate(360deg) } }
        @keyframes alo-orbit-ccw  { from { transform:rotate(0deg) }   to { transform:rotate(-360deg) } }
        @keyframes alo-orbit-slow { from { transform:rotate(0deg) }   to { transform:rotate(360deg) } }
        @keyframes alo-pulse-ring { 0%,100% { opacity:.5; transform:scale(1) }    50% { opacity:.14; transform:scale(1.13) } }
        @keyframes alo-glow-ring  { 0%,100% { box-shadow:0 0 14px 4px rgba(91,180,174,.2) } 50% { box-shadow:0 0 36px 12px rgba(91,180,174,.5) } }
        @keyframes alo-shimmer    { from { background-position:-200% 0 } to { background-position:200% 0 } }
        @keyframes alo-msg-in     { from { opacity:0; transform:translateY(7px) } to { opacity:1; transform:translateY(0) } }
        @keyframes alo-dot        { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:.2; transform:scale(.7) } }

        .alo-orbit      { animation: alo-orbit      4s linear infinite }
        .alo-orbit-ccw  { animation: alo-orbit-ccw  6.5s linear infinite }
        .alo-orbit-slow { animation: alo-orbit-slow 9s linear infinite }
        .alo-pulse-ring { animation: alo-pulse-ring 2.8s ease-in-out infinite }
        .alo-glow-ring  { animation: alo-glow-ring  2.6s ease-in-out infinite }
        .alo-msg        { animation: alo-msg-in 0.42s cubic-bezier(.16,1,.3,1) both }
        .alo-shimmer-bar {
          background: linear-gradient(90deg,
            rgba(91,180,174,0)   0%,
            rgba(91,180,174,.9) 50%,
            rgba(91,180,174,0)  100%);
          background-size: 200% 100%;
          animation: alo-shimmer 1.9s ease-in-out infinite;
        }
        .alo-dot-1 { animation: alo-dot 1.4s ease-in-out infinite; animation-delay: 0ms }
        .alo-dot-2 { animation: alo-dot 1.4s ease-in-out infinite; animation-delay: 220ms }
        .alo-dot-3 { animation: alo-dot 1.4s ease-in-out infinite; animation-delay: 440ms }
      `}</style>

      {/* Top shimmer progress bar */}
      <div
        className="fixed top-0 left-0 right-0 h-[2px] overflow-hidden"
        style={{ background: 'rgba(91,180,174,.1)' }}
      >
        <div className="h-full w-full alo-shimmer-bar" />
      </div>

      {/* Header label */}
      <p
        className="text-[9px] font-bold uppercase tracking-[.28em] mb-8"
        style={{ color: 'rgba(91,180,174,.5)' }}
      >
        NOVAX AI
      </p>

      {/* Orbital center piece */}
      <div
        className="relative flex items-center justify-center mb-8"
        style={{ width: 172, height: 172 }}
      >
        {/* Outermost pulse ring */}
        <div
          className="absolute inset-0 rounded-full alo-pulse-ring"
          style={{ border: '1px solid rgba(91,180,174,.25)' }}
        />

        {/* Slow outer dashed orbit */}
        <div
          className="absolute rounded-full alo-orbit-slow"
          style={{
            inset: 10,
            border: '1px dashed rgba(91,180,174,.2)',
            borderRadius: '50%',
          }}
        />

        {/* CCW orbit ring */}
        <div
          className="absolute rounded-full alo-orbit-ccw"
          style={{
            inset: 26,
            border: '1px solid rgba(91,180,174,.13)',
            borderRadius: '50%',
          }}
        />

        {/* Orbiting dot — outer CW */}
        <div
          className="absolute alo-orbit"
          style={{ inset: 10, borderRadius: '50%' }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: 7,
              height: 7,
              top: -3.5,
              left: '50%',
              marginLeft: -3.5,
              background: '#5BB4AE',
              boxShadow: '0 0 8px 3px rgba(91,180,174,.85)',
            }}
          />
        </div>

        {/* Orbiting dot — inner CCW */}
        <div
          className="absolute alo-orbit-ccw"
          style={{ inset: 26, borderRadius: '50%' }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: 5,
              height: 5,
              bottom: -2.5,
              left: '50%',
              marginLeft: -2.5,
              background: '#9DCCC8',
            }}
          />
        </div>

        {/* Orbiting dot — slow, 90° offset */}
        <div
          className="absolute alo-orbit-slow"
          style={{ inset: 10, borderRadius: '50%', transform: 'rotate(90deg)' }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: 4,
              height: 4,
              top: -2,
              left: '50%',
              marginLeft: -2,
              background: 'rgba(42,107,98,.7)',
            }}
          />
        </div>

        {/* Center disk */}
        <div
          className="relative z-10 rounded-full flex flex-col items-center justify-center alo-glow-ring select-none"
          style={{ width: 84, height: 84, background: '#1B3D38' }}
        >
          <span
            className="text-[12px] font-black leading-none"
            style={{ color: '#fff', letterSpacing: '.2em' }}
          >
            NOVAX
          </span>
          <span
            className="text-[7px] font-semibold uppercase mt-1"
            style={{ color: '#5BB4AE', letterSpacing: '.15em' }}
          >
            AI
          </span>
        </div>
      </div>

      {/* Cycling message */}
      <p
        key={displayMsg}
        className="alo-msg text-sm font-semibold text-center max-w-xs leading-relaxed"
        style={{ color: 'rgba(255,255,255,.88)' }}
      >
        {displayMsg}
      </p>

      {/* Sub-label */}
      {sub && (
        <p
          className="text-xs mt-2 text-center max-w-xs leading-relaxed"
          style={{ color: 'rgba(91,180,174,.55)' }}
        >
          {sub}
        </p>
      )}

      {/* Pulse dots */}
      <div className="flex items-center gap-2 mt-7">
        <div className="w-1.5 h-1.5 rounded-full alo-dot-1" style={{ background: '#5BB4AE' }} />
        <div className="w-1.5 h-1.5 rounded-full alo-dot-2" style={{ background: '#5BB4AE' }} />
        <div className="w-1.5 h-1.5 rounded-full alo-dot-3" style={{ background: '#5BB4AE' }} />
      </div>
    </div>,
    document.body,
  )
}
