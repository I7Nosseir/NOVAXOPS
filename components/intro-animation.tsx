'use client'

import { useEffect, useState } from 'react'

const LETTERS = ['N', 'O', 'V', 'A', 'X']
// odd indices come from below, even from above
const LETTER_DELAY = [0, 0.08, 0.16, 0.24, 0.32]

function NovaxMarkLarge() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icon.svg" alt="NOVAX" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
}

interface Props {
  onComplete: () => void
}

export function IntroAnimation({ onComplete }: Props) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    // start exit at 2.6s, call onComplete at 3.3s (after slide finishes)
    const t1 = setTimeout(() => setExiting(true), 2600)
    const t2 = setTimeout(() => onComplete(), 3350)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onComplete])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0A1612',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        animation: exiting ? 'intro-exit 0.75s cubic-bezier(0.76,0,0.24,1) forwards' : 'none',
      }}
    >
      {/* Dot grid background */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle, rgba(91,180,174,0.18) 1px, transparent 1px)',
        backgroundSize: '36px 36px',
        animation: 'intro-dot-fade 3s ease-in-out infinite',
      }}/>

      {/* Scan line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: '1px',
        background: 'linear-gradient(90deg, transparent, #5BB4AE, transparent)',
        animation: 'intro-scan 2s linear 0.2s forwards',
        opacity: 0,
      }}/>

      {/* Expanding rings */}
      <div style={{
        position: 'absolute',
        width: 120, height: 120,
        borderRadius: '50%',
        border: '1px solid rgba(91,180,174,0.5)',
        animation: 'intro-ring 1.8s ease-out 0.1s forwards',
        opacity: 0,
      }}/>
      <div style={{
        position: 'absolute',
        width: 120, height: 120,
        borderRadius: '50%',
        border: '1px solid rgba(91,180,174,0.3)',
        animation: 'intro-ring2 2.2s ease-out 0.4s forwards',
        opacity: 0,
      }}/>

      {/* Logo mark */}
      <div style={{
        width: 72, height: 72,
        animation: 'intro-mark 0.9s cubic-bezier(0.34,1.56,0.64,1) 0.15s both',
        marginBottom: 32,
        position: 'relative',
        zIndex: 2,
      }}>
        <NovaxMarkLarge />
      </div>

      {/* NOVAX letters */}
      <div style={{
        display: 'flex',
        gap: 4,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 2,
        marginBottom: 16,
      }}>
        {LETTERS.map((letter, i) => (
          <span
            key={letter}
            style={{
              fontSize: 'clamp(48px, 10vw, 80px)',
              fontWeight: 700,
              color: '#FFFFFF',
              fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              display: 'inline-block',
              animation: `${i % 2 === 0 ? 'intro-letter-up' : 'intro-letter-down'} 0.6s cubic-bezier(0.34,1.3,0.64,1) ${0.55 + LETTER_DELAY[i]}s both`,
            }}
          >
            {letter}
          </span>
        ))}
      </div>

      {/* Sweep line */}
      <div style={{
        width: 'min(260px, 60vw)',
        height: '1px',
        background: 'linear-gradient(90deg, transparent, #5BB4AE, transparent)',
        transformOrigin: 'center',
        animation: 'intro-line-grow 0.5s ease-out 1.3s both',
        marginBottom: 14,
        position: 'relative',
        zIndex: 2,
      }}/>

      {/* Tagline */}
      <p style={{
        color: '#5BB4AE',
        fontSize: 'clamp(9px, 1.5vw, 11px)',
        fontWeight: 600,
        fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
        letterSpacing: '0.25em',
        textTransform: 'uppercase',
        animation: 'intro-tagline 0.7s ease-out 1.5s both',
        position: 'relative',
        zIndex: 2,
      }}>
        Operations Platform
      </p>

      {/* White flash on exit */}
      {exiting && (
        <div style={{
          position: 'absolute', inset: 0,
          background: '#5BB4AE',
          animation: 'intro-flash 0.4s ease-out forwards',
          pointerEvents: 'none',
        }}/>
      )}
    </div>
  )
}
