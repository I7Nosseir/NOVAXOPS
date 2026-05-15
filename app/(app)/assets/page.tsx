'use client'

import { useState } from 'react'
import { Search, Download, Image as ImageIcon, Sparkles, CheckCircle, Filter } from 'lucide-react'
import { useAssets } from '@/lib/hooks/use-assets'
import { cn } from '@/lib/utils'

const MOCK_FREEPIK_RESULTS = [
  { id: 'fk1', title: 'Luxury cosmetics flat lay marble', type: 'image', license: 'Premium', thumbnail: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=300' },
  { id: 'fk2', title: 'Woman skincare morning routine', type: 'image', license: 'Premium', thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=300' },
  { id: 'fk3', title: 'Fitness gym workout equipment', type: 'image', license: 'Free', thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300' },
  { id: 'fk4', title: 'Fresh seafood coastal plating', type: 'image', license: 'Premium', thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300' },
  { id: 'fk5', title: 'Beauty product minimalist shot', type: 'image', license: 'Premium', thumbnail: 'https://images.unsplash.com/photo-1586495777744-4e6232bf2847?w=300' },
  { id: 'fk6', title: 'Summer skincare SPF outdoor', type: 'image', license: 'Free', thumbnail: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=300' },
]

export default function AssetsPage() {
  const { assets } = useAssets()
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState<string[]>([])
  const [tab, setTab] = useState<'library' | 'search'>('library')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearched(true)
  }

  const handleDownload = async (id: string) => {
    setDownloading(id)
    await new Promise(r => setTimeout(r, 1500))
    setDownloaded(prev => [...prev, id])
    setDownloading(null)
  }

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {(['library', 'search'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {t === 'library' ? 'Asset Library' : 'Search Freepik'}
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
          <div className="grid grid-cols-3 gap-4">
            {assets.map(asset => (
              <div key={asset.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group">
                <div className="relative aspect-video bg-slate-100">
                  <img src={asset.thumbnail_url} alt={asset.title} className="w-full h-full object-cover"/>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <button className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-slate-700 shadow transition-all">
                      View Full
                    </button>
                  </div>
                  <span className={cn(
                    'absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                    asset.license_info === 'Freepik Premium' ? 'bg-amber-400 text-white' :
                    asset.license_info === 'Freepik Free' ? 'bg-emerald-400 text-white' :
                    'bg-blue-400 text-white'
                  )}>
                    {asset.source === 'upload' ? 'Client' : asset.license_info.replace('Freepik ', '')}
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

      {tab === 'search' && (
        <>
          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search Freepik assets… (e.g. luxury beauty flat lay)"
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white transition-all"
              />
            </div>
            <button type="submit" className="px-5 py-2.5 bg-novax hover:bg-novax-hover text-white text-sm font-medium rounded-xl transition-colors">
              Search
            </button>
          </form>

          {/* AI keyword suggestion */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-novax-accent"/>
            <span>AI extracted keywords from active tasks: </span>
            {['luxury cosmetics', 'summer beauty', 'fitness gym', 'coastal food'].map(k => (
              <button key={k} onClick={() => setQuery(k)} className="px-2 py-0.5 rounded-md bg-novax-light text-novax hover:bg-novax-light-hover transition-colors">
                {k}
              </button>
            ))}
          </div>

          {/* Results */}
          {searched && (
            <>
              <p className="text-sm text-slate-500">{MOCK_FREEPIK_RESULTS.length} results for &ldquo;{query}&rdquo;</p>
              <div className="grid grid-cols-3 gap-4">
                {MOCK_FREEPIK_RESULTS.map(result => {
                  const isDone = downloaded.includes(result.id)
                  const isDownloading = downloading === result.id
                  return (
                    <div key={result.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group">
                      <div className="relative aspect-video bg-slate-100">
                        <img src={result.thumbnail} alt={result.title} className="w-full h-full object-cover"/>
                        <span className={cn(
                          'absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                          result.license === 'Premium' ? 'bg-amber-400 text-white' : 'bg-emerald-400 text-white'
                        )}>
                          {result.license}
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-medium text-slate-800 truncate mb-2">{result.title}</p>
                        <button
                          onClick={() => handleDownload(result.id)}
                          disabled={isDone || isDownloading}
                          className={cn(
                            'w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                            isDone
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : 'bg-novax hover:bg-novax-hover text-white disabled:opacity-60'
                          )}
                        >
                          {isDone
                            ? <><CheckCircle className="w-3.5 h-3.5"/> Saved to Library</>
                            : isDownloading
                            ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Downloading…</>
                            : <><Download className="w-3.5 h-3.5"/> Save to Library</>
                          }
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {!searched && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <ImageIcon className="w-10 h-10 mb-3 text-slate-300"/>
              <p className="font-medium text-slate-600">Search Freepik</p>
              <p className="text-sm text-center max-w-xs mt-1">Search millions of premium and free assets. Downloaded assets are saved to your library with license info.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
