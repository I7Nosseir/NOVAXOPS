// ============================================================
// Studio Export — TXT download + Print/PDF
// Client-side only — both functions guard against SSR.
// ============================================================

import type {
  StudioSession,
  ContentDocument,
  HookDocument,
  StrategyDocument,
  CampaignDocument,
  PostMortemDiagnosis,
  BossBrief,
  HookItem,
} from './studio-types'

// ── Helpers ───────────────────────────────────────────────────

function line(char = '─', length = 64): string {
  return char.repeat(length)
}

function section(title: string): string {
  return `\n${line()}\n${title.toUpperCase()}\n${line()}\n`
}

function formatBossBrief(brief: BossBrief): string {
  let out = section('BOSS BRIEF — 30-second version')
  out += `WHAT WE MADE\n${brief.what_we_made}\n\n`
  out += `WHY IT WORKS\n${brief.why_it_works}\n\n`
  out += `THE ONE THING\n${brief.the_one_thing}\n\n`
  out += `DO THIS NOW\n${brief.do_this_now}\n`
  if (brief.watch_out_for) {
    out += `\nWATCH OUT FOR\n${brief.watch_out_for}\n`
  }
  return out
}

// ── Tool-specific formatters ──────────────────────────────────

function formatContent(outputs: Record<string, unknown>, clientName: string): string {
  const doc = outputs.content as ContentDocument | undefined
  if (!doc) return '[Content document not available]\n'

  let out = ''

  if (doc.hook) {
    out += section(`SELECTED HOOK  [${doc.hook.tier}-tier · Score ${doc.hook.score}/30]`)
    out += `${doc.hook.text}\n`
    out += `\nType: ${doc.hook.type}\n`
    out += `3C Scores — Clarity: ${doc.hook.clarity}/10 · Context: ${doc.hook.context}/10 · Curiosity: ${doc.hook.curiosity}/10\n`
    out += `Why selected: ${doc.hook.why_selected}\n`
  } else if (doc.selected_hook) {
    out += section(`SELECTED HOOK  [${doc.selected_hook.virality_tier}-tier · Score ${doc.selected_hook.total_score}/30]`)
    out += `${doc.selected_hook.hook_text}\n`
    out += `Why selected: ${doc.selected_hook.why_selected}\n`
  }

  if (doc.audience_intelligence) {
    out += section('AUDIENCE INTELLIGENCE')
    out += `Functional job:  ${doc.audience_intelligence.functional_job}\n`
    out += `Emotional job:   ${doc.audience_intelligence.emotional_job}\n`
    out += `Social job:      ${doc.audience_intelligence.social_job}\n`
    if (doc.audience_intelligence.key_insights?.length) {
      out += `\nKey insights:\n`
      doc.audience_intelligence.key_insights.forEach((i) => { out += `  · ${i}\n` })
    }
  }

  const scriptSections = doc.script_sections ?? doc.script?.sections
  if (scriptSections?.length) {
    out += section(`THE SCRIPT  [${doc.total_duration ?? doc.script?.total_duration ?? ''} · ${doc.production_difficulty ?? doc.script?.production_difficulty ?? ''}]`)
  }
  scriptSections?.forEach((s) => {
    out += `\n── ${s.section.toUpperCase()} [${s.duration_estimate}] ──\n`
    s.lines.forEach((l) => { out += `${l}\n` })
    if (s.visual_note) out += `  [VISUAL: ${s.visual_note}]\n`
  })

  const brollList = doc.key_broll_list ?? doc.broll_list
  if (brollList?.length) {
    out += section('B-ROLL NEEDED')
    brollList.forEach((shot) => { out += `  · ${shot}\n` })
  }

  const caption = doc.caption_preview ?? doc.caption
  if (caption) {
    out += section('CAPTION')
    out += `${caption}\n`
  }

  if (doc.brand_compliance_notes) {
    out += section('BRAND COMPLIANCE NOTES')
    out += `${doc.brand_compliance_notes}\n`
  }

  if (doc.platform_notes && Object.keys(doc.platform_notes).length) {
    out += section('PLATFORM NOTES')
    Object.entries(doc.platform_notes).forEach(([platform, note]) => {
      out += `${platform.toUpperCase()}: ${note}\n`
    })
  }

  return out
}

