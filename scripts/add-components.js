const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', '(app)', 'reports', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the RecommendationsList closing to inject new components after it
const marker = `function RecommendationsList({ items }: { items: string[] }) {
  return (
    <div className="space-y-3">
      {items.map((rec, i) => (
        <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ background: B.light }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold text-white" style={{ background: B.primary }}>
            {i + 1}
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{rec}</p>
        </div>
      ))}
    </div>
  )
}`;

const newComponents = `function RecommendationsList({ items }: { items: string[] }) {
  return (
    <div className="space-y-3">
      {items.map((rec, i) => (
        <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ background: B.light }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold text-white" style={{ background: B.primary }}>
            {i + 1}
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{rec}</p>
        </div>
      ))}
    </div>
  )
}

function CoverPage({ title, subtitle, client, period, tag }: { title: string; subtitle: string; client: string; period: string; tag: string }) {
  return (
    <div className="report-cover-page rounded-2xl overflow-hidden flex flex-col" style={{ background: B.primary }}>
      <div className="h-2" style={{ background: \`linear-gradient(90deg, \${B.accent}, \${B.border}, \${B.light})\` }}/>
      <div className="px-12 pt-12 flex items-center gap-4">
        <svg width="52" height="52" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="white" fillOpacity="0.12"/>
          <path d="M8 24V8l6 16 6-16v16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="24" cy="16" r="3" fill={B.accent}/>
        </svg>
        <div>
          <p className="text-white font-bold text-2xl leading-none">NOVAX</p>
          <p className="text-xs font-semibold mt-1 uppercase tracking-widest" style={{ color: B.accent }}>OPS PLATFORM</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center px-12 py-20">
        <div className="w-20 h-0.5 rounded-full mb-8" style={{ background: B.accent }}/>
        <p className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: B.border }}>{tag}</p>
        <h1 className="text-5xl font-bold text-white leading-tight mb-6">{title}</h1>
        <p className="text-lg leading-relaxed max-w-lg" style={{ color: B.border }}>{subtitle}</p>
      </div>
      <div className="px-12 pb-10 flex items-end justify-between border-t border-white/10 pt-6">
        <div>
          <p className="font-bold text-white text-xl">{client}</p>
          <p className="text-sm mt-1" style={{ color: B.border }}>{period}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold" style={{ color: B.border }}>Prepared by NOVAX Ops</p>
          <p className="text-xs mt-1 text-white opacity-40">Confidential — Not for Distribution</p>
        </div>
      </div>
      <div className="h-2" style={{ background: \`linear-gradient(90deg, \${B.light}, \${B.border}, \${B.accent})\` }}/>
    </div>
  )
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-600 leading-7 mb-4 last:mb-0">{children}</p>
}

const PRIORITY_BADGE: Record<string, string> = { high: 'bg-red-50 text-red-700', medium: 'bg-amber-50 text-amber-700', low: 'bg-slate-100 text-slate-500' }
const SIGNAL_BADGE:   Record<string, string> = { good: 'bg-emerald-50 text-emerald-700', warning: 'bg-amber-50 text-amber-700', poor: 'bg-red-50 text-red-700' }

function KPIComparisonTable({ rows }: { rows: KPIRow[] }) {
  const heads = ['Metric', 'Current Period', 'Prior Period', 'MoM Change', 'Industry Benchmark', 'vs Benchmark']
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: B.light }}>
            {heads.map((h, i) => (
              <th key={h} className={cn('p-3 text-xs font-semibold', i === 0 ? 'text-left' : 'text-right')} style={{ color: B.primary }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cn('border-t border-slate-50', i % 2 === 1 && 'bg-slate-50/50')}>
              <td className="p-3 font-medium text-slate-700">{r.metric}</td>
              <td className="p-3 text-right font-bold text-slate-900">{r.current}</td>
              <td className="p-3 text-right text-slate-500">{r.previous}</td>
              <td className="p-3 text-right"><DeltaBadge delta={r.delta} positive={r.positive}/></td>
              <td className="p-3 text-right text-slate-400">{r.benchmark}</td>
              <td className="p-3 text-right"><DeltaBadge delta={r.vsBenchmark} positive={r.vsBenchmarkPositive}/></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ActionPlanTable({ items }: { items: ActionRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: B.light }}>
            {['Action', 'Owner', 'Deadline', 'Expected Impact', 'Priority'].map((h, i) => (
              <th key={h} className={cn('p-3 text-xs font-semibold', i < 4 ? 'text-left' : 'text-center')} style={{ color: B.primary }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((r, i) => (
            <tr key={i} className={cn('border-t border-slate-50', i % 2 === 1 && 'bg-slate-50/50')}>
              <td className="p-3 font-medium text-slate-800">{r.action}</td>
              <td className="p-3 text-slate-600 text-xs whitespace-nowrap">{r.owner}</td>
              <td className="p-3 text-slate-600 text-xs whitespace-nowrap">{r.deadline}</td>
              <td className="p-3 text-slate-600 text-xs">{r.impact}</td>
              <td className="p-3 text-center"><span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', PRIORITY_BADGE[r.priority])}>{r.priority}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AudienceSignalsTable({ signals }: { signals: AudienceRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: B.light }}>
            {['Audience Signal', 'Value', 'Benchmark', 'Status', 'Interpretation'].map((h, i) => (
              <th key={h} className={cn('p-3 text-xs font-semibold', i === 0 || i === 4 ? 'text-left' : i === 3 ? 'text-center' : 'text-right')} style={{ color: B.primary }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {signals.map((s, i) => (
            <tr key={i} className={cn('border-t border-slate-50', i % 2 === 1 && 'bg-slate-50/50')}>
              <td className="p-3 font-medium text-slate-700">{s.signal}</td>
              <td className="p-3 text-right font-bold text-slate-900">{s.value}</td>
              <td className="p-3 text-right text-slate-400">{s.benchmark}</td>
              <td className="p-3 text-center"><span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', SIGNAL_BADGE[s.status])}>{s.status}</span></td>
              <td className="p-3 text-slate-600 text-xs leading-relaxed">{s.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}`;

if (content.includes(marker)) {
  const updated = content.replace(marker, newComponents);
  fs.writeFileSync(filePath, updated, 'utf8');
  console.log('SUCCESS - new components added');
} else {
  console.log('MARKER NOT FOUND');
  // Print a snippet to debug
  const idx = content.indexOf('function RecommendationsList');
  if (idx >= 0) {
    console.log('Found at index:', idx);
    console.log(content.substring(idx, idx + 200));
  }
}
