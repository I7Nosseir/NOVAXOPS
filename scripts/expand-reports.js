const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', '(app)', 'reports', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// ─── Helper: replace a function body ─────────────────────────────────────────
function replaceFn(oldFn, newFn) {
  if (content.includes(oldFn)) {
    content = content.replace(oldFn, newFn);
    return true;
  }
  return false;
}

// ─── 1. MONTHLY REPORT ────────────────────────────────────────────────────────
const OLD_MONTHLY = `function MonthlyReport({ client }: { client: string }) {
  const d = MONTHLY_DEMO
  const maxReach = Math.max(...d.platforms.map(p => p.reach))
  return (
    <div className="space-y-5">
      <ReportHeader title="Monthly Performance Report" subtitle="Organic social media performance across all platforms" client={client} period={d.period}/>`;

const NEW_MONTHLY = `function MonthlyReport({ client }: { client: string }) {
  const d = MONTHLY_DEMO
  const maxReach = Math.max(...d.platforms.map(p => p.reach))
  return (
    <div className="space-y-5">
      <CoverPage
        tag="Monthly Performance Report"
        title="Organic Social Media Performance"
        subtitle="Platform-by-platform analysis of reach, engagement, content quality, audience health, and strategic recommendations."
        client={client}
        period={d.period}
      />
      <ReportHeader title="Monthly Performance Report" subtitle="Organic social media performance across all platforms" client={client} period={d.period}/>

      {/* Executive Narrative */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionHeader title="Executive Summary" subtitle="Key findings — May 2026"/>
        <Paragraph>{d.narrative.executive}</Paragraph>
        <Paragraph>{d.narrative.reach}</Paragraph>
        <Paragraph>{d.narrative.engagement}</Paragraph>
      </div>`;

const ok1 = replaceFn(OLD_MONTHLY, NEW_MONTHLY);
console.log('MonthlyReport header:', ok1 ? 'OK' : 'NOT FOUND');

// Find and replace the top posts section in MonthlyReport to add more depth
const OLD_MONTHLY_TOPPOSTS = `      {/* Top posts */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Top Performing Posts" subtitle="Highest-reach content this month"/>
        <div className="space-y-3">
          {d.topPosts.map((post, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5" style={{ background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : '#a16207' }}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 break-words">{post.caption}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{post.platform} · {post.type}</p>
              </div>
              <div className="flex items-center gap-5 text-xs shrink-0">
                <div className="text-right"><p className="font-bold text-slate-800">{formatNumber(post.reach)}</p><p className="text-slate-400">reach</p></div>
                <div className="text-right"><p className="font-bold" style={{ color: B.primary }}>{post.er}%</p><p className="text-slate-400">ER</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Strategic Recommendations" subtitle="Evidence-based actions for next month"/>
        <RecommendationsList items={d.recommendations}/>
      </div>
    </div>
  )
}`;

