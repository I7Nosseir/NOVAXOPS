'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Search, Copy, Star, Filter, X, HardDrive, FolderOpen, FileText, Image, Film, File, ChevronRight, RefreshCw, Loader2, Unlink, ExternalLink, AlertCircle, Layers, ChevronDown } from 'lucide-react'
import { usePosts } from '@/lib/hooks/use-posts'
import { useClients } from '@/lib/hooks/use-clients'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { formatDate, formatNumber, cn } from '@/lib/utils'
import type { SocialPlatform } from '@/lib/types'
import { PlatformIcon } from '@/components/ui/platform-icon'

const TEMPLATE_TAGS = ['Product Launch', 'Engagement', 'Educational', 'Behind the Scenes', 'Social Proof', 'Seasonal', 'Promotional']

// ─── Studio Output types ────────────────────────────────────────────────────────

interface StudioSession {
  id: string
  title: string | null
  tool_type: string
  client_id: string | null
  created_at: string
  updated_at: string
  status: string | null
}

const TOOL_LABELS: Record<string, string> = {
  content:     'Content Studio',
  hooks:       'Hook Lab',
  strategy:    'Strategy',
  campaign:    'Campaign Igniter',
  postmortem:  'Post-Mortem',
  visual:      'Visual Studio',
  inspiration: 'Inspiration',
  formats:     'Format Generator',
}

const TOOL_COLORS: Record<string, string> = {
  content:     'bg-blue-50 text-blue-700 border-blue-200',
  hooks:       'bg-purple-50 text-purple-700 border-purple-200',
  strategy:    'bg-novax-light text-novax border-novax-border',
  campaign:    'bg-amber-50 text-amber-700 border-amber-200',
  postmortem:  'bg-red-50 text-red-700 border-red-200',
  visual:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  inspiration: 'bg-pink-50 text-pink-700 border-pink-200',
  formats:     'bg-orange-50 text-orange-700 border-orange-200',
}

const TOOL_PATHS: Record<string, string> = {
  content:     '/studio/content',
  hooks:       '/studio/hooks',
  strategy:    '/studio/strategy',
  campaign:    '/studio/campaign',
  postmortem:  '/studio/postmortem',
  visual:      '/studio/visual',
  inspiration: '/studio/inspiration',
  formats:     '/studio/formats',
}

type LibraryItem = {
  id: string; task_id: string; client_id: string; template_name: string
  caption: string; platforms: SocialPlatform[]
  performance?: { reach: number; impressions: number; engagement_rate: number; likes: number; comments: number; shares: number; saves: number }
  scheduled_at: string; status: string; published_at?: string; saved: boolean; tags: string[]
}

// ─── Google Drive types ────────────────────────────────────────────────────────

interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  size?: string
  thumbnailLink?: string
  webViewLink?: string
  iconLink?: string
  parents?: string[]
}

const FOLDER_MIME = 'application/vnd.google-apps.folder'

function driveIcon(mimeType: string) {
  if (mimeType === FOLDER_MIME) return FolderOpen
  if (mimeType.startsWith('image/')) return Image
  if (mimeType.startsWith('video/')) return Film
  if (mimeType.includes('document') || mimeType.includes('spreadsheet') || mimeType.includes('presentation')) return FileText
  return File
}

