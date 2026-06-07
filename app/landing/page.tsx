'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  X,
  CheckCircle,
  Zap,
  BarChart3,
  FileText,
  Users,
  Globe,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Calendar,
  Target,
  Brain,
  Video,
  Shield,
  TrendingUp,
} from 'lucide-react'

// ─── Scroll-reveal hook ────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible')
          observer.disconnect()
        }
      },
      { threshold: 0.12 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}

// ─── Animated counter ──────────────────────────────────────────────────────
function AnimatedCounter({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const [value, setValue] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        const start = Date.now()
        const duration = 900
        const tick = () => {
          const elapsed = Date.now() - start
          const progress = Math.min(elapsed / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          setValue(Math.round(eased * target))
          if (progress < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        observer.disconnect()
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [target])
  return (
    <span ref={ref}>
      {prefix}{value}{suffix}
    </span>
  )
}

// ─── Nav ───────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])
  return (
    <nav
      className="landing-nav"
      style={{ borderBottomColor: scrolled ? 'rgba(255,255,255,0.08)' : 'transparent' }}
    >
      <div className="landing-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg, #1B3D38, #2A6B62)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: '#5BB4AE',
            border: '1px solid rgba(91,180,174,0.3)',
          }}>
            N
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: '#E8F0EF' }}>
            NOVAX<span style={{ color: '#5BB4AE' }}> OPS</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="/login" className="btn-cta-ghost" style={{ padding: '8px 18px', fontSize: 13 }}>
            Sign In
          </a>
          <a href="/login" className="btn-cta-primary" style={{ padding: '8px 18px', fontSize: 13 }}>
            Request Access
          </a>
        </div>
      </div>
    </nav>
  )
}