const NEW_MONTHLY_TOPPOSTS = `      {/* KPI Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Full KPI Comparison" subtitle="Current period vs prior period and industry benchmark"/>
        <KPIComparisonTable rows={d.kpiComparison}/>
      </div>

      {/* Top posts */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Top 5 Performing Posts" subtitle="Analysis of what drove performance"/>
        <div className="space-y-3">
          {d.topPosts.map((post, i) => (
            <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50">
              <div className="flex items-start gap-4">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5" style={{ background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#78716c' : B.muted }}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 break-words">{post.caption}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{post.platform} · {post.type}</p>
                </div>
                <div className="flex items-center gap-5 text-xs shrink-0">
                  <div className="text-right"><p className="font-bold text-slate-800">{formatNumber(post.reach)}</p><p className="text-slate-400">reach</p></div>
                  <div className="text-right"><p className="font-bold" style={{ color: B.primary }}>{post.er}%</p><p className="text-slate-400">ER</p></div>
                </div>
              </div>
              {post.why && (
                <div className="mt-3 pl-11">
                  <p className="text-xs text-slate-500 leading-relaxed"><span className="font-semibold" style={{ color: B.muted }}>Why it worked: </span>{post.why}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom posts */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Content Audit — Underperformers" subtitle="Lowest-reach posts with root cause diagnosis"/>
        <div className="space-y-3">
          {d.bottomPosts.map((post, i) => (
            <div key={i} className="p-4 rounded-xl border border-red-50 bg-red-50/30">
              <div className="flex items-start gap-4">
                <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-600 shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 break-words">{post.caption}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{post.platform} · {post.type}</p>
                </div>
                <div className="flex items-center gap-5 text-xs shrink-0">
                  <div className="text-right"><p className="font-bold text-slate-800">{formatNumber(post.reach)}</p><p className="text-slate-400">reach</p></div>
                  <div className="text-right"><p className="font-bold text-red-500">{post.er}%</p><p className="text-slate-400">ER</p></div>
                </div>
              </div>
              <div className="mt-3 pl-11">
                <p className="text-xs text-slate-500 leading-relaxed"><span className="font-semibold text-red-600">Diagnosis: </span>{post.diagnosis}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audience Quality */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Audience Quality Signals" subtitle="Health indicators beyond reach and engagement rate"/>
        <AudienceSignalsTable signals={d.audienceSignals}/>
      </div>

      {/* Competitor Benchmarks */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Competitive Benchmarking" subtitle="Luxe Cosmetics vs category peers on Instagram"/>
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: B.light }}>
                {['Brand', 'Followers', 'Avg ER', 'Posts/Week', 'Avg Reach/Post'].map((h, i) => (
                  <th key={h} className={cn('p-3 text-xs font-semibold', i === 0 ? 'text-left' : 'text-right')} style={{ color: B.primary }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.competitors.map((c, i) => (
                <tr key={i} className={cn('border-t border-slate-50', c.client === 'Luxe Cosmetics' ? 'font-semibold' : '', i % 2 === 1 && 'bg-slate-50/50')}>
                  <td className="p-3" style={{ color: c.client === 'Luxe Cosmetics' ? B.primary : '' }}>{c.name}</td>
                  <td className="p-3 text-right text-slate-700">{c.followers}</td>
                  <td className="p-3 text-right font-bold" style={{ color: c.name === 'Luxe Cosmetics' ? B.primary : '#475569' }}>{c.er}</td>
                  <td className="p-3 text-right text-slate-600">{c.posts}</td>
                  <td className="p-3 text-right text-slate-600">{c.avgReach}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-3 italic">Note: Luxe Cosmetics ER of 6.8% outperforms all listed competitors despite a 200–330× smaller follower base — a strong signal of content quality and audience fit.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Strategic Recommendations" subtitle="Evidence-based actions for next month"/>
        <RecommendationsList items={d.recommendations}/>
      </div>

      {/* Action Plan */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="30-Day Action Plan" subtitle="Prioritised actions with owners and expected impact"/>
        <ActionPlanTable items={d.actionPlan}/>
      </div>
    </div>
  )
}`;

const ok2 = replaceFn(OLD_MONTHLY_TOPPOSTS, NEW_MONTHLY_TOPPOSTS);
console.log('MonthlyReport bottom sections:', ok2 ? 'OK' : 'NOT FOUND');

// ─── 2. PAID REPORT ────────────────────────────────────────────────────────────
const OLD_PAID_END = `      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Strategic Recommendations" subtitle="Priority optimisations for next month"/>
        <RecommendationsList items={d.recommendations}/>
      </div>
    </div>
  )
}

// ─── Combined Report`;

const NEW_PAID_END = `      {/* KPI Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Full KPI Comparison" subtitle="Current period vs prior period and industry benchmarks"/>
        <KPIComparisonTable rows={d.kpiComparison}/>
      </div>

      {/* Performance Narrative */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionHeader title="Performance Analysis" subtitle="Analyst commentary on efficiency, creative, and audience"/>
        <Paragraph>{d.narrative.executive}</Paragraph>
        <Paragraph>{d.narrative.efficiency}</Paragraph>
        <Paragraph>{d.narrative.creative}</Paragraph>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Strategic Recommendations" subtitle="Priority optimisations for next month"/>
        <RecommendationsList items={d.recommendations}/>
      </div>

      {/* Action Plan */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="30-Day Paid Media Action Plan" subtitle="Prioritised actions with owners and expected impact"/>
        <ActionPlanTable items={d.actionPlan}/>
      </div>
    </div>
  )
}

// ─── Combined Report`;