function formatBytes(bytes?: string) {
  if (!bytes) return ''
  const n = parseInt(bytes)
  if (isNaN(n)) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Drive Panel ────────────────────────────────────────────────────────────────

function DrivePanel() {
  const [connected, setConnected] = useState<boolean | null>(null) // null = loading
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([])
  const currentFolder = folderStack.length > 0 ? folderStack[folderStack.length - 1] : null

  const loadFiles = useCallback(async (folderId = 'root', q = '') => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ folderId })
      if (q) params.set('q', q)
      const res = await fetch(`/api/drive/files?${params}`)
      if (res.status === 401) {
        setConnected(false)
        return
      }
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setConnected(true)
      setFiles(data.files ?? [])
    } catch {
      setError('Failed to load Drive files.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Check connection on mount
  useEffect(() => { loadFiles() }, [loadFiles])

  // Handle query param from OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('drive') === 'connected') {
      window.history.replaceState({}, '', window.location.pathname)
      loadFiles()
    }
    if (params.get('drive_error')) {
      setConnected(false)
      setError('Google Drive authorisation failed. Please try again.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [loadFiles])

  const handleConnect = () => {
    window.location.href = '/api/drive/auth'
  }

  const handleDisconnect = async () => {
    await fetch('/api/drive/disconnect', { method: 'POST' })
    setConnected(false)
    setFiles([])
    setFolderStack([])
  }

  const openFolder = (file: DriveFile) => {
    setFolderStack(prev => [...prev, { id: file.id, name: file.name }])
    loadFiles(file.id)
  }

  const goUp = (index: number) => {
    const newStack = folderStack.slice(0, index)
    setFolderStack(newStack)
    loadFiles(newStack.length > 0 ? newStack[newStack.length - 1].id : 'root')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) {
      setFolderStack([])
      loadFiles('root', search.trim())
    } else {
      loadFiles('root')
    }
  }

  const clearSearch = () => {
    setSearch('')
    setFolderStack([])
    loadFiles('root')
  }

  // ── Not yet checked ──
  if (connected === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin"/>
      </div>
    )
  }

  // ── Not connected ──
  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <HardDrive className="w-7 h-7 text-slate-400"/>
        </div>
        <p className="font-semibold text-slate-800 mb-1">Connect Google Drive</p>
        <p className="text-sm text-slate-500 mb-5 max-w-xs">Browse and import assets directly from your Google Drive account.</p>
        {error && (
          <div className="flex items-center gap-2 mb-4 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 shrink-0"/>
            {error}
          </div>
        )}
        <button onClick={handleConnect}
          className="flex items-center gap-2 px-5 py-2.5 bg-novax hover:bg-novax-hover text-white text-sm font-semibold rounded-xl transition-colors">
          <HardDrive className="w-4 h-4"/>
          Connect Drive
        </button>
        <p className="text-[11px] text-slate-400 mt-3">Requires Google account authorisation. Read-only access.</p>
      </div>
    )
  }

  // ── Connected ──
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search Drive…"
            className="w-full pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all"
          />
          {search && (
            <button type="button" onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5"/>
            </button>
          )}
        </form>
        <button onClick={() => loadFiles(currentFolder?.id ?? 'root')} disabled={loading}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors disabled:opacity-40">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')}/>
        </button>
        <button onClick={handleDisconnect}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 hover:bg-red-50 rounded-lg transition-colors ml-auto">
          <Unlink className="w-3.5 h-3.5"/>
          Disconnect
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-slate-500 flex-wrap">
        <button onClick={() => goUp(0)} className="hover:text-novax transition-colors font-medium">My Drive</button>
        {folderStack.map((f, i) => (
          <span key={f.id} className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3 text-slate-300"/>
            <button onClick={() => goUp(i + 1)} className="hover:text-novax transition-colors font-medium">{f.name}</button>
          </span>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0"/>
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse"/>
          ))}
        </div>
      )}

      {/* Files grid */}
      {!loading && files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {files.map(file => {
            const Icon = driveIcon(file.mimeType)
            const isFolder = file.mimeType === FOLDER_MIME
            const isImage = file.mimeType.startsWith('image/')

            return (
              <div
                key={file.id}
                onClick={() => isFolder ? openFolder(file) : window.open(file.webViewLink, '_blank')}
                className={cn(
                  'bg-white border border-slate-200 rounded-xl p-3 transition-all cursor-pointer group',
                  isFolder ? 'hover:border-novax-border hover:bg-novax-light' : 'hover:border-slate-300 hover:shadow-sm',
                )}
              >
                {isImage && file.thumbnailLink ? (
                  <div className="h-16 rounded-lg overflow-hidden mb-2 bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={file.thumbnailLink} alt={file.name} className="w-full h-full object-cover"/>
                  </div>
                ) : (
                  <div className={cn('h-16 rounded-lg flex items-center justify-center mb-2',
                    isFolder ? 'bg-novax-light' : 'bg-slate-100')}>
                    <Icon className={cn('w-7 h-7', isFolder ? 'text-novax-muted' : 'text-slate-400')}/>
                  </div>
                )}
                <p className="text-xs font-medium text-slate-800 truncate leading-tight">{file.name}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-[10px] text-slate-400 truncate">
                    {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                  </p>
                  {file.size && <p className="text-[10px] text-slate-400 shrink-0">{formatBytes(file.size)}</p>}
                  {!isFolder && (
                    <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0"/>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && files.length === 0 && !error && (
        <div className="py-12 text-center">
          <p className="text-sm text-slate-400">This folder is empty.</p>
        </div>
      )}
    </div>
  )
}

// ─── Main Library Page ──────────────────────────────────────────────────────────

type ActiveTab = 'templates' | 'studio' | 'drive'

const LS_KEY = (userId: string) => `novax_library_saves_${userId}`

export default function LibraryPage() {
  const { posts } = usePosts()
  const { clients } = useClients()
  const { user } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ActiveTab>('templates')
  const [studioClientFilter, setStudioClientFilter] = useState<string>('all')
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())

  const { data: studioSessions = [], isLoading: sessionsLoading } = useQuery<StudioSession[]>({
    queryKey: ['studio_sessions_library'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studio_sessions')
        .select('id,title,tool_type,client_id,created_at,updated_at,status')
        .order('created_at', { ascending: false })
        .limit(300)
      if (error) throw error
      return (data ?? []) as StudioSession[]
    },
    enabled: activeTab === 'studio',
    staleTime: 60_000,
  })

  const toggleClientExpand = (key: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [savedOnly, setSavedOnly] = useState(false)
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)
  const [usingTemplate, setUsingTemplate] = useState<string | null>(null)

  // Load saved IDs from localStorage on mount (keyed by user)
  useEffect(() => {
    if (!user?.id) return
    try {
      const raw = localStorage.getItem(LS_KEY(user.id))
      if (raw) setSaved(new Set(JSON.parse(raw) as string[]))
    } catch { /* ignore */ }
  }, [user?.id])

  const libraryItems = posts.filter(p => p.status === 'published' && p.performance).map(post => ({
    ...post,
    saved: saved.has(post.id),
    tags: (() => {
      const t: string[] = []
      const p = post.performance!
      const cap = post.caption.toLowerCase()
      if (p.engagement_rate > 7)          t.push('Top Performer')
      if (p.engagement_rate > 4)          t.push('Engagement')
      if ((p.likes ?? 0) > 1000)          t.push('High Reach')
      if (cap.includes('launch') || cap.includes('new') || cap.includes('introducing')) t.push('Product Launch')
      if (cap.includes('tip') || cap.includes('how') || cap.includes('guide') || cap.includes('learn')) t.push('Educational')
      if (cap.includes('behind') || cap.includes('bts') || cap.includes('team') || cap.includes('office')) t.push('Behind the Scenes')
      if (cap.includes('sale') || cap.includes('off') || cap.includes('discount') || cap.includes('offer')) t.push('Promotional')
      if (cap.includes('ramadan') || cap.includes('eid') || cap.includes('summer') || cap.includes('winter') || cap.includes('holiday') || cap.includes('season')) t.push('Seasonal')
      if (cap.includes('review') || cap.includes('love') || cap.includes('customer') || cap.includes('results')) t.push('Social Proof')
      return t.length > 0 ? t : ['Social Proof']
    })(),
    template_name: `${clients.find(c => c.id === post.client_id)?.name ?? ''} — ${post.caption.slice(0, 35)}…`,
  }))

  const allItems: LibraryItem[] = libraryItems

  const filtered = allItems.filter(item => {
    const matchSearch   = search === '' || item.caption.toLowerCase().includes(search.toLowerCase()) || item.template_name.toLowerCase().includes(search.toLowerCase())
    const matchTag      = !activeTag || item.tags.includes(activeTag)
    const matchClient   = clientFilter === 'all' || item.client_id === clientFilter
    const matchPlatform = platformFilter === 'all' || item.platforms.includes(platformFilter as SocialPlatform)
    const matchSaved    = !savedOnly || saved.has(item.id)
    return matchSearch && matchTag && matchClient && matchPlatform && matchSaved
  })

  const handleCopy = (id: string, caption: string) => {
    navigator.clipboard.writeText(caption).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const toggleSave = (id: string) => {
    setSaved(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      if (user?.id) {
        try { localStorage.setItem(LS_KEY(user.id), JSON.stringify([...next])) } catch {}
      }
      return next
    })
  }

  return (
    <div className="space-y-5">
      {/* Tab toggle */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('templates')}
          className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === 'templates' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
        >
          <Filter className="w-3.5 h-3.5"/>
          Content Templates
        </button>
        <button
          onClick={() => setActiveTab('studio')}
          className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === 'studio' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
        >
          <Layers className="w-3.5 h-3.5"/>
          Studio Outputs
        </button>
        <button
          onClick={() => setActiveTab('drive')}
          className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === 'drive' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
        >
          <HardDrive className="w-3.5 h-3.5"/>
          Google Drive
        </button>
      </div>

      {/* ── Templates Tab ── */}
      {activeTab === 'templates' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all"/>
            </div>
            <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 outline-none focus:border-novax-muted bg-white">
              <option value="all">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 outline-none focus:border-novax-muted bg-white">
              <option value="all">All Platforms</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="tiktok">TikTok</option>
              <option value="linkedin">LinkedIn</option>
              <option value="youtube">YouTube</option>
            </select>
            <button
              onClick={() => setSavedOnly(v => !v)}
              className={cn('flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors',
                savedOnly ? 'bg-amber-50 border-amber-300 text-amber-600' : 'border-slate-200 text-slate-600 hover:border-slate-300')}
            >
              <Star className={cn('w-3.5 h-3.5', savedOnly && 'fill-amber-400 text-amber-400')}/>
              Saved
            </button>
            <p className="text-sm text-slate-500 ml-auto">{filtered.length} templates</p>
          </div>

          {/* Tag filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {TEMPLATE_TAGS.map(tag => (
              <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                  activeTag === tag ? 'bg-novax border-novax text-white' : 'border-slate-200 text-slate-600 hover:border-novax-border')}>
                {tag}
                {activeTag === tag && <X className="w-3 h-3"/>}
              </button>
            ))}
          </div>

          {/* Templates grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map(item => {
              const client = clients.find(c => c.id === item.client_id)
              const isSaved = saved.has(item.id)
              const isCopied = copied === item.id
              const perf = item.performance

              return (
                <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: client?.color }}>
                        {client?.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{item.template_name}</p>
                        <p className="text-[10px] text-slate-400">{formatDate(item.scheduled_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => toggleSave(item.id)}
                        className={cn('p-1.5 rounded-lg transition-colors', isSaved ? 'text-amber-400 bg-amber-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100')}
                        title={isSaved ? 'Remove from saved' : 'Save template'}>
                        <Star className={cn('w-3.5 h-3.5', isSaved && 'fill-current')}/>
                      </button>
                      <button onClick={() => handleCopy(item.id, item.caption)}
                        className={cn('p-1.5 rounded-lg transition-colors', isCopied ? 'text-novax bg-novax-light' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100')}
                        title="Copy caption">
                        <Copy className="w-3.5 h-3.5"/>
                      </button>
                      <button
                        onClick={() => {
                          setUsingTemplate(item.id)
                          router.push(`/publishing?caption=${encodeURIComponent(item.caption)}`)
                        }}
                        className={cn('p-1.5 rounded-lg transition-colors', usingTemplate === item.id ? 'text-novax bg-novax-light' : 'text-slate-400 hover:text-novax hover:bg-novax-light')}
                        title="Use as template">
                        <Layers className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.tags.map(tag => (
                      <span key={tag} className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium',
                        tag === 'Top Performer' ? 'bg-purple-50 text-purple-600' :
                        tag === 'High Reach' ? 'bg-blue-50 text-blue-600' :
                        'bg-slate-100 text-slate-600')}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-4 mb-3 flex-1">{item.caption}</p>

                  <div className="flex items-center gap-1.5 mb-3">
                    {item.platforms.map((p: SocialPlatform) => <PlatformIcon key={p} platform={p} size="xs"/>)}
                  </div>

                  {perf && (
                    <div className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'Reach', value: formatNumber(perf.reach) },
                        { label: 'Likes', value: formatNumber(perf.likes) },
                        { label: 'ER',    value: `${perf.engagement_rate}%` },
                        { label: 'Saves', value: formatNumber(perf.saves ?? 0) },
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center">
                          <p className="text-xs font-bold text-slate-800">{value}</p>
                          <p className="text-[9px] text-slate-400">{label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {isCopied && (
                    <p className="text-[11px] text-novax font-semibold mt-2 text-center">Copied to clipboard!</p>
                  )}
                </div>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-slate-400 text-sm">No templates found. Publish posts to start building your library.</p>
            </div>
          )}
        </>
      )}

      {/* ── Studio Outputs Tab ── */}
      {activeTab === 'studio' && (
        <StudioOutputsPanel
          sessions={studioSessions}
          clients={clients}
          loading={sessionsLoading}
          clientFilter={studioClientFilter}
          onClientFilterChange={setStudioClientFilter}
          expandedClients={expandedClients}
          onToggleClient={toggleClientExpand}
        />
      )}

      {/* ── Drive Tab ── */}
      {activeTab === 'drive' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <DrivePanel/>
        </div>
      )}
    </div>
  )
}

// ─── Studio Outputs Panel ──────────────────────────────────────────────────────

interface StudioOutputsPanelProps {
  sessions:            StudioSession[]
  clients:             Array<{ id: string; name: string; color?: string; initials?: string }>
  loading:             boolean
  clientFilter:        string
  onClientFilterChange: (v: string) => void
  expandedClients:     Set<string>
  onToggleClient:      (key: string) => void
}

function StudioOutputsPanel({
  sessions,
  clients,
  loading,
  clientFilter,
  onClientFilterChange,
  expandedClients,
  onToggleClient,
}: StudioOutputsPanelProps) {
  // Group sessions by client, applying filter
  const filtered = clientFilter === 'all'
    ? sessions
    : sessions.filter(s => s.client_id === clientFilter)

  const grouped = filtered.reduce<Record<string, { color?: string; initials?: string; sessions: StudioSession[] }>>(
    (acc, session) => {
      const client = clients.find(c => c.id === session.client_id)
      const key = client ? client.name : 'No Client'
      if (!acc[key]) acc[key] = { color: client?.color, initials: client?.initials, sessions: [] }
      acc[key].sessions.push(session)
      return acc
    },
    {},
  )

  const clientKeys = Object.keys(grouped).sort((a, b) => {
    if (a === 'No Client') return 1
    if (b === 'No Client') return -1
    return a.localeCompare(b)
  })

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={clientFilter}
          onChange={e => onClientFilterChange(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 outline-none focus:border-novax-muted bg-white"
        >
          <option value="all">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <p className="text-sm text-slate-500 ml-auto">{filtered.length} outputs</p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-8 justify-center text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading studio outputs…
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="py-16 text-center">
          <Layers className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No studio outputs yet.</p>
          <Link href="/studio" className="inline-block mt-3 text-xs text-novax-muted hover:text-novax font-medium transition-colors">
            Open Studio
          </Link>
        </div>
      )}

      {/* Client folders */}
      {!loading && clientKeys.map(clientName => {
        const { color, initials, sessions: clientSessions } = grouped[clientName]
        const isExpanded = expandedClients.has(clientName) || expandedClients.size === 0
        return (
          <div key={clientName} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {/* Folder header */}
            <button
              onClick={() => onToggleClient(clientName)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {color ? (
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: color }}>
                    {initials}
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                    <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                )}
                <span className="text-sm font-semibold text-slate-800">{clientName}</span>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{clientSessions.length}</span>
              </div>
              {isExpanded
                ? <ChevronDown className="w-4 h-4 text-slate-400" />
                : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>

            {/* Session list */}
            {isExpanded && (
              <div className="border-t border-slate-100 divide-y divide-slate-100">
                {clientSessions.map(session => (
                  <div key={session.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <span className={cn(
                      'shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize',
                      TOOL_COLORS[session.tool_type] ?? 'bg-slate-100 text-slate-600 border-slate-200',
                    )}>
                      {TOOL_LABELS[session.tool_type] ?? session.tool_type}
                    </span>
                    <p className="flex-1 text-sm text-slate-700 truncate min-w-0">
                      {session.title ?? 'Untitled Session'}
                    </p>
                    <p className="text-[11px] text-slate-400 shrink-0">
                      {formatDate(session.created_at)}
                    </p>
                    <Link
                      href={TOOL_PATHS[session.tool_type] ?? '/studio'}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-novax-muted bg-novax-light border border-novax-border rounded-lg hover:bg-novax-light-hover transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