// ─── Hero ──────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section
      className="aurora-canvas landing-section"
      style={{
        paddingTop: 160,
        paddingBottom: 96,
        minHeight: '92vh',
        display: 'flex',
        alignItems: 'center',
        background: '#04100F',
      }}
    >
      <div className="landing-container" style={{ width: '100%' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>

          {/* Eyebrow */}
          <div className="feature-pill animate-fade-in-up" style={{ animationDelay: '0ms' }}>
            <Sparkles size={11} />
            Intelligence-first operations platform
          </div>

          {/* H1 */}
          <h1
            className="landing-h1 animate-fade-in-up"
            style={{ animationDelay: '80ms' }}
          >
            The Command Center
            <br />
            <span className="text-gradient-aurora">Your Agency Deserves</span>
          </h1>

          {/* Sub */}
          <p
            className="landing-sub animate-fade-in-up"
            style={{ textAlign: 'center', animationDelay: '160ms' }}
          >
            Strategy to publishing, powered by Claude AI. One platform for the full content pipeline — with client intelligence that actually learns your brands.
          </p>

          {/* CTAs */}
          <div
            className="animate-fade-in-up"
            style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', animationDelay: '240ms' }}
          >
            <a href="/login" className="btn-cta-primary">
              Request Access <ArrowRight size={16} />
            </a>
            <a href="#solution" className="btn-cta-ghost">
              See It Live <ChevronRight size={16} />
            </a>
          </div>

          {/* Trust line */}
          <p
            className="animate-fade-in-up"
            style={{ fontSize: 12, color: '#3D5A57', letterSpacing: '0.04em', animationDelay: '320ms' }}
          >
            Built for NOVAX · Powered by Claude Opus · Self-hosted on Vercel
          </p>

          {/* App mockup */}
          <div
            className="mockup-frame animate-fade-in-up"
            style={{ width: '100%', maxWidth: 900, marginTop: 16, animationDelay: '400ms' }}
          >
            <div className="mockup-titlebar">
              <div className="mockup-dot" style={{ background: '#C45A5A' }} />
              <div className="mockup-dot" style={{ background: '#D4A84B' }} />
              <div className="mockup-dot" style={{ background: '#4BB86A' }} />
              <span style={{ marginLeft: 8, fontSize: 11, color: '#4E6D6A', letterSpacing: '0.02em' }}>
                perfumeexhibition.com — NOVAX Ops
              </span>
            </div>
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Dashboard SVG Mockup ──────────────────────────────────────────────────
function DashboardMockup() {
  return (
    <div style={{
      background: '#07100f',
      display: 'flex',
      height: 420,
      overflow: 'hidden',
    }}>
      {/* Sidebar */}
      <div style={{
        width: 52,
        background: '#04100F',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 16,
        gap: 10,
      }}>
        {[BarChart3, FileText, Users, Calendar, Globe, MessageSquare].map((Icon, i) => (
          <div key={i} style={{
            width: 32, height: 32, borderRadius: 8,
            background: i === 0 ? 'rgba(91,180,174,0.15)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: i === 0 ? '#5BB4AE' : '#3D5A57',
            position: 'relative',
          }}>
            {i === 0 && (
              <div style={{
                position: 'absolute', left: -1, top: '15%', bottom: '15%',
                width: 2, borderRadius: 2,
                background: 'linear-gradient(to bottom, #5BB4AE, #2A6B62)',
                boxShadow: '0 0 8px rgba(91,180,174,0.7)',
              }} />
            )}
            <Icon size={15} />
          </div>
        ))}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, padding: '20px 20px 0 20px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#E8F0EF', letterSpacing: '-0.02em' }}>Dashboard</div>
            <div style={{ fontSize: 10, color: '#4E6D6A', marginTop: 1 }}>Good morning, Ismail</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ width: 80, height: 24, background: 'rgba(91,180,174,0.08)', borderRadius: 6, border: '1px solid rgba(91,180,174,0.15)' }} />
            <div style={{ width: 24, height: 24, background: '#1B3D38', borderRadius: 6, border: '1px solid rgba(91,180,174,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={11} color="#5BB4AE" />
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Active Tasks', val: '42', delta: '+8', color: '#5BB4AE' },
            { label: 'Posts Scheduled', val: '17', delta: '+3', color: '#5BB4AE' },
            { label: 'Pending Approval', val: '6', delta: '-2', color: '#D4A84B' },
            { label: 'AI Outputs Today', val: '28', delta: '+12', color: '#5BB4AE' },
          ].map((kpi, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8,
              padding: '10px 12px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: -20, right: -20, width: 50, height: 50, borderRadius: '50%', background: `radial-gradient(ellipse, rgba(91,180,174,0.10) 0%, transparent 70%)` }} />
              <div style={{ fontSize: 9, color: '#4E6D6A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#E8F0EF', letterSpacing: '-0.03em', lineHeight: 1 }}>{kpi.val}</div>
              <div style={{ fontSize: 9, color: kpi.color, marginTop: 3 }}>{kpi.delta} today</div>
            </div>
          ))}
        </div>

        {/* Content row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 10 }}>
          {/* Pipeline preview */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.065)',
            borderRadius: 8,
            padding: '12px 14px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9ABCBA', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Pipeline</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['Strategy', 'Copy', 'Design', 'Review', 'Published'].map((stage, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ fontSize: 8, color: '#4E6D6A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{stage}</div>
                  {Array.from({ length: i === 0 ? 3 : i === 1 ? 2 : i === 2 ? 4 : i === 3 ? 1 : 2 }).map((_, j) => (
                    <div key={j} style={{
                      height: 28,
                      borderRadius: 5,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderLeft: `2px solid ${i === 0 ? '#5BB4AE' : i === 1 ? '#D4A84B' : i === 2 ? '#5BB4AE' : i === 3 ? '#C45A5A' : '#4BB86A'}`,
                    }} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* AI activity */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.065)',
            borderRadius: 8,
            padding: '12px 14px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9ABCBA', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>AI Activity</div>
            {[
              { text: 'Hook Lab completed', time: '2m ago', color: '#5BB4AE' },
              { text: 'Caption generated', time: '8m ago', color: '#5BB4AE' },
              { text: 'Strategy exported', time: '1h ago', color: '#4BB86A' },
              { text: 'Post-mortem run', time: '2h ago', color: '#D4A84B' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '5px 0',
                borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: item.color, boxShadow: `0 0 6px ${item.color}` }} />
                  <span style={{ fontSize: 10, color: '#9ABCBA' }}>{item.text}</span>
                </div>
                <span style={{ fontSize: 9, color: '#4E6D6A' }}>{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Problem Section ───────────────────────────────────────────────────────
function ProblemSection() {
  const ref = useReveal()
  return (
    <section className="landing-section" style={{ background: '#030C0B', position: 'relative' }}>
      <hr className="teal-rule" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
      <div className="landing-container">
        <div ref={ref} className="reveal" style={{ maxWidth: 740, margin: '0 auto', textAlign: 'center' }}>
          <div className="landing-eyebrow">The Problem</div>
          <h2 className="landing-h2" style={{ marginBottom: 16 }}>
            Your creative workflow is brilliant in theory.
          </h2>
          <p className="landing-sub-center" style={{ marginBottom: 56 }}>
            In reality, it is five tools that have never spoken to each other — and a team that pays the price every single morning.
          </p>
        </div>

        {/* Tool chaos diagram */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 12,
            maxWidth: 900,
            margin: '0 auto',
          }}
          className="anim-stagger"
        >
          {[
            {
              label: 'Strategy lives in Notion.',
              detail: 'Tasks live in ClickUp. They have never met, and your team feels every gap between them.',
              icon: FileText,
            },
            {
              label: 'Post performance arrives 3 days late.',
              detail: 'By the time the data surfaces, the window for strategic pivots has already closed.',
              icon: BarChart3,
            },
            {
              label: 'AI tools ignore your clients.',
              detail: 'Generic models don\'t know your brand voice, past wins, or what your audience actually responds to.',
              icon: Brain,
            },
            {
              label: 'Every morning: five tabs, zero alignment.',
              detail: 'Slack for context, ClickUp for status, Notion for briefs, Metricool for posts. Repeat until exhausted.',
              icon: Globe,
            },
          ].map(({ label, detail, icon: Icon }, i) => (
            <div key={i} className="pain-item">
              <X size={16} style={{ color: '#C45A5A', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#E8F0EF', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, color: '#6E9896', lineHeight: 1.55 }}>{detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Agitate Section ───────────────────────────────────────────────────────
function AgitateSection() {
  const headRef = useReveal()
  const statsRef = useReveal()
  const paraRef = useReveal()
  return (
    <section className="landing-section aurora-canvas" style={{ background: '#04100F' }}>
      <div className="landing-container">
        <div ref={headRef} className="reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="landing-eyebrow">The Real Cost</div>
          <h2 className="landing-h2">
            Every.{' '}
            <span className="text-gradient-aurora">Single.</span>
            {' '}Day.
          </h2>
          <p className="landing-sub-center" style={{ marginTop: 16 }}>
            The hidden cost is not your tools. It is everything that falls through the gaps between them.
          </p>
        </div>

        {/* Stats row */}
        <div
          ref={statsRef}
          className="reveal"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginBottom: 56,
          }}
        >
          {[
            { num: 47, suffix: '', label: 'Context switches per team member, per day', color: '#C45A5A' },
            { num: 3, suffix: '.4h', label: 'Hours lost weekly per person to copy-pasting between platforms', color: '#D4A84B' },
            { num: 68, suffix: '%', label: 'Of AI-generated content abandoned — because it ignores brand voice', color: '#C45A5A' },
          ].map(({ num, suffix, label, color }, i) => (
            <div key={i} className="stat-counter-card">
              <div className="stat-number" style={{ color }}>
                <AnimatedCounter target={num} suffix={suffix} />
              </div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>

        {/* Story paragraph */}
        <div
          ref={paraRef}
          className="reveal"
          style={{
            maxWidth: 680,
            margin: '0 auto',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14,
            padding: '32px 36px',
            borderLeft: '3px solid rgba(196,90,90,0.5)',
          }}
        >
          <p style={{ fontSize: 16, color: '#9ABCBA', lineHeight: 1.75, margin: 0 }}>
            Your best strategist just spent{' '}
            <span style={{ color: '#E8F0EF', fontWeight: 600 }}>40 minutes building a report deck</span>
            {' '}from three different sources. Your creative director is on Slack asking for an update
            that lives somewhere in ClickUp. Your client is still waiting for an approval link that
            takes{' '}
            <span style={{ color: '#E8F0EF', fontWeight: 600 }}>25 minutes to generate manually</span>.
            And your AI tools just wrote three paragraphs in the wrong brand voice — again.
          </p>
          <p style={{ fontSize: 14, color: '#5BB4AE', marginTop: 20, marginBottom: 0, fontWeight: 600 }}>
            This is not a productivity problem. It is an infrastructure problem.
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── Solution Section ──────────────────────────────────────────────────────
function SolutionSection() {
  const headRef = useReveal()
  return (
    <section id="solution" className="landing-section" style={{ background: '#030C0B', position: 'relative' }}>
      <hr className="teal-rule" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
      <div className="landing-container">
        <div ref={headRef} className="reveal" style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className="landing-eyebrow">The Solution</div>
          <h2 className="landing-h2">
            NOVAX Ops.{' '}
            <span className="text-gradient-aurora">One Command Center.</span>
          </h2>
          <p className="landing-sub-center" style={{ marginTop: 16 }}>
            Every stage. Every tool. Every client. One platform with AI that actually knows your agency.
          </p>
        </div>

        {/* Pipeline flow */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 64, flexWrap: 'wrap', gap: 0 }}>
          {[
            { label: 'Strategy', icon: Target, color: '#5BB4AE' },
            { label: 'Content', icon: FileText, color: '#5BB4AE' },
            { label: 'Review', icon: CheckCircle, color: '#4BB86A' },
            { label: 'Publish', icon: Globe, color: '#5BB4AE' },
            { label: 'Report', icon: BarChart3, color: '#D4A84B' },
          ].map(({ label, icon: Icon, color }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div
                className="animate-fade-in-up"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  animationDelay: `${i * 100}ms`,
                }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${color}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color,
                  boxShadow: `0 0 20px ${color}20`,
                }}>
                  <Icon size={22} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6E9896' }}>
                  {label}
                </span>
              </div>
              {i < 4 && (
                <div style={{ width: 48, height: 1, background: 'linear-gradient(to right, rgba(91,180,174,0.4), rgba(91,180,174,0.15))', margin: '0 4px', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>

        {/* Feature grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 16,
          }}
          className="anim-stagger"
        >
          {[
            {
              icon: Target,
              title: 'Strategy Command Center',
              description: 'Esplanade-format quarterly strategies generated by Claude Opus. PPTX export in seconds. Your strategists produce in hours, not days.',
              badge: 'Claude Opus',
            },
            {
              icon: FileText,
              title: 'Content Studio',
              description: 'Reels, carousels, static posts — with hooks, scripts, and visual direction. AI generates 3 variants per piece and learns from your feedback.',
              badge: 'AI-Powered',
            },
            {
              icon: Brain,
              title: 'Client Intelligence Layer',
              description: 'Every AI prompt is enriched with wins, brand voice, past objections, and signals from each client. Context that actually compounds.',
              badge: 'Learns Over Time',
            },
            {
              icon: Globe,
              title: 'Publishing + Metricool',
              description: 'Compose, schedule, and publish directly to all platforms. Generate a full content calendar for a client in under two minutes.',
              badge: 'Live Integration',
            },
            {
              icon: BarChart3,
              title: 'Auto-Generated Reports',
              description: 'KPI charts, Claude narrative, Metricool data — assembled into a branded PPTX or PDF in one click. No more manual report building.',
              badge: 'AI Narrative',
            },
            {
              icon: Shield,
              title: 'Approval Portal',
              description: 'Shareable token links let clients approve or request changes on every post — with status tracking and email notifications built in.',
              badge: 'Client-Ready',
            },
          ].map(({ icon: Icon, title, description, badge }, i) => (
            <div key={i} className="feature-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div className="feature-icon-wrap">
                  <Icon size={20} />
                </div>
                <div className="feature-pill">{badge}</div>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#E8F0EF', marginBottom: 8, letterSpacing: '-0.01em' }}>
                  {title}
                </div>
                <div style={{ fontSize: 14, color: '#6E9896', lineHeight: 1.6 }}>
                  {description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Bento Features ────────────────────────────────────────────────────────
function BentoSection() {
  const ref = useReveal()
  return (
    <section className="landing-section aurora-canvas" style={{ background: '#04100F' }}>
      <hr className="teal-rule" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
      <div className="landing-container">
        <div ref={ref} className="reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="landing-eyebrow">Full Capability Map</div>
          <h2 className="landing-h2">Everything your agency needs. Nothing it doesn&apos;t.</h2>
        </div>

        <div className="bento-grid anim-stagger-12">
          {/* Large hero card */}
          <div className="bento-card bento-hero" style={{ background: 'linear-gradient(135deg, rgba(27,61,56,0.6), rgba(42,107,98,0.3))' }}>
            <div className="feature-icon-wrap" style={{ background: 'rgba(91,180,174,0.15)', borderColor: 'rgba(91,180,174,0.3)' }}>
              <Sparkles size={22} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#E8F0EF', letterSpacing: '-0.02em' }}>
              AI at Every Stage
            </div>
            <div style={{ fontSize: 14, color: '#9ABCBA', lineHeight: 1.65, maxWidth: 340 }}>
              From brief analysis to post-mortem diagnosis — Claude is embedded at every stage of your workflow, not bolted on as an afterthought.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
              {['Task Analyzer', 'Copywriter', 'Researcher', 'Hook Lab', 'Boss Brief'].map(t => (
                <span key={t} className="feature-pill" style={{ fontSize: 10 }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Standard cards */}
          {[
            { icon: Video, title: 'Visual Content Engine', desc: 'Scene-by-scene prompts for Higgsfield AI video generation.' },
            { icon: MessageSquare, title: 'Comment Moderation', desc: 'AI-drafted replies to every comment and DM.' },
            { icon: TrendingUp, title: 'Hook Lab', desc: '20 hooks → 3C scoring → SCAMPER → top 3 winners.' },
            { icon: Users, title: 'Workload View', desc: 'Per-member load bars. Spot bottlenecks before they happen.' },
            { icon: Target, title: 'Campaign Igniter', desc: 'Cultural tensions → 5 breakthrough execution briefs.' },
            { icon: Shield, title: 'Crisis Mode', desc: 'One-click client crisis state with full audit trail.' },
            { icon: Brain, title: 'CEO Hub', desc: 'Cross-client strategy, second opinions, crisis override.' },
          ].map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="bento-card">
              <div className="feature-icon-wrap">
                <Icon size={18} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#E8F0EF', letterSpacing: '-0.01em' }}>{title}</div>
              <div style={{ fontSize: 12, color: '#6E9896', lineHeight: 1.55 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA Section ───────────────────────────────────────────────────────────
function CTASection() {
  const ref = useReveal()
  return (
    <section className="landing-section" style={{ background: '#030C0B', position: 'relative' }}>
      <hr className="teal-rule" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
      <div className="landing-container">
        <div
          ref={ref}
          className="reveal"
          style={{
            maxWidth: 720,
            margin: '0 auto',
            textAlign: 'center',
            background: 'rgba(27,61,56,0.25)',
            border: '1px solid rgba(91,180,174,0.2)',
            borderRadius: 20,
            padding: '72px 48px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Aurora corner glows */}
          <div style={{
            position: 'absolute', top: -60, right: -60,
            width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(91,180,174,0.18) 0%, transparent 70%)',
            filter: 'blur(20px)', pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -60, left: -60,
            width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(42,107,98,0.15) 0%, transparent 70%)',
            filter: 'blur(20px)', pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="landing-eyebrow" style={{ marginBottom: 20 }}>Your Next Step</div>
            <h2 className="landing-h2" style={{ marginBottom: 20 }}>
              Your agency is{' '}
              <span className="text-gradient-aurora">ready for this.</span>
            </h2>
            <p className="landing-sub-center" style={{ marginBottom: 36 }}>
              Stop fighting your tools. Start commanding your workflow. NOVAX Ops is live and waiting for your team.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/login" className="btn-cta-primary">
                Sign In to NOVAX Ops <ArrowRight size={16} />
              </a>
            </div>
            <p style={{ marginTop: 24, fontSize: 12, color: '#3D5A57', letterSpacing: '0.03em' }}>
              Secured by Supabase Auth · No third-party data sharing · Self-hosted
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid rgba(255,255,255,0.06)',
      background: '#030C0B',
      padding: '32px 0',
    }}>
      <div className="landing-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'linear-gradient(135deg, #1B3D38, #2A6B62)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#5BB4AE',
          }}>
            N
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#4E6D6A', letterSpacing: '-0.01em' }}>
            NOVAX OPS
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#3A5250' }}>
          Built for NOVAX Agency · {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div style={{ background: '#04100F', minHeight: '100vh', fontFamily: 'var(--font-sans, system-ui)' }}>
      <Nav />
      <Hero />
      <ProblemSection />
      <AgitateSection />
      <SolutionSection />
      <BentoSection />
      <CTASection />
      <Footer />
    </div>
  )
}