const ok3 = replaceFn(OLD_PAID_END, NEW_PAID_END);
console.log('PaidReport end sections:', ok3 ? 'OK' : 'NOT FOUND');

// Add cover page to PaidReport
const OLD_PAID_HEADER = `    <div className="space-y-5">
      <ReportHeader title="Paid Media Performance Report" subtitle="Campaign analytics, ROAS, and creative performance" client={client} period={d.period}/>`;

const NEW_PAID_HEADER = `    <div className="space-y-5">
      <CoverPage
        tag="Paid Media Performance Report"
        title="Paid Advertising Analysis"
        subtitle="Campaign ROAS, efficiency metrics, creative performance, audience segmentation, and budget optimisation plan."
        client={client}
        period={d.period}
      />
      <ReportHeader title="Paid Media Performance Report" subtitle="Campaign analytics, ROAS, and creative performance" client={client} period={d.period}/>`;

const ok4 = replaceFn(OLD_PAID_HEADER, NEW_PAID_HEADER);
console.log('PaidReport cover page:', ok4 ? 'OK' : 'NOT FOUND');

// ─── 3. COMBINED REPORT ───────────────────────────────────────────────────────
const OLD_COMBINED_HEADER = `    <div className="space-y-5">
      <ReportHeader title="Paid + Organic Combined Report" subtitle="Blended reach, investment breakdown, and channel mix" client={client} period={d.period}/>`;

const NEW_COMBINED_HEADER = `    <div className="space-y-5">
      <CoverPage
        tag="Paid + Organic Combined Report"
        title="Blended Channel Performance"
        subtitle="Total reach analysis, paid vs organic split, channel efficiency, investment breakdown, and cross-channel synergy opportunities."
        client={client}
        period={d.period}
      />
      <ReportHeader title="Paid + Organic Combined Report" subtitle="Blended reach, investment breakdown, and channel mix" client={client} period={d.period}/>`;

const ok5 = replaceFn(OLD_COMBINED_HEADER, NEW_COMBINED_HEADER);
console.log('CombinedReport cover page:', ok5 ? 'OK' : 'NOT FOUND');

const OLD_COMBINED_END = `      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Strategic Recommendations" subtitle="Organic + paid optimisation priorities"/>
        <RecommendationsList items={d.recommendations}/>
      </div>
    </div>
  )
}

// ─── Platform Deep Dive`;

const NEW_COMBINED_END = `      {/* KPI Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Full KPI Comparison" subtitle="Blended metrics vs prior period and benchmarks"/>
        <KPIComparisonTable rows={d.kpiComparison}/>
      </div>

      {/* Narrative */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionHeader title="Channel Performance Analysis" subtitle="Executive commentary, synergy insights, and channel balance"/>
        <Paragraph>{d.narrative.executive}</Paragraph>
        <Paragraph>{d.narrative.synergy}</Paragraph>
        <Paragraph>{d.narrative.channel}</Paragraph>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Strategic Recommendations" subtitle="Organic + paid optimisation priorities"/>
        <RecommendationsList items={d.recommendations}/>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="30-Day Cross-Channel Action Plan" subtitle="Coordinated paid and organic actions with owners"/>
        <ActionPlanTable items={d.actionPlan}/>
      </div>
    </div>
  )
}

// ─── Platform Deep Dive`;

const ok6 = replaceFn(OLD_COMBINED_END, NEW_COMBINED_END);
console.log('CombinedReport end sections:', ok6 ? 'OK' : 'NOT FOUND');

// ─── 4. PLATFORM REPORT ──────────────────────────────────────────────────────
const OLD_PLATFORM_HEADER = `    <div className="space-y-5">
      <ReportHeader title="Instagram Deep Dive Report" subtitle="Format performance, follower growth, best days and hashtag analysis" client={client} period={d.period}/>`;

const NEW_PLATFORM_HEADER = `    <div className="space-y-5">
      <CoverPage
        tag="Platform Deep Dive — Instagram"
        title="Instagram Account Analysis"
        subtitle="Follower growth, format performance, best posting days, hashtag effectiveness, audience quality signals, and strategic recommendations."
        client={client}
        period={d.period}
      />
      <ReportHeader title="Instagram Deep Dive Report" subtitle="Format performance, follower growth, best days and hashtag analysis" client={client} period={d.period}/>`;

