'use client'

import { useEffect, useState } from 'react'

interface AuroraLoaderProps {
  show?: boolean
  label?: string
  onDone?: () => void
  minDuration?: number
}

export function AuroraLoader({
  show = true,
  label = 'Initialising',
  onDone,
  minDuration = 800,
}: AuroraLoaderProps) {
  const [visible, setVisible] = useState(show)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (!show && visible) {
      const t = setTimeout(() => {
        setExiting(true)
        const t2 = setTimeout(() => {
          setVisible(false)
          onDone?.()
        }, 400)
        return () => clearTimeout(t2)
      }, minDuration)
      return () => clearTimeout(t)
    }
    if (show) {
      setVisible(true)
      setExiting(false)
    }
  }, [show, visible, minDuration, onDone])

  if (!visible) return null

  return (
    <div
      className="aurora-loader"
      style={{
        opacity: exiting ? 0 : 1,
        transition: 'opacity 0.4s ease',
      }}
    >
      {/* Centre content */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>

        {/* NOVAX mark — SVG ring + N */}
        <div style={{ position: 'relative', width: 72, height: 72 }}>
          <svg
            viewBox="0 0 72 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: 72, height: 72, position: 'absolute', inset: 0 }}
          >
            <circle
              cx="36" cy="36" r="33"
              stroke="rgba(91,180,174,0.18)"
              strokeWidth="1.5"
            />
            <circle
              cx="36" cy="36" r="33"
              stroke="url(#arc-grad)"
              strokeWidth="1.5"
              strokeDasharray="130 207"
              strokeLinecap="round"
              style={{ animation: 'orbital-spin 3s linear infinite' }}
            />
            <defs>
              <linearGradient id="arc-grad" x1="0" y1="0" x2="72" y2="72" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#5BB4AE" />
                <stop offset="100%" stopColor="#2A6B62" stopOpacity="0.2" />
              </linearGradient>
            </defs>
          </svg>
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            background: 'linear-gradient(135deg, #5BB4AE 0%, #2A6B62 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            N
          </div>
        </div>

        {/* Wordmark */}
        <div className="aurora-loader-wordmark">
          NOV<span>AX</span>
        </div>

        {/* Label */}
        <div className="aurora-loader-tagline">{label}</div>

        {/* Progress bar */}
        <div className="aurora-loader-bar-track">
          <div className="aurora-loader-bar-fill" />
        </div>
      </div>
    </div>
  )
}

interface OrbitalLoaderProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

export function OrbitalLoader({ size = 'md', label, className = '' }: OrbitalLoaderProps) {
  const dim = size === 'sm' ? 32 : size === 'lg' ? 72 : 48
  const dotSize = size === 'sm' ? 5 : size === 'lg' ? 9 : 7
  const r1 = dim / 2
  const r2 = dim * 0.625

  return (
    <div
      className={`orbital-loader orbital-loader-${size} ${className}`}
      style={{ width: dim, height: dim }}
      role="status"
      aria-label={label ?? 'Loading'}
    >
      {/* Outer ring */}
      <div
        className="orbital-ring"
        style={{
          width: dim,
          height: dim,
          borderTopColor: 'rgba(91,180,174,0.85)',
          borderRightColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: 'transparent',
          animation: 'orbital-spin 1.1s linear infinite',
        }}
      />
      {/* Inner ring */}
      <div
        className="orbital-ring"
        style={{
          width: r2,
          height: r2,
          borderTopColor: 'transparent',
          borderRightColor: 'rgba(91,180,174,0.55)',
          borderBottomColor: 'transparent',
          borderLeftColor: 'transparent',
          animation: 'orbital-spin 1.7s linear infinite reverse',
        }}
      />
      {/* Centre dot */}
      <div
        className="orbital-dot"
        style={{
          width: dotSize,
          height: dotSize,
          animation: 'orbital-dot-glow 1.1s ease-in-out infinite',
        }}
      />
      {label && (
        <span className="sr-only">{label}</span>
      )}
    </div>
  )
}

interface SignalPulseProps {
  size?: number
  className?: string
  children?: React.ReactNode
}

export function SignalPulse({ size = 20, className = '', children }: SignalPulseProps) {
  return (
    <div
      className={`signal-pulse ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="signal-ring" style={{ width: size, height: size }} />
      <div className="signal-ring" style={{ width: size, height: size }} />
      <div className="signal-ring" style={{ width: size, height: size }} />
      {children}
    </div>
  )
}

interface ShimmerSkeletonProps {
  variant?: 'card' | 'line' | 'avatar' | 'badge'
  lines?: number
  className?: string
  width?: string | number
  height?: string | number
}

export function ShimmerSkeleton({
  variant = 'card',
  lines = 3,
  className = '',
  width,
  height,
}: ShimmerSkeletonProps) {
  if (variant === 'line') {
    return (
      <div
        className={`skeleton ${className}`}
        style={{ width: width ?? '100%', height: height ?? 12 }}
      />
    )
  }

  if (variant === 'avatar') {
    return (
      <div
        className={`skeleton skeleton-avatar ${className}`}
        style={{ width: width ?? 36, height: height ?? 36 }}
      />
    )
  }

  if (variant === 'badge') {
    return (
      <div
        className={`skeleton skeleton-badge ${className}`}
        style={{ width: width ?? 64, height: height ?? 22 }}
      />
    )
  }

  // card
  return (
    <div className={`skeleton-card ${className}`} style={{ width, height }}>
      <div className="skeleton skeleton-header" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`skeleton ${i === lines - 1 ? 'skeleton-line-short' : 'skeleton-line'}`}
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <ShimmerSkeleton variant="badge" />
        <ShimmerSkeleton variant="badge" width={80} />
      </div>
    </div>
  )
}

interface ScanRevealProps {
  children: React.ReactNode
  show?: boolean
  className?: string
}

export function ScanReveal({ children, show = false, className = '' }: ScanRevealProps) {
  return (
    <div className={`scan-container ${className}`}>
      {show && <div className="scan-line" />}
      <div className={show ? 'scan-content' : ''}>
        {children}
      </div>
    </div>
  )
}

// Inline loader for buttons / small spaces
export function InlineLoader({ className = '' }: { className?: string }) {
  return (
    <OrbitalLoader size="sm" className={className} />
  )
}

// Page-level loading overlay (lighter than AuroraLoader)
export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 20,
      }}
      className="animate-fade-in-up"
    >
      <OrbitalLoader size="lg" />
      <p style={{
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#4E6D6A',
      }}>
        {label}
      </p>
    </div>
  )
}
