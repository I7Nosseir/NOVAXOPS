'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Loader2, Save, Zap, Plus, RefreshCw, FileText, Upload, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

interface QuarterStrategy {
  id?: string
  year: number
  quarter: number
  goals: string
  themes: string
  kpis: string
  notes: string
}

interface MonthlyUpdate {
  id?: string
  year: number
  month: number
  content_summary: string
  what_worked: string
  what_didnt: string
  posts_published: number
  notes: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const QUARTER_LABELS: Record<number, string> = { 1: 'Q1 Jan–Mar', 2: 'Q2 Apr–Jun', 3: 'Q3 Jul–Sep', 4: 'Q4 Oct–Dec' }

function currentQuarter() {
  return Math.ceil((new Date().getMonth() + 1) / 3)
}

function currentYear() {
  return new Date().getFullYear()
}

const EMPTY_QUARTER: Omit<QuarterStrategy, 'id'> = {
  year: currentYear(),
  quarter: currentQuarter(),
  goals: '',
  themes: '',
  kpis: '',
  notes: '',
}

const EMPTY_MONTH: Omit<MonthlyUpdate, 'id'> = {
  year: currentYear(),
  month: new Date().getMonth() + 1,
  content_summary: '',
  what_worked: '',
  what_didnt: '',
  posts_published: 0,
  notes: '',
}

function FieldBlock({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400 resize-none"
      />
    </div>
  )
}

export function StrategyTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const now = new Date()

  // Quarter strategy state
  const [qYear, setQYear] = useState(now.getFullYear())
  const [qQuarter, setQQuarter] = useState(currentQuarter())
  const [qStrategy, setQStrategy] = useState<QuarterStrategy | null>(null)
  const [qDraft, setQDraft] = useState<QuarterStrategy>({ ...EMPTY_QUARTER })
  const [qLoading, setQLoading] = useState(false)
  const [qSaving, setQSaving] = useState(false)
  const [qGenerating, setQGenerating] = useState(false)

  // Monthly update state
  const [mYear, setMYear] = useState(now.getFullYear())
  const [mMonth, setMMonth] = useState(now.getMonth() + 1)
  const [mUpdate, setMUpdate] = useState<MonthlyUpdate | null>(null)
  const [mDraft, setMDraft] = useState<MonthlyUpdate>({ ...EMPTY_MONTH })
  const [mLoading, setMLoading] = useState(false)
  const [mSaving, setMSaving] = useState(false)

  const [qOpen, setQOpen] = useState(true)
  const [mOpen, setMOpen] = useState(true)

  // PDF upload state
  const [pdfOpen, setPdfOpen] = useState(false)
  const [pdfUploading, setPdfUploading] = useState(false)
  const [uploadedPdfs, setUploadedPdfs] = useState<{ name: string; url: string; savedAt: string }[]>([])
  const pdfRef = useRef<HTMLInputElement>(null)

  const loadQuarterStrategy = async (year: number, quarter: number) => {
    setQLoading(true)
    try {
      const res = await fetch(`/api/ceo/quarterly-strategy?client_id=${clientId}&year=${year}&quarter=${quarter}`)
      if (res.ok) {
        const data = await res.json() as { data: QuarterStrategy | null }
        setQStrategy(data.data)
        setQDraft(data.data ?? { ...EMPTY_QUARTER, year, quarter })
      }
    } catch { /* non-critical */ }
    finally { setQLoading(false) }
  }

  const loadMonthlyUpdate = async (year: number, month: number) => {
    setMLoading(true)
    try {
      const res = await fetch(`/api/ceo/monthly-update?client_id=${clientId}&year=${year}&month=${month}`)
      if (res.ok) {
        const data = await res.json() as { data: MonthlyUpdate | null }
        setMUpdate(data.data)
        setMDraft(data.data ?? { ...EMPTY_MONTH, year, month })
      }
    } catch { /* non-critical */ }
    finally { setMLoading(false) }
  }

  useEffect(() => { void loadQuarterStrategy(qYear, qQuarter) }, [qYear, qQuarter])
  useEffect(() => { void loadMonthlyUpdate(mYear, mMonth) }, [mYear, mMonth])

