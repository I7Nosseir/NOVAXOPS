'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Download, Image as ImageIcon, Sparkles, CheckCircle, Filter, HardDrive, FolderOpen, File, Film, FileText, RefreshCw, LogIn, LogOut, ChevronRight } from 'lucide-react'
import { useAssets } from '@/lib/hooks/use-assets'
import { cn } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'

interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size?: string
  thumbnailLink?: string
  webViewLink?: string
  iconLink?: string
  parents?: string[]
}

function driveFileIcon(mimeType: string) {
  if (mimeType === 'application/vnd.google-apps.folder') return FolderOpen
  if (mimeType.startsWith('video/')) return Film
  if (mimeType.startsWith('image/')) return ImageIcon
  return FileText
}

function driveFileType(mimeType: string): string {
  if (mimeType === 'application/vnd.google-apps.folder') return 'folder'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf') return 'PDF'
  return 'file'
}

function GDriveBrowser() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(false)
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([{ id: 'root', name: 'My Drive' }])
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [importing, setImporting] = useState<string | null>(null)
  const [imported, setImported] = useState<string[]>([])

  const currentFolder = folderStack[folderStack.length - 1]

  const fetchFiles = useCallback(async (folderId: string, q?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ folderId })
      if (q) params.set('q', q)
      const res = await fetch(`/api/drive/files?${params}`)
      if (res.status === 401) { setConnected(false); return }
      const data = await res.json() as { files?: DriveFile[]; error?: string }
      if (data.error === 'not_connected') { setConnected(false); return }
      setConnected(true)
      setFiles(data.files ?? [])
    } catch {
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFiles(currentFolder.id, search || undefined)
  }, [currentFolder.id, search, fetchFiles])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setFolderStack([{ id: 'root', name: 'My Drive' }])
  }

  const openFolder = (file: DriveFile) => {
    if (file.mimeType !== 'application/vnd.google-apps.folder') return
    setFolderStack(prev => [...prev, { id: file.id, name: file.name }])
    setSearch('')
    setSearchInput('')
  }

  const navigateTo = (index: number) => {
    setFolderStack(prev => prev.slice(0, index + 1))
    setSearch('')
    setSearchInput('')
  }

  const handleImport = async (file: DriveFile) => {
    setImporting(file.id)
    try {
      await fetch('/api/assets/import-from-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driveFileId: file.id, name: file.name, mimeType: file.mimeType, thumbnailLink: file.thumbnailLink }),
      })
      setImported(prev => [...prev, file.id])
    } catch { /* best-effort */ } finally {
      setImporting(null)
    }
  }

  if (connected === false) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <HardDrive className="w-12 h-12 mb-4 text-slate-300"/>
        <p className="text-base font-semibold text-slate-700 mb-1">Connect Google Drive</p>
        <p className="text-sm text-center max-w-xs mb-6">Browse and import your agency files directly from Google Drive.</p>
        <a
          href="/api/drive/auth"
          className="flex items-center gap-2 px-5 py-2.5 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-xl transition-colors"
        >
          <LogIn className="w-4 h-4"/>
          Connect Google Drive
        </a>
      </div>
    )
  }

  if (connected === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-5 h-5 animate-spin text-slate-400"/>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header + search */}
      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search your Drive…"
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all"
            />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-xl transition-colors">
            Search
          </button>
        </form>
        <a
          href="/api/drive/disconnect"
          className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          title="Disconnect Google Drive"
        >
          <LogOut className="w-3.5 h-3.5"/>
        </a>
      </div>

      {/* Breadcrumb */}
      {!search && (
        <div className="flex items-center gap-1 text-xs text-slate-500">
          {folderStack.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3"/>}
              <button
                onClick={() => navigateTo(i)}
                className={cn('hover:text-novax transition-colors', i === folderStack.length - 1 ? 'font-semibold text-slate-700' : '')}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* File grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-5 h-5 animate-spin text-slate-400"/>
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <FolderOpen className="w-8 h-8 mb-2"/>
          <p className="text-sm">No files found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {files.map(file => {
            const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
            const isImage = file.mimeType.startsWith('image/')
            const isVideo = file.mimeType.startsWith('video/')
            const Icon = driveFileIcon(file.mimeType)
            const isDone = imported.includes(file.id)
            const isImporting = importing === file.id

            return (
              <div
                key={file.id}
                onClick={() => isFolder && openFolder(file)}
                className={cn(
                  'bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-all group',
                  isFolder && 'cursor-pointer hover:border-novax-border'
                )}
              >
                <div className="relative aspect-video bg-slate-50 flex items-center justify-center">
                  {file.thumbnailLink && (isImage || isVideo) ? (
                    <img src={file.thumbnailLink} alt={file.name} className="w-full h-full object-cover"/>
                  ) : (
                    <Icon className={cn('w-8 h-8', isFolder ? 'text-novax-accent' : 'text-slate-300')}/>
                  )}
                  {!isFolder && (
                    <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-800/70 text-white">
                      {driveFileType(file.mimeType).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium text-slate-800 truncate mb-1.5">{file.name}</p>
                  {!isFolder && (
                    <button
                      onClick={e => { e.stopPropagation(); handleImport(file) }}
                      disabled={isDone || !!isImporting}
                      className={cn(
                        'w-full flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all',
                        isDone
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : 'bg-novax hover:bg-novax-hover text-white disabled:opacity-60'
                      )}
                    >
                      {isDone
                        ? <><CheckCircle className="w-3 h-3"/> Imported</>
                        : isImporting
                        ? <><RefreshCw className="w-3 h-3 animate-spin"/> Importing…</>
                        : <><Download className="w-3 h-3"/> Import</>
                      }
                    </button>
                  )}
                  {isFolder && (
                    <p className="text-[10px] text-novax-accent font-medium">Open folder</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function AssetsPage() {
  const { assets } = useAssets()
  const [tab, setTab] = useState<'library' | 'drive'>('library')
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('drive') === 'connected') {
      setTab('drive')
    }
  }, [searchParams])

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {([
          { id: 'library', label: 'Asset Library' },
          { id: 'drive',   label: 'Google Drive' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'library' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{assets.length} assets in library</p>
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              <Filter className="w-3.5 h-3.5"/>
              Filter by type
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map(asset => (
              <div key={asset.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group">
                <div className="relative aspect-video bg-slate-100">
                  <img src={asset.thumbnail_url} alt={asset.title} className="w-full h-full object-cover"/>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <button className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-slate-700 shadow transition-all">
                      View Full
                    </button>
                  </div>
                  <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-400 text-white">
                    {asset.source === 'drive' ? 'Drive' : 'Client'}
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-xs font-medium text-slate-800 truncate">{asset.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-slate-400">{asset.type} · {asset.source}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'drive' && <GDriveBrowser/>}
    </div>
  )
}