const ok7 = replaceFn(OLD_PLATFORM_HEADER, NEW_PLATFORM_HEADER);
console.log('PlatformReport cover page:', ok7 ? 'OK' : 'NOT FOUND');

const OLD_PLATFORM_END = `      </div>
    </div>
  )
}

// ─── Quarterly Report`;

const NEW_PLATFORM_END = `      </div>

      {/* KPI Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Full KPI Comparison" subtitle="Current month vs prior month and Instagram benchmarks"/>
        <KPIComparisonTable rows={d.kpiComparison}/>
      </div>

      {/* Narrative */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionHeader title="Performance Analysis" subtitle="Account health, format insights, and hashtag strategy"/>
        <Paragraph>{d.narrative.executive}</Paragraph>
        <Paragraph>{d.narrative.formats}</Paragraph>
        <Paragraph>{d.narrative.hashtags}</Paragraph>
      </div>

      {/* Audience Quality */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Audience Quality Signals" subtitle="Instagram-specific health indicators"/>
        <AudienceSignalsTable signals={d.audienceSignals}/>
      </div>

      {/* Action Plan */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="30-Day Instagram Action Plan" subtitle="Prioritised actions with owners and expected impact"/>
        <ActionPlanTable items={d.actionPlan}/>
      </div>
    </div>
  )
}

// ─── Quarterly Report`;

const ok8 = replaceFn(OLD_PLATFORM_END, NEW_PLATFORM_END);
console.log('PlatformReport end sections:', ok8 ? 'OK' : 'NOT FOUND');

// ─── 5. QUARTERLY REPORT ─────────────────────────────────────────────────────
const OLD_QUARTERLY_HEADER = `    <div className="space-y-5">
      <ReportHeader title="Quarterly Performance Report" subtitle="OKR scorecard, campaign highlights, and next-quarter priorities" client={client} period={d.quarter}/>`;

const NEW_QUARTERLY_HEADER = `    <div className="space-y-5">
      <CoverPage
        tag="Quarterly Performance Report"
        title="Q1 2026 Strategy Review"
        subtitle="OKR scorecard, monthly performance trajectory, campaign highlights, competitive analysis, and Q2 strategic priorities."
        client={client}
        period={d.quarter}
      />
      <ReportHeader title="Quarterly Performance Report" subtitle="OKR scorecard, campaign highlights, and next-quarter priorities" client={client} period={d.quarter}/>`;

const ok9 = replaceFn(OLD_QUARTERLY_HEADER, NEW_QUARTERLY_HEADER);
console.log('QuarterlyReport cover page:', ok9 ? 'OK' : 'NOT FOUND');

const OLD_QUARTERLY_END = `      </div>
    </div>
  )
}

// ─── Executive Summary`;

const NEW_QUARTERLY_END = `      </div>

      {/* KPI Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Full KPI Comparison" subtitle="Q1 2026 vs Q4 2025 and annual benchmark"/>
        <KPIComparisonTable rows={d.kpiComparison}/>
      </div>

      {/* Narrative */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionHeader title="Quarter Performance Analysis" subtitle="Executive commentary, momentum assessment, and campaign learnings"/>
        <Paragraph>{d.narrative.executive}</Paragraph>
        <Paragraph>{d.narrative.trend}</Paragraph>
        <Paragraph>{d.narrative.priorities}</Paragraph>
      </div>

      {/* Q2 Priorities */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Q2 Strategic Priorities" subtitle="Three focus areas for April–June 2026"/>
        <div className="space-y-3">
          {d.q2Priorities.map((p, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-slate-100">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: B.primary }}>{i + 1}</div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{p.priority}</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{p.rationale}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Plan */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Q2 Action Plan" subtitle="Key milestones with owners and expected impact"/>
        <ActionPlanTable items={d.actionPlan}/>
      </div>
    </div>
  )
}

// ─── Executive Summary`;

const ok10 = replaceFn(OLD_QUARTERLY_END, NEW_QUARTERLY_END);
console.log('QuarterlyReport end sections:', ok10 ? 'OK' : 'NOT FOUND');

