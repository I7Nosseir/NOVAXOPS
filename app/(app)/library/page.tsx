'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Copy, Star, Filter, X, HardDrive, FolderOpen, FileText, Image, Film, File, ChevronRight, RefreshCw, Loader2, Unlink, ExternalLink, AlertCircle } from 'lucide-react'
import { usePosts } from '@/lib/hooks/use-posts'
import { useClients } from '@/lib/hooks/use-clients'
import { formatDate, formatNumber, cn } from '@/lib/utils'
import type { SocialPlatform } from '@/lib/types'
import { PlatformIcon } from '@/components/ui/platform-icon'

const TEMPLATE_TAGS = ['Product Launch', 'Engagement', 'Educational', 'Behind the Scenes', 'Social Proof', 'Seasonal', 'Promotional']

const EXTRA_TEMPLATES = [
  {
    id: 'tpl1',
    task_id: 'tpl-task1',
    client_id: 'c1',
    template_name: 'Luxe — Product reveal with benefit hook',
    caption: 'Meet [PRODUCT NAME]. [KEY BENEFIT #1]. [KEY BENEFIT #2]. No [PAIN POINT].\n\n[PROOF POINT — e.g. "Dermatologist-tested" or "18 months in the making"]\n\nAvailable now. Shop via link in bio.',
    platforms: ['instagram'] as SocialPlatform[],
    performance: { reach: 44000, impressions: 65000, engagement_rate: 5.8, likes: 2400, comments: 180, shares: 120, saves: 480 },
    scheduled_at: '2026-03-10T10:00:00',
    status: 'published' as const,
    published_at: '2026-03-10T10:00:00',
    saved: true,
    tags: ['Product Launch', 'Top Performer'],
  },
  {
    id: 'tpl2',
    task_id: 'tpl-task2',
    client_id: 'c4',
    template_name: 'FitForge — Challenge announcement',
    caption: 'THE [CHALLENGE NAME] STARTS [DATE].\n\nYour mission: [CHALLENGE TASK]. Post your progress with [HASHTAG].\n\nTop [N] [reward] win [PRIZE]. Who\'s in?',
    platforms: ['instagram', 'tiktok', 'facebook'] as SocialPlatform[],
    performance: { reach: 88000, impressions: 132000, engagement_rate: 8.1, likes: 7100, comments: 980, shares: 1900, saves: 700 },
    scheduled_at: '2026-02-01T07:00:00',
    status: 'published' as const,
    published_at: '2026-02-01T07:00:00',
    saved: true,
    tags: ['Engagement', 'Top Performer', 'Seasonal'],
  },
]

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
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse"/>
          ))}
        </div>
      )}

      {/* Files grid */}
      {!loading && files.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
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

type ActiveTab = 'templates' | 'drive'

export default function LibraryPage() {
  const { posts } = usePosts()
  const { clients } = useClients()
  const [activeTab, setActiveTab] = useState<ActiveTab>('templates')
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [saved, setSaved] = useState<Set<string>>(new Set(['tpl1', 'tpl2']))
  const [copied, setCopied] = useState<string | null>(null)

  const mockLibrary = posts.filter(p => p.status === 'published' && p.performance).map(post => ({
    ...post,
    saved: false,
    tags: post.performance!.engagement_rate > 7
      ? ['Top Performer', 'Engagement']
      : post.performance!.likes > 1000
      ? ['High Reach', 'Product Launch']
      : ['Social Proof'],
    template_name: `${clients.find(c => c.id === post.client_id)?.name ?? ''} — ${post.caption.slice(0, 35)}…`,
  }))

  const allItems: LibraryItem[] = [...mockLibrary, ...EXTRA_TEMPLATES]

  const filtered = allItems.filter(item => {
    const matchSearch = search === '' || item.caption.toLowerCase().includes(search.toLowerCase()) || item.template_name.toLowerCase().includes(search.toLowerCase())
    const matchTag = !activeTag || item.tags.includes(activeTag)
    const matchClient = clientFilter === 'all' || item.client_id === clientFilter
    return matchSearch && matchTag && matchClient
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
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all"/>
            </div>
            <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 outline-none focus:border-novax-muted bg-white">
              <option value="all">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
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
          <div className="grid grid-cols-2 gap-4">
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
                        className={cn('p-1.5 rounded-lg transition-colors', isSaved ? 'text-amber-400 bg-amber-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100')}>
                        <Star className={cn('w-3.5 h-3.5', isSaved && 'fill-current')}/>
                      </button>
                      <button onClick={() => handleCopy(item.id, item.caption)}
                        className={cn('p-1.5 rounded-lg transition-colors', isCopied ? 'text-novax bg-novax-light' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100')}>
                        <Copy className="w-3.5 h-3.5"/>
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
                    <div className="pt-3 border-t border-slate-100 grid grid-cols-4 gap-2">
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

      {/* ── Drive Tab ── */}
      {activeTab === 'drive' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <DrivePanel/>
        </div>
      )}
    </div>
  )
}
