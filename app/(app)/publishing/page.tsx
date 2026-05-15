'use client'

import { useState } from 'react'
import { Send, Calendar, Plus, Eye, Clock, CheckCircle, X, Upload, Sparkles, ChevronLeft, ChevronRight, LayoutGrid, Download, Search, ExternalLink, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { usePosts } from '@/lib/hooks/use-posts'
import { useClients } from '@/lib/hooks/use-clients'
import { PLATFORM_CONFIG, formatDateTime, formatDate, formatNumber, cn } from '@/lib/utils'
import type { ScheduledPost, SocialPlatform } from '@/lib/types'
import { PlatformIcon } from '@/components/ui/platform-icon'
interface PinterestPin { id: string; title: string; description: string; imageUrl: string; link: string; dominantColor: string }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const STATUS_CONFIG = {
  draft:      { label: 'Draft',      color: 'text-slate-600',   bg: 'bg-slate-100' },
  scheduled:  { label: 'Scheduled',  color: 'text-novax',  bg: 'bg-novax-light' },
  published:  { label: 'Published',  color: 'text-emerald-600', bg: 'bg-emerald-50' },
  failed:     { label: 'Failed',     color: 'text-red-600',     bg: 'bg-red-50' },
}

function PostCard({ post }: { post: ScheduledPost }) {
  const { clients } = useClients()
  const client = clients.find(c => c.id === post.client_id)
  const status = STATUS_CONFIG[post.status]
  const perf = post.performance

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold" style={{ background: client?.color }}>
            {client?.initials}
          </div>
          <span className="text-xs font-medium text-slate-700">{client?.name}</span>
        </div>
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', status.bg, status.color)}>
          {status.label}
        </span>
      </div>

      {/* Media */}
      {post.media_url && (
        <div className="relative mb-3 rounded-lg overflow-hidden bg-slate-100 aspect-video">
          <img src={post.media_url} alt="" className="w-full h-full object-cover"/>
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"/>
        </div>
      )}

      {/* Caption */}
      <p className="text-xs text-slate-600 line-clamp-3 mb-3 leading-relaxed">{post.caption}</p>

      {/* Platforms */}
      <div className="flex items-center gap-1.5 mb-3">
        {post.platforms.map(platform => {
          const cfg = PLATFORM_CONFIG[platform]
          return (
            <div key={platform} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200">
              <PlatformIcon platform={platform} size="xs"/>
              <span className="text-slate-600">{cfg.label}</span>
            </div>
          )
        })}
      </div>

      {/* Time */}
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3"/>
          {post.status === 'published' ? `Published ${formatDate(post.published_at!)}` : formatDateTime(post.scheduled_at)}
        </div>
      </div>

      {/* Performance (if published) */}
      {perf && (
        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-4 gap-2">
          {[
            { label: 'Reach',   value: formatNumber(perf.reach) },
            { label: 'Likes',   value: formatNumber(perf.likes) },
            { label: 'Cmnts',   value: perf.comments },
            { label: 'ER',      value: `${perf.engagement_rate}%` },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-xs font-bold text-slate-900">{value}</p>
              <p className="text-[9px] text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ComposeDialog({ onClose }: { onClose: () => void }) {
  const { clients } = useClients()
  const [caption, setCaption] = useState('')
  const [captionAr, setCaptionAr] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(['instagram'])
  const [selectedClient, setSelectedClient] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [lang, setLang] = useState<'en' | 'ar' | 'both'>('en')

  const togglePlatform = (p: SocialPlatform) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  const platforms: SocialPlatform[] = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter']

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Compose Post</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500"/>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Client */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Client</label>
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all"
            >
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {platforms.map(p => {
                const cfg = PLATFORM_CONFIG[p]
                const active = selectedPlatforms.includes(p)
                return (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                      active
                        ? 'border-novax-border-active bg-novax-light text-novax'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    )}
                  >
                    <PlatformIcon platform={p} size="xs"/>
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Media upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Media</label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-novax-border-active transition-colors cursor-pointer">
              <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1.5"/>
              <p className="text-xs text-slate-500">Drop media here or <span className="text-novax-muted font-medium">browse</span></p>
              <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, MP4 up to 50MB</p>
            </div>
          </div>

          {/* Language toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Language</label>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 w-fit">
              {(['en', 'ar', 'both'] as const).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={cn('px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                    lang === l ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                  {l === 'en' ? 'English' : l === 'ar' ? 'Arabic' : 'Both'}
                </button>
              ))}
            </div>
          </div>

          {/* Caption EN */}
          {(lang === 'en' || lang === 'both') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Caption{lang === 'both' ? ' (English)' : ''}
              </label>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                rows={4}
                placeholder="Write your caption…"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light resize-none transition-all"
              />
              <div className="flex justify-between mt-1">
                <button className="flex items-center gap-1 text-[11px] text-novax-muted hover:text-novax font-medium transition-colors"><Sparkles className="w-3 h-3"/>Generate with AI</button>
                <span className="text-[11px] text-slate-400">{caption.length} / 2200</span>
              </div>
            </div>
          )}

          {/* Caption AR */}
          {(lang === 'ar' || lang === 'both') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Caption{lang === 'both' ? ' (Arabic)' : ''}
              </label>
              <textarea
                value={captionAr}
                onChange={e => setCaptionAr(e.target.value)}
                rows={4}
                dir="rtl"
                placeholder="اكتب التعليق هنا…"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light resize-none transition-all text-right"
              />
              <div className="flex justify-between mt-1">
                <button className="flex items-center gap-1 text-[11px] text-novax-muted hover:text-novax font-medium transition-colors"><Sparkles className="w-3 h-3"/>Generate in Arabic</button>
                <span className="text-[11px] text-slate-400">{captionAr.length} / 2200</span>
              </div>
            </div>
          )}

          {/* Schedule */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Schedule Date & Time</label>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={e => setScheduleDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">Save Draft</button>
            <button className="flex items-center gap-1.5 px-4 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors">
              <Send className="w-3.5 h-3.5"/>
              Schedule via Metricool
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type CalendarPost = { day: number; time: string; platform: string; type: string; title: string; anchor: string | null }

function exportCalendarToExcel(posts: CalendarPost[], clientName: string, monthLabel: string, language: 'en' | 'ar') {
  const isAr = language === 'ar'
  const headers = isAr
    ? ['اليوم', 'الوقت', 'المنصة', 'نوع المحتوى', 'عنوان المنشور', 'مرتكز']
    : ['Day', 'Time', 'Platform', 'Content Type', 'Post Title', 'Anchor Event']

  const rows = posts.map(p => [
    p.day,
    p.time,
    p.platform,
    p.type,
    p.title,
    p.anchor ?? '',
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // Column widths
  ws['!cols'] = [{ wch: 6 }, { wch: 8 }, { wch: 12 }, { wch: 28 }, { wch: 52 }, { wch: 22 }]

  // RTL worksheet for Arabic
  if (isAr) {
    ws['!sheetView'] = [{ rightToLeft: true }]
  }

  // Color anchor rows: Islamic = green, global event = blue
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let r = 1; r <= range.e.r; r++) {
    const post = posts[r - 1]
    if (!post?.anchor) continue
    const isIslamic = post.type.toLowerCase().match(/eid|ramadan|arafah|arafa|mawlid|muharram|ashura|isra|sha.ban|laylat|hijri/)
    const fill = isIslamic ? 'C6EFCE' : 'BDD7EE'
    for (let c = 0; c <= 5; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r, c })
      if (!ws[cellAddr]) ws[cellAddr] = { t: 's', v: '' }
      ws[cellAddr].s = { fill: { patternType: 'solid', fgColor: { rgb: fill } } }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, monthLabel.replace(/[/:?*[\]\\]/g, '-'))
  XLSX.writeFile(wb, `${clientName}_${monthLabel.replace(/ /g, '_')}_Calendar.xlsx`)
}

function PinterestPanel({ query }: { query: string }) {
  const [pins, setPins] = useState<PinterestPin[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [searchQuery, setSearchQuery] = useState(query)
  const [error, setError] = useState<string | null>(null)

  const search = async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    setSearched(false)
    try {
      const res = await fetch(`/api/pinterest?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Pinterest search failed')
        setPins([])
      } else {
        setPins(data.pins ?? [])
        setSearched(true)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg focus-within:border-novax-muted focus-within:ring-2 focus-within:ring-novax-light transition-all bg-white">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0"/>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search(searchQuery)}
            placeholder="Search Pinterest for visual references…"
            className="flex-1 text-sm text-slate-700 placeholder:text-slate-400 outline-none bg-transparent"
          />
        </div>
        <button
          onClick={() => search(searchQuery)}
          disabled={loading || !searchQuery.trim()}
          className="px-4 py-2 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Search className="w-3.5 h-3.5"/>}
          Search
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 rounded-xl border border-red-100">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {!searched && !loading && !error && (
        <div className="py-8 text-center">
          <Search className="w-8 h-8 text-slate-200 mx-auto mb-2"/>
          <p className="text-sm text-slate-400">Search Pinterest for visual inspiration</p>
          <p className="text-xs text-slate-300 mt-1">Images open on Pinterest in a new tab</p>
        </div>
      )}

      {loading && (
        <div className="py-8 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 text-novax-muted animate-spin"/>
          <span className="text-sm text-slate-500">Fetching references…</span>
        </div>
      )}

      {searched && pins.length === 0 && !loading && !error && (
        <div className="py-8 text-center">
          <p className="text-sm text-slate-400">No results found. Try a different query.</p>
        </div>
      )}

      {pins.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {pins.map(pin => (
            <a
              key={pin.id}
              href={pin.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative rounded-xl overflow-hidden border border-slate-200 hover:border-novax-border-active transition-all block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pin.imageUrl}
                alt={pin.title}
                className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity"/>
              </div>
              {pin.title && (
                <div className="p-1.5">
                  <p className="text-[10px] text-slate-600 line-clamp-2 leading-tight">{pin.title}</p>
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function BriefToCalendarDialog({ onClose }: { onClose: () => void }) {
  const { clients } = useClients()
  const [brief, setBrief] = useState('')
  const [client, setClient] = useState('')
  const [month, setMonth] = useState('2026-05')
  const [freq, setFreq] = useState('3')
  const [language, setLanguage] = useState<'en' | 'ar'>('en')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<CalendarPost[] | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'calendar' | 'pinterest'>('calendar')

  const generate = async () => {
    if (!brief) return
    setGenerating(true)
    setGenError(null)
    const selectedClient = clients.find(c => c.id === client)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'content_calendar',
          client: selectedClient ? { id: selectedClient.id, name: selectedClient.name, brand_identity: selectedClient.brand_identity } : undefined,
          brief,
          month,
          frequency: freq,
          language,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setGenError(data.error ?? 'Generation failed. Please try again.')
        return
      }
      const raw = data.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const parsed: CalendarPost[] = JSON.parse(raw)
      setResult(parsed)
    } catch {
      setGenError('Generation failed. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const selectedClient = clients.find(c => c.id === client)
  const [yr, mo] = month.split('-').map(Number)
  const monthLabel = `${MONTHS[mo - 1]} ${yr}`
  const isAr = language === 'ar'

  const platformColors: Record<string, string> = {
    instagram: 'bg-pink-50 border-pink-200 text-pink-700',
    facebook: 'bg-blue-50 border-blue-200 text-blue-700',
    tiktok: 'bg-slate-100 border-slate-200 text-slate-700',
    linkedin: 'bg-sky-50 border-sky-200 text-sky-700',
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-900">Generate Content Calendar</h2>
            <p className="text-xs text-slate-500 mt-0.5">Input a campaign brief — AI maps it to a posting schedule.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* Result tabs (only shown after generation) */}
        {result && (
          <div className="flex border-b border-slate-100 px-6 shrink-0">
            {(['calendar', 'pinterest'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'py-3 px-1 mr-5 text-xs font-semibold border-b-2 -mb-px transition-colors capitalize',
                  activeTab === tab ? 'border-novax text-novax' : 'border-transparent text-slate-400 hover:text-slate-600'
                )}>
                {tab === 'calendar' ? 'Calendar' : 'Pinterest References'}
              </button>
            ))}
          </div>
        )}

        <div className="overflow-y-auto flex-1 p-6 space-y-4" dir={isAr && !result ? 'rtl' : 'ltr'}>
          {!result ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Client</label>
                  <select value={client} onChange={e => setClient(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all">
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Month</label>
                  <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Posts per week</label>
                  <div className="flex gap-2">
                    {['2', '3', '4', '5', '7'].map(n => (
                      <button key={n} onClick={() => setFreq(n)}
                        className={cn('w-10 h-9 rounded-lg border text-sm font-medium transition-colors',
                          freq === n ? 'bg-novax border-novax text-white' : 'border-slate-200 text-slate-600 hover:border-novax-border')}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Calendar Language</label>
                  <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 w-fit">
                    {(['en', 'ar'] as const).map(l => (
                      <button key={l} onClick={() => setLanguage(l)}
                        className={cn('px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                          language === l ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                        {l === 'en' ? 'English' : 'Arabic'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" style={{ textAlign: isAr ? 'right' : 'left' }}>Campaign Brief</label>
                <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={5}
                  dir={isAr ? 'rtl' : 'ltr'}
                  placeholder={isAr ? 'اكتب موجز الحملة، الرسائل الرئيسية، الأهداف…' : 'Describe the campaign, key messages, goals, any specific dates or events to work around, content themes…'}
                  className={cn('w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light resize-none transition-all', isAr && 'text-right')}/>
              </div>
              {genError && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-xs text-red-600">{genError}</p>
                </div>
              )}
            </>
          ) : activeTab === 'calendar' ? (
            <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{selectedClient?.name} — {monthLabel}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{result.length} posts planned · {freq}x per week cadence</p>
                </div>
                <button onClick={() => setResult(null)} className="text-xs text-novax-muted hover:text-novax font-medium">Edit brief</button>
              </div>
              <div className="space-y-2">
                {result.map((item, i) => {
                  const isIslamic = item.anchor && item.type.toLowerCase().match(/eid|ramadan|arafah|arafa|mawlid|muharram|ashura|isra|sha.ban|laylat|hijri/)
                  const isGlobal = item.anchor && !isIslamic
                  return (
                    <div key={i} className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                      isAr && 'flex-row-reverse',
                      isIslamic ? 'bg-emerald-50 border-emerald-200' :
                      isGlobal  ? 'bg-sky-50 border-sky-200' :
                      'bg-slate-50 border-slate-100 hover:border-slate-200'
                    )}>
                      <div className="w-12 shrink-0 text-center">
                        <p className={cn('text-lg font-bold', isIslamic ? 'text-emerald-700' : isGlobal ? 'text-sky-700' : 'text-slate-900')}>{item.day}</p>
                        <p className="text-[10px] text-slate-400">{item.time}</p>
                      </div>
                      <div className={cn('flex-1 min-w-0', isAr && 'text-right')}>
                        {item.anchor && (
                          <span className={cn('inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mb-1',
                            isIslamic ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700')}>
                            {isIslamic ? 'Islamic' : 'Event'} — {item.anchor}
                          </span>
                        )}
                        <p className={cn('text-sm font-medium leading-tight', isIslamic ? 'text-emerald-900' : isGlobal ? 'text-sky-900' : 'text-slate-900')}>{item.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.type}</p>
                      </div>
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize shrink-0', platformColors[item.platform] ?? 'bg-slate-100 border-slate-200 text-slate-600')}>
                        {item.platform}
                      </span>
                    </div>
                  )
                })}
              </div>
              {result.some(p => p.anchor) && (
                <div className="flex items-center gap-4 pt-2 px-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"/>
                    <span className="text-[10px] text-slate-500">Islamic date</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-sky-400"/>
                    <span className="text-[10px] text-slate-500">Global event</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300"/>
                    <span className="text-[10px] text-slate-500">Regular post</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <PinterestPanel query={`${selectedClient?.name ?? ''} ${brief.split(' ').slice(0, 5).join(' ')}`}/>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
          {!result ? (
            <button onClick={generate} disabled={!brief || generating}
              className="flex items-center gap-2 px-5 py-2 bg-novax hover:bg-novax-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
              <Sparkles className="w-3.5 h-3.5"/>
              {generating ? 'Generating…' : 'Generate Calendar'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportCalendarToExcel(result, selectedClient?.name ?? 'Client', monthLabel, language)}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:border-novax-border rounded-lg text-sm font-medium text-slate-600 hover:text-novax transition-colors">
                <Download className="w-3.5 h-3.5"/>
                Export Excel
              </button>
              <button onClick={onClose} className="flex items-center gap-2 px-5 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors">
                <Calendar className="w-3.5 h-3.5"/>
                Save to Calendar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function CalendarView({ onCompose }: { onCompose: () => void }) {
  const { posts: SCHEDULED_POSTS } = usePosts()
  const { clients: CLIENTS } = useClients()
  const today = new Date(2026, 4, 1) // May 2026 (matches current date context)
  const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth() })

  const firstDay = new Date(current.year, current.month, 1)
  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate()
  // Monday-first: 0=Mon…6=Sun
  const startOffset = (firstDay.getDay() + 6) % 7

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const getPostsForDay = (day: number) => {
    const prefix = `${current.year}-${String(current.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return SCHEDULED_POSTS.filter(p => p.scheduled_at.startsWith(prefix))
  }

  const isToday = (day: number) =>
    day === today.getDate() && current.month === today.getMonth() && current.year === today.getFullYear()

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Calendar header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrent(c => {
            const d = new Date(c.year, c.month - 1, 1)
            return { year: d.getFullYear(), month: d.getMonth() }
          })} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-500"/>
          </button>
          <h3 className="font-semibold text-slate-900 text-sm w-36 text-center">
            {MONTHS[current.month]} {current.year}
          </h3>
          <button onClick={() => setCurrent(c => {
            const d = new Date(c.year, c.month + 1, 1)
            return { year: d.getFullYear(), month: d.getMonth() }
          })} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-500"/>
          </button>
        </div>
        <button onClick={() => setCurrent({ year: today.getFullYear(), month: today.getMonth() })}
          className="text-xs text-novax-muted hover:text-novax font-medium transition-colors">
          Today
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DAYS.map(d => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          const posts = day ? getPostsForDay(day) : []
          const isLastRow = idx >= cells.length - 7
          return (
            <div key={idx} className={cn(
              'min-h-[110px] p-2 border-b border-r border-slate-100 relative group',
              !isLastRow ? '' : 'border-b-0',
              (idx + 1) % 7 === 0 ? 'border-r-0' : '',
              !day ? 'bg-slate-50/50' : 'hover:bg-slate-50/50 transition-colors',
            )}>
              {day && (
                <>
                  <div className={cn(
                    'w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1',
                    isToday(day) ? 'bg-novax text-white' : 'text-slate-600'
                  )}>
                    {day}
                  </div>
                  <div className="space-y-1">
                    {posts.slice(0, 3).map(post => {
                      const client = CLIENTS.find(c => c.id === post.client_id)
                      const statusDot = post.status === 'published' ? 'bg-emerald-400' : post.status === 'scheduled' ? 'bg-novax' : 'bg-slate-300'
                      return (
                        <div key={post.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-slate-200 cursor-pointer hover:border-novax-border transition-colors group/post" title={post.caption}>
                          <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusDot)}/>
                          <div className="w-3 h-3 rounded-sm flex items-center justify-center text-white text-[7px] font-bold shrink-0" style={{ background: client?.color }}>
                            {client?.initials?.[0]}
                          </div>
                          <span className="text-[10px] text-slate-600 truncate leading-tight">
                            {post.caption.slice(0, 22)}…
                          </span>
                        </div>
                      )
                    })}
                    {posts.length > 3 && (
                      <p className="text-[10px] text-slate-400 font-medium pl-1">+{posts.length - 3} more</p>
                    )}
                  </div>
                  {/* Add post button on hover */}
                  <button onClick={onCompose} className="absolute top-1.5 right-1.5 w-5 h-5 rounded bg-novax-light text-novax items-center justify-center text-[10px] hidden group-hover:flex transition-colors hover:bg-novax hover:text-white">
                    +
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PublishingPage() {
  const { posts: allPosts } = usePosts()
  const [compose, setCompose] = useState(false)
  const [briefDialog, setBriefDialog] = useState(false)
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'published' | 'draft'>('all')
  const [view, setView] = useState<'grid' | 'calendar'>('grid')

  const filtered = allPosts.filter(p => filter === 'all' || p.status === filter)
  const counts = {
    scheduled: allPosts.filter(p => p.status === 'scheduled').length,
    published: allPosts.filter(p => p.status === 'published').length,
    draft: allPosts.filter(p => p.status === 'draft').length,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['all', 'scheduled', 'published', 'draft'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                filter === f ? 'bg-novax text-white' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {f === 'scheduled' && <Clock className="w-3.5 h-3.5"/>}
              {f === 'published' && <CheckCircle className="w-3.5 h-3.5"/>}
              {f === 'all' ? 'All Posts' : `${f.charAt(0).toUpperCase() + f.slice(1)} (${counts[f as keyof typeof counts]})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => setView('grid')} className={cn('p-1.5 rounded-md transition-colors', view === 'grid' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400 hover:text-slate-600')} title="Grid view">
              <LayoutGrid className="w-3.5 h-3.5"/>
            </button>
            <button onClick={() => setView('calendar')} className={cn('p-1.5 rounded-md transition-colors', view === 'calendar' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400 hover:text-slate-600')} title="Calendar view">
              <Calendar className="w-3.5 h-3.5"/>
            </button>
          </div>
          <button
            onClick={() => setBriefDialog(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5"/>
            Generate Calendar
          </button>
          <button
            onClick={() => setCompose(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4"/>
            Compose Post
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Posts', value: allPosts.length, icon: Send },
          { label: 'Scheduled', value: counts.scheduled, icon: Calendar },
          { label: 'Published', value: counts.published, icon: CheckCircle },
          { label: 'Drafts', value: counts.draft, icon: Eye },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
            <div className="p-2 bg-novax-light rounded-lg">
              <Icon className="w-4 h-4 text-novax-muted"/>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{value}</p>
              <p className="text-[10px] text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Posts grid or Calendar */}
      {view === 'grid' ? (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map(post => <PostCard key={post.id} post={post}/>)}
        </div>
      ) : (
        <CalendarView onCompose={() => setCompose(true)}/>
      )}

      {compose && <ComposeDialog onClose={() => setCompose(false)}/>}
      {briefDialog && <BriefToCalendarDialog onClose={() => setBriefDialog(false)}/>}
    </div>
  )
}