function formatHooks(outputs: Record<string, unknown>): string {
  const doc = outputs.hooks as HookDocument | undefined
  if (!doc) return '[Hook document not available]\n'

  let out = section(`HOOK LAB — ${doc.generated_count} hooks generated · ${doc.top_tier_count} S-tier`)

  ;(doc.hooks as HookItem[]).forEach((h) => {
    const scamper = h.scamper_applied ? ` [SCAMPER: ${h.scamper_applied}]` : ''
    out += `\n#${h.rank ?? '-'} [${h.tier ?? (h as unknown as {virality_tier: string}).virality_tier ?? '?'}]  Score: ${h.total_score}/30${scamper}\n`
    out += `${h.hook_text}\n`
    out += `  Type: ${h.hook_type} · Format: ${h.format ?? ''}\n`
    const clarity   = h.clarity   ?? (h as unknown as {clarity_score: number}).clarity_score   ?? 0
    const context   = h.context   ?? (h as unknown as {context_score: number}).context_score   ?? 0
    const curiosity = h.curiosity ?? (h as unknown as {curiosity_score: number}).curiosity_score ?? 0
    out += `  Clarity: ${clarity}/10 · Context: ${context}/10 · Curiosity: ${curiosity}/10\n`
  })

  return out
}

function formatStrategy(outputs: Record<string, unknown>): string {
  const doc = outputs.strategy as StrategyDocument | undefined
  if (!doc) return '[Strategy document not available]\n'

  let out = section('EXECUTIVE SUMMARY')
  out += `${doc.executive_summary}\n`

  doc.phases.forEach((phase) => {
    out += section(`PHASE: ${phase.name}  [${phase.diamond_position}]`)
    out += `Key insight: ${phase.key_insight}\n`
    if (phase.content && typeof phase.content === 'object') {
      Object.entries(phase.content).forEach(([k, v]) => {
        out += `\n${k.replace(/_/g, ' ').toUpperCase()}\n`
        if (Array.isArray(v)) {
          v.forEach((item) => { out += `  · ${typeof item === 'object' ? JSON.stringify(item) : item}\n` })
        } else {
          out += `${v}\n`
        }
      })
    }
  })

  return out
}

function formatCampaign(outputs: Record<string, unknown>): string {
  const doc = outputs.campaign as CampaignDocument | undefined
  if (!doc) return '[Campaign document not available]\n'

  let out = section('CULTURAL TENSIONS IDENTIFIED')
  doc.cultural_tensions?.forEach((t, i) => {
    out += `\n[${i + 1}] ${t.tension}\n`
    out += `    Evidence: ${t.evidence}\n`
    out += `    Opportunity: ${t.opportunity}\n`
  })

  out += section('INDUSTRY RULES INVERTED')
  doc.inverted_rules?.forEach((r, i) => {
    out += `\n[${i + 1}] Rule:      ${r.rule}\n`
    out += `    Inversion: ${r.inversion}\n`
  })

  if (doc.creative_domains?.length) {
    out += section('CREATIVE DOMAINS USED')
    doc.creative_domains.forEach((d) => { out += `  · ${d}\n` })
  }

  doc.concepts?.forEach((c, i) => {
    out += section(`CAMPAIGN CONCEPT ${i + 1}: ${c.campaign_name.toUpperCase()}`)
    out += `Tagline: "${c.tagline}"\n\n`
    out += `Core idea: ${c.core_idea}\n\n`
    out += `Why it works: ${c.why_it_works}\n\n`
    out += `Cultural tension activated: ${c.cultural_tension}\n\n`
    out += `Platform: ${c.platform}\n\n`
    out += `Scores — Boldness: ${c.scoring.boldness}/10 · Implementability: ${c.scoring.implementability}/10 · Virality: ${c.scoring.virality}/10\n`
    out += `Budget: ${c.budget} · Timeline: ${c.timeline}\n\n`
    out += `Execution steps:\n`
    c.execution_steps.forEach((step, s) => { out += `  ${s + 1}. ${step}\n` })
    out += `\nParticipation mechanic:\n${c.participation_mechanic}\n`
    out += `\nThe shareable moment:\n${c.shareable_moment}\n`
    if (c.risk) out += `\nRisk: ${c.risk}\n`
    if (c.mitigation) out += `Mitigation: ${c.mitigation}\n`
  })

  return out
}