  const saveQuarter = async () => {
    setQSaving(true)
    try {
      await fetch('/api/ceo/quarterly-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, ...qDraft }),
      })
      setQStrategy({ ...qDraft })
    } catch { /* non-critical */ }
    finally { setQSaving(false) }
  }

  const saveMonthly = async () => {
    setMSaving(true)
    try {
      await fetch('/api/ceo/monthly-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, ...mDraft }),
      })
      setMUpdate({ ...mDraft })
    } catch { /* non-critical */ }
    finally { setMSaving(false) }
  }

  const generateQuarterWithAI = async () => {
    setQGenerating(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'researcher',
          client: { id: clientId, name: clientName, brand_identity: { tone_of_voice: '', target_audience: '', key_messages: [], industry: '' } },
          task: {
            id: `strategy-${clientId}-Q${qQuarter}-${qYear}`,
            title: `Q${qQuarter} ${qYear} Quarter Strategy for ${clientName}`,
            description: `Generate a quarter strategy for Q${qQuarter} ${qYear} including: goals (what we want to achieve), themes (content and campaign themes), KPIs (specific measurable targets), and strategic notes. Be specific and actionable.`,
            pipeline_stage: 'strategy',
          },
        }),
      })
      const data = await res.json() as { text?: string }
      if (data.text) {
        setQDraft(prev => ({
          ...prev,
          goals: prev.goals || `AI-suggested goals for Q${qQuarter} ${qYear} — review and edit:\n${data.text?.slice(0, 600) ?? ''}`,
        }))
      }
    } catch { /* non-critical */ }
    finally { setQGenerating(false) }
  }

  const handlePdfUpload = async (file: File) => {
    if (!file || file.type !== 'application/pdf') return
    if (!supabase) return
    setPdfUploading(true)
    try {
      const safeName = file.name.replace(/\s+/g, '_')
      const path = `strategy-pdfs/${clientId}/${Date.now()}_${safeName}`
      const { error: upErr } = await supabase.storage
        .from('assets')
        .upload(path, file, { contentType: 'application/pdf' })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(path)
      await fetch(`/api/clients/${clientId}/context-bank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'Client Instructions',
          summary: `Strategy document: ${file.name}`,
          full_text: `Strategy PDF uploaded.\nFilename: ${file.name}\nURL: ${publicUrl}`,
          source_type: 'document',
        }),
      })
      setUploadedPdfs(prev => [...prev, { name: file.name, url: publicUrl, savedAt: new Date().toISOString() }])
    } catch (err) {
      console.error('[strategy-pdf]', err)
    } finally {
      setPdfUploading(false)
      if (pdfRef.current) pdfRef.current.value = ''
    }
  }

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  return (
    <div className="space-y-4">

      {/* Quarter Strategy Section */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setQOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-novax-light hover:bg-novax-light-hover transition-colors"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-novax"/>
            <p className="text-sm font-semibold text-novax">Quarter Strategy</p>
          </div>
          <ChevronDown className={cn('w-4 h-4 text-novax transition-transform', !qOpen && '-rotate-90')}/>
        </button>

        {qOpen && (
          <div className="p-4 space-y-4">
            {/* Quarter + year selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4].map(q => (
                  <button
                    key={q}
                    onClick={() => setQQuarter(q)}
                    className={cn(
                      'px-3 py-1 text-xs font-semibold rounded-lg border transition-all',
                      qQuarter === q ? 'bg-novax text-white border-novax' : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border',
                    )}
                  >
                    Q{q}
                  </button>
                ))}
              </div>
              <select
                value={qYear}
                onChange={e => setQYear(Number(e.target.value))}
                className="px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="text-xs text-slate-400">{QUARTER_LABELS[qQuarter]}</span>
              <button
                onClick={() => void loadQuarterStrategy(qYear, qQuarter)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {qLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <RefreshCw className="w-3.5 h-3.5"/>}
              </button>
            </div>

            {qLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-novax-muted animate-spin"/>
              </div>
            ) : (
              <div className="space-y-3">
                {!qStrategy && (
                  <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700">No strategy yet for Q{qQuarter} {qYear}</p>
                    <button
                      onClick={generateQuarterWithAI}
                      disabled={qGenerating}
                      className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-900 transition-colors"
                    >
                      {qGenerating ? <Loader2 className="w-3 h-3 animate-spin"/> : <Zap className="w-3 h-3"/>}
                      Generate with AI
                    </button>
                  </div>
                )}

                <FieldBlock
                  label="Goals — what do we want to achieve this quarter?"
                  value={qDraft.goals}
                  onChange={v => setQDraft(d => ({ ...d, goals: v }))}
                  placeholder="e.g. Grow Instagram followers by 20%, launch 2 campaigns, increase ER to 4%"
                />
                <FieldBlock
                  label="Themes — content and campaign themes"
                  value={qDraft.themes}
                  onChange={v => setQDraft(d => ({ ...d, themes: v }))}
                  placeholder="e.g. Behind-the-scenes craft, customer transformation stories, seasonal promotions"
                />
                <FieldBlock
                  label="KPIs — specific measurable targets"
                  value={qDraft.kpis}
                  onChange={v => setQDraft(d => ({ ...d, kpis: v }))}
                  placeholder="e.g. 10K new followers, 500 link clicks per week, 3 press mentions"
                  rows={2}
                />
                <FieldBlock
                  label="Notes"
                  value={qDraft.notes}
                  onChange={v => setQDraft(d => ({ ...d, notes: v }))}
                  placeholder="Constraints, decisions, context for this quarter"
                  rows={2}
                />

                <div className="flex items-center gap-2">
                  <button
                    onClick={saveQuarter}
                    disabled={qSaving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-novax hover:bg-novax-hover disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {qSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>Saving...</> : <><Save className="w-3.5 h-3.5"/>Save Strategy</>}
                  </button>
                  {qStrategy && <span className="text-[11px] text-emerald-600 font-medium">Saved</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Monthly Content Plan Section */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setMOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-slate-500"/>
            <p className="text-sm font-semibold text-slate-700">Monthly Update</p>
          </div>
          <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', !mOpen && '-rotate-90')}/>
        </button>

        {mOpen && (
          <div className="p-4 space-y-4">
            {/* Month + year selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={mMonth}
                onChange={e => setMMonth(Number(e.target.value))}
                className="px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700"
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select
                value={mYear}
                onChange={e => setMYear(Number(e.target.value))}
                className="px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button
                onClick={() => void loadMonthlyUpdate(mYear, mMonth)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {mLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <RefreshCw className="w-3.5 h-3.5"/>}
              </button>
            </div>

            {mLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-novax-muted animate-spin"/>
              </div>
            ) : (
              <div className="space-y-3">
                <FieldBlock
                  label="Content Summary — what did we publish?"
                  value={mDraft.content_summary}
                  onChange={v => setMDraft(d => ({ ...d, content_summary: v }))}
                  placeholder="e.g. 12 Reels, 8 Stories, 3 carousels — themes: product launch, UGC campaign"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldBlock
                    label="What worked"
                    value={mDraft.what_worked}
                    onChange={v => setMDraft(d => ({ ...d, what_worked: v }))}
                    placeholder="e.g. Behind-the-scenes Reels got 3x avg ER"
                    rows={2}
                  />
                  <FieldBlock
                    label="What didn't work"
                    value={mDraft.what_didnt}
                    onChange={v => setMDraft(d => ({ ...d, what_didnt: v }))}
                    placeholder="e.g. Promotional carousels had low saves"
                    rows={2}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <FieldBlock
                      label="Notes"
                      value={mDraft.notes}
                      onChange={v => setMDraft(d => ({ ...d, notes: v }))}
                      placeholder="Additional context, blockers, decisions"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Posts published</label>
                    <input
                      type="number"
                      value={mDraft.posts_published}
                      onChange={e => setMDraft(d => ({ ...d, posts_published: Number(e.target.value) }))}
                      className="w-20 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-novax-muted bg-white text-slate-700 text-center"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={saveMonthly}
                    disabled={mSaving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-novax hover:bg-novax-hover disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {mSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>Saving...</> : <><Save className="w-3.5 h-3.5"/>Save Update</>}
                  </button>
                  {mUpdate && <span className="text-[11px] text-emerald-600 font-medium">Saved</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Strategy PDF Upload */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setPdfOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500"/>
            <p className="text-sm font-semibold text-slate-700">Strategy Documents</p>
          </div>
          <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', !pdfOpen && '-rotate-90')}/>
        </button>

        {pdfOpen && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-slate-500">Upload PDF strategy documents. They are saved to the Context Bank so AI tools can reference them.</p>

            <input
              ref={pdfRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f) }}
            />
            <button
              onClick={() => pdfRef.current?.click()}
              disabled={pdfUploading}
              className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 hover:border-novax-border rounded-lg text-xs text-slate-500 hover:text-novax transition-colors disabled:opacity-50 w-full justify-center"
            >
              {pdfUploading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>Uploading...</>
                : <><Upload className="w-3.5 h-3.5"/>Upload PDF</>}
            </button>

            {uploadedPdfs.length > 0 && (
              <div className="space-y-2">
                {uploadedPdfs.map((pdf, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-novax-light rounded-lg border border-novax-border">
                    <FileText className="w-3.5 h-3.5 text-novax shrink-0"/>
                    <p className="text-xs text-novax font-medium flex-1 truncate">{pdf.name}</p>
                    <a
                      href={pdf.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-novax-muted hover:text-novax transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5"/>
                    </a>
                  </div>
                ))}
                <p className="text-[11px] text-slate-400">Saved to Context Bank — visible in the Context tab</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