// ─── 6. EXECUTIVE REPORT ─────────────────────────────────────────────────────
const OLD_EXEC_HEADER = `    <div className="space-y-5">
      <ReportHeader title="Executive Summary" subtitle="CEO-ready portfolio overview — all clients" client={client} period={d.period}/>`;

const NEW_EXEC_HEADER = `    <div className="space-y-5">
      <CoverPage
        tag="Executive Summary"
        title="Portfolio Performance Overview"
        subtitle="CEO-ready monthly snapshot: all-client KPIs, portfolio wins, growth opportunities, client health scorecard, and single priority action."
        client={client}
        period={d.period}
      />
      <ReportHeader title="Executive Summary" subtitle="CEO-ready portfolio overview — all clients" client={client} period={d.period}/>`;

const ok11 = replaceFn(OLD_EXEC_HEADER, NEW_EXEC_HEADER);
console.log('ExecutiveReport cover page:', ok11 ? 'OK' : 'NOT FOUND');

// Add client breakdown + narrative to Executive Report end
const OLD_EXEC_END = `      <div className="rounded-2xl p-6" style={{ background: B.primary }}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <Zap className="w-4 h-4 text-white"/>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: B.accent }}>Priority Action — Next 30 Days</p>
            <p className="text-white text-sm leading-relaxed">{d.action}</p>
          </div>
        </div>
      </div>
    </div>
  )
}`;

const NEW_EXEC_END = `      {/* Client health table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <SectionHeader title="Client Health Scorecard" subtitle="May 2026 — all active accounts"/>
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: B.light }}>
                {['Client', 'Organic Reach', 'Avg ER', 'Paid ROAS', 'Status'].map((h, i) => (
                  <th key={h} className={cn('p-3 text-xs font-semibold', i < 4 ? 'text-left' : 'text-center')} style={{ color: B.primary }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.clientBreakdown.map((c, i) => {
                const statusStyle = { ahead: 'bg-emerald-50 text-emerald-700', 'on-track': 'bg-blue-50 text-blue-700', 'at-risk': 'bg-red-50 text-red-700' }
                return (
                  <tr key={i} className={cn('border-t border-slate-50', i % 2 === 1 && 'bg-slate-50/50')}>
                    <td className="p-3 font-semibold text-slate-800">{c.client}</td>
                    <td className="p-3 text-slate-700">{c.reach}</td>
                    <td className="p-3 font-bold" style={{ color: B.primary }}>{c.er}</td>
                    <td className="p-3 text-slate-700">{c.roas}</td>
                    <td className="p-3">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', statusStyle[c.status])}>{c.status.replace('-', ' ')}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Portfolio narrative */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <SectionHeader title="Portfolio Analysis" subtitle="Month-in-review commentary"/>
        <Paragraph>{d.narrative.portfolio}</Paragraph>
        <Paragraph>{d.narrative.highlights}</Paragraph>
      </div>

      <div className="rounded-2xl p-6" style={{ background: B.primary }}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <Zap className="w-4 h-4 text-white"/>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: B.accent }}>Priority Action — Next 30 Days</p>
            <p className="text-white text-sm leading-relaxed">{d.action}</p>
          </div>
        </div>
      </div>
    </div>
  )
}`;

const ok12 = replaceFn(OLD_EXEC_END, NEW_EXEC_END);
console.log('ExecutiveReport end sections:', ok12 ? 'OK' : 'NOT FOUND');

// Write the result
fs.writeFileSync(filePath, content, 'utf8');
console.log('\nAll done. Results summary:');
console.log('MonthlyReport header:', ok1);
console.log('MonthlyReport bottom:', ok2);
console.log('PaidReport cover:', ok4);
console.log('PaidReport end:', ok3);
console.log('CombinedReport cover:', ok5);
console.log('CombinedReport end:', ok6);
console.log('PlatformReport cover:', ok7);
console.log('PlatformReport end:', ok8);
console.log('QuarterlyReport cover:', ok9);
console.log('QuarterlyReport end:', ok10);
console.log('ExecutiveReport cover:', ok11);
console.log('ExecutiveReport end:', ok12);