function formatPostmortem(outputs: Record<string, unknown>): string {
  const doc = outputs.postmortem as PostMortemDiagnosis | undefined
  if (!doc) return '[Post-mortem document not available]\n'

  const VERDICT_LABELS = {
    likely_cause: 'LIKELY CAUSE',
    contributing: 'CONTRIBUTING FACTOR',
    not_issue: 'NOT THE ISSUE',
  }

  let out = section(`POST-MORTEM: ${doc.session_name}`)
  out += `Platform: ${doc.platform}\n`
  out += `Published: ${doc.published_at}\n`
  out += `Engagement rate: ${doc.engagement_rate}%\n`
  out += `vs. client average: ${doc.vs_client_avg > 0 ? '+' : ''}${doc.vs_client_avg}%\n`

  const analyses = doc.analyses ?? {
    hook:    doc.hook_analysis    ?? { verdict: 'not_issue' as const, finding: '' },
    format:  doc.format_analysis  ?? { verdict: 'not_issue' as const, finding: '' },
    timing:  doc.timing_analysis  ?? { verdict: 'not_issue' as const, finding: '' },
    caption: doc.caption_analysis ?? { verdict: 'not_issue' as const, finding: '' },
  }
  const rows: Array<[string, typeof analyses.hook]> = [
    ['HOOK', analyses.hook],
    ['FORMAT', analyses.format],
    ['TIMING', analyses.timing],
    ['CAPTION', analyses.caption],
  ]

  rows.forEach(([label, analysis]) => {
    out += `\n── ${label}: ${VERDICT_LABELS[analysis.verdict]} ──\n`
    out += `${analysis.finding}\n`
    if (analysis.fix) out += `Fix: ${analysis.fix}\n`
  })

  out += section('VERDICT')
  out += `${doc.verdict}\n`

  if (doc.rerun_constraints && Object.keys(doc.rerun_constraints).length) {
    out += `\nRerun constraints:\n`
    Object.entries(doc.rerun_constraints).forEach(([k, v]) => {
      out += `  ${k}: ${v}\n`
    })
  }

  return out
}

// ── Main export function ──────────────────────────────────────

export function exportSessionToTxt(session: StudioSession, clientName: string): void {
  if (typeof window === 'undefined') return

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  let content = ''

  // Header
  content += `NOVAX STUDIO — SESSION EXPORT\n`
  content += `${line('═')}\n`
  content += `Session:   ${session.name}\n`
  content += `Client:    ${clientName}\n`
  content += `Tool:      ${session.tool.toUpperCase()}\n`
  content += `Status:    ${session.status}\n`
  content += `Exported:  ${dateStr} at ${timeStr}\n`
  content += `${line('═')}\n`

  if (session.brief) {
    content += section('BRIEF')
    content += `${session.brief}\n`
  }

  // Tool-specific document
  switch (session.tool) {
    case 'content':
      content += formatContent(session.outputs, clientName)
      break
    case 'hooks':
      content += formatHooks(session.outputs)
      break
    case 'strategy':
      content += formatStrategy(session.outputs)
      break
    case 'campaign':
      content += formatCampaign(session.outputs)
      break
    case 'postmortem':
      content += formatPostmortem(session.outputs)
      break
    default:
      content += section('OUTPUT')
      content += JSON.stringify(session.outputs, null, 2)
      break
  }

  // Boss Brief (appended to every tool that generates one)
  if (session.boss_brief) {
    content += formatBossBrief(session.boss_brief)
  }

  // Performance data (if available)
  if (session.performance) {
    const p = session.performance
    content += section('PERFORMANCE DATA')
    content += `Platform:          ${p.platform}\n`
    content += `Published:         ${p.published_at}\n`
    content += `Measured:          ${p.measured_at}\n`
    content += `Engagement rate:   ${p.metrics.engagement_rate}%\n`
    content += `Reach:             ${p.metrics.reach.toLocaleString()}\n`
    content += `Impressions:       ${p.metrics.impressions.toLocaleString()}\n`
    content += `Saves:             ${p.metrics.saves.toLocaleString()}\n`
    content += `Shares:            ${p.metrics.shares.toLocaleString()}\n`
    content += `Comments:          ${p.metrics.comments.toLocaleString()}\n`
    if (p.metrics.link_clicks !== undefined) {
      content += `Link clicks:       ${p.metrics.link_clicks.toLocaleString()}\n`
    }
    content += `\nvs. client average:    ${p.vs_client_average > 0 ? '+' : ''}${p.vs_client_average}%\n`
    content += `vs. industry average:  ${p.vs_industry_benchmark > 0 ? '+' : ''}${p.vs_industry_benchmark}%\n`
    content += `Verdict:               ${p.performance_verdict.toUpperCase().replace(/_/g, ' ')}\n`
  }

  // Footer
  content += `\n${line('═')}\n`
  content += `Generated by NOVAX Ops — novax.studio\n`
  content += `${line('═')}\n`

  // Download
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `novax-studio-${session.tool}-${session.name.replace(/\s+/g, '-').toLowerCase()}.txt`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

// ── Print / PDF ───────────────────────────────────────────────

/**
 * Triggers the browser print dialog for the current studio document.
 * CSS class `.no-print` on any element will hide it from the print output.
 * Add `@media print { .no-print { display: none !important; } }` to globals.css.
 */
export function printSessionDocument(): void {
  if (typeof window === 'undefined') return
  window.print()
}
