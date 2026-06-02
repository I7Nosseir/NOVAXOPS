'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, TrendingUp, X, Search, Globe, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { useClients } from '@/lib/hooks/use-clients'
import { InspirationCard } from '@/components/studio/inspiration-card'
import { InspirationBoardPanel } from '@/components/studio/inspiration-board-panel'
import type { TrendingContentItem } from '@/app/api/studio/trending-content/route'
import type { InspirationBoardItem } from '@/app/api/studio/inspiration/route'

// ── Industries ────────────────────────────────────────────────

const INDUSTRIES = [
  { value: 'beauty',      label: 'Beauty'       },
  { value: 'tech',        label: 'Tech'         },
  { value: 'food',        label: 'Food'         },
  { value: 'fitness',     label: 'Fitness'      },
  { value: 'finance',     label: 'Finance'      },
  { value: 'fashion',     label: 'Fashion'      },
  { value: 'travel',      label: 'Travel'       },
  { value: 'education',   label: 'Education'    },
  { value: 'real_estate', label: 'Real Estate'  },
]

// ── Platform filters ──────────────────────────────────────────

const PLATFORMS = [
  { value: 'all',       label: 'All'            },
  { value: 'youtube',   label: 'YouTube'        },
  { value: 'tiktok',    label: 'TikTok'         },
  { value: 'trendsmcp', label: 'Cross-platform' },
]

// ── Regions ───────────────────────────────────────────────────

const REGIONS = [
  { value: 'global', label: 'Global'       },
  { value: 'US',     label: 'United States' },
  { value: 'GB',     label: 'United Kingdom'},
  { value: 'AU',     label: 'Australia'    },
  { value: 'AE',     label: 'UAE'          },
  { value: 'SA',     label: 'Saudi Arabia' },
  { value: 'EG',     label: 'Egypt'        },
  { value: 'JO',     label: 'Jordan'       },
  { value: 'KW',     label: 'Kuwait'       },
  { value: 'QA',     label: 'Qatar'        },
  { value: 'FR',     label: 'France'       },
  { value: 'DE',     label: 'Germany'      },
]

// ── Skeleton card ─────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden animate-pulse">
      <div className="h-40 bg-slate-100" />
      <div className="p-4 space-y-2">
        <div className="h-3 bg-slate-100 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
        <div className="h-3 bg-slate-100 rounded w-5/6 mt-3" />
      </div>
      <div className="px-4 pb-4 flex gap-2">
        <div className="h-7 bg-slate-100 rounded-lg w-16" />
        <div className="h-7 bg-slate-100 rounded-lg w-14" />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function InspirationLibraryPage() {
  const { user }             = useAuth()
  const { clients }          = useClients()

  const [industry,          setIndustry]          = useState('beauty')
  const [customNiche,       setCustomNiche]       = useState('')
  const [platform,          setPlatform]          = useState('all')
  const [region,            setRegion]            = useState('global')
  const [aiFilter,          setAiFilter]          = useState(false)
  const nicheInputRef = useRef<HTMLInputElement>(null)
  const [items,             setItems]             = useState<TrendingContentItem[]>([])
  const [removedCount,      setRemovedCount]      = useState(0)
  const [savedItems,        setSavedItems]        = useState<InspirationBoardItem[]>([])
  const [selectedClientId,  setSelectedClientId]  = useState<string | null>(null)
  const [isLoading,         setIsLoading]         = useState(false)
  const [boardOpen,         setBoardOpen]         = useState(false)

  // ── Fetch trending feed ───────────────────────────────────

  const fetchFeed = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        industry: industry,
        platform: platform,
        region:   region,
        limit:    '24',
        ...(aiFilter ? { ai_filter: 'true' } : {}),
      })
      const res  = await fetch(`/api/studio/trending-content?${params}`)
      const data = await res.json() as { items: TrendingContentItem[]; removed_count?: number }
      setItems(data.items ?? [])
      setRemovedCount(data.removed_count ?? 0)
    } catch {
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [industry, platform, region, aiFilter])

  // ── Fetch saved board ─────────────────────────────────────

  const fetchSaved = useCallback(async () => {
    if (!user?.id) return
    try {
      const res  = await fetch(`/api/studio/inspiration?saved_by=${encodeURIComponent(user.id)}`)
      const data = await res.json() as { items: InspirationBoardItem[] }
      setSavedItems(data.items ?? [])
    } catch {
      // non-critical
    }
  }, [user?.id])

  useEffect(() => { void fetchFeed() }, [fetchFeed])
  useEffect(() => { void fetchSaved() }, [fetchSaved])

  // ── Save / unsave ─────────────────────────────────────────

  async function handleSave(item: TrendingContentItem) {
    if (!selectedClientId) {
      setBoardOpen(true)
      return
    }

    try {
      const res  = await fetch('/api/studio/inspiration', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          client_id:     selectedClientId,
          saved_by:      user?.id ?? null,
          platform:      item.platform,
          content_type:  item.content_type,
          title:         item.title,
          url:           item.url,
          thumbnail_url: item.thumbnail_url,
          view_count:    item.view_count,
          channel:       item.channel,
          hashtag:       item.hashtag,
          industry:      item.industry,
        }),
      })
      const saved = await res.json() as InspirationBoardItem
      setSavedItems(prev => [saved, ...prev])
    } catch {
      // handle silently
    }
  }

  async function handleUnsave(item: TrendingContentItem) {
    // Find matching saved item by URL
    const found = savedItems.find(s => s.url === item.url && s.client_id === (selectedClientId ?? s.client_id))
    if (!found) return
    await handleRemove(found.id)
  }

  async function handleRemove(id: string) {
    try {
      await fetch(`/api/studio/inspiration?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      setSavedItems(prev => prev.filter(s => s.id !== id))
    } catch {
      // handle silently
    }
  }

  function handleUseAsInspiration(item: TrendingContentItem) {
    // Pre-fill the content studio brief via URL param
    const params = new URLSearchParams({
      inspiration_url:   item.url,
      inspiration_title: item.title,
    })
    window.open(`/studio/content?${params.toString()}`, '_self')
  }

  // ── Derived state ─────────────────────────────────────────

  const savedUrls = new Set(
    selectedClientId
      ? savedItems.filter(s => s.client_id === selectedClientId).map(s => s.url)
      : [],
  )

  const savedCount = selectedClientId
    ? savedItems.filter(s => s.client_id === selectedClientId).length
    : 0

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-novax-accent" />
            <h1 className="text-xl font-bold text-slate-900">Inspiration Library</h1>
          </div>
          <p className="text-sm text-slate-500">
            Live trending content from YouTube, TikTok and across the web — updated hourly.
          </p>
        </div>

        {/* Mobile board toggle */}
        <button
          onClick={() => setBoardOpen(v => !v)}
          className="lg:hidden flex items-center gap-1.5 text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-600 hover:border-novax-border hover:bg-novax-light/50 transition-colors"
        >
          Board
          {savedCount > 0 && (
            <span className="bg-novax text-white text-[10px] rounded-full px-1.5 py-0.5 font-medium">
              {savedCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3">

        {/* Custom niche search */}
        <form
          onSubmit={e => {
            e.preventDefault()
            const v = customNiche.trim()
            if (v) { setIndustry(v.toLowerCase().replace(/\s+/g, '_')); setCustomNiche('') }
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              ref={nicheInputRef}
              value={customNiche}
              onChange={e => setCustomNiche(e.target.value)}
              placeholder="Search any niche — luxury watches, pet care, gaming…"
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-novax-muted focus:ring-2 focus:ring-novax-light bg-white text-slate-700 placeholder:text-slate-400"
            />
          </div>
          <button
            type="submit"
            disabled={!customNiche.trim()}
            className="text-xs font-medium bg-novax hover:bg-novax-hover disabled:opacity-40 text-white rounded-lg px-3 py-1.5 transition-colors"
          >
            Search
          </button>
          {/* Current niche indicator if custom */}
          {!INDUSTRIES.find(i => i.value === industry) && (
            <span className="flex items-center gap-1.5 text-xs bg-novax-light border border-novax-border text-novax rounded-full px-3 py-1 shrink-0">
              {industry.replace(/_/g, ' ')}
              <button onClick={() => setIndustry('beauty')} className="hover:text-red-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </form>

        {/* Quick-pick industry chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <span className="text-[10px] text-slate-400 font-medium shrink-0 uppercase tracking-wide">Quick pick:</span>
          {INDUSTRIES.map(ind => (
            <button
              key={ind.value}
              onClick={() => setIndustry(ind.value)}
              className={cn(
                'shrink-0 text-xs font-medium rounded-full px-3 py-1.5 border transition-colors',
                industry === ind.value
                  ? 'bg-novax text-white border-novax'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-novax-border hover:bg-novax-light/50',
              )}
            >
              {ind.label}
            </button>
          ))}
        </div>

        {/* Platform + Region + AI filter + Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Platform tabs */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {PLATFORMS.map(p => (
              <button
                key={p.value}
                onClick={() => setPlatform(p.value)}
                className={cn(
                  'text-xs font-medium rounded-md px-3 py-1.5 transition-colors',
                  platform === p.value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Region selector */}
          <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
            <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="text-xs text-slate-700 bg-transparent outline-none cursor-pointer"
            >
              {REGIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* AI filter toggle */}
          <button
            onClick={() => setAiFilter(v => !v)}
            className={cn(
              'flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 transition-colors',
              aiFilter
                ? 'bg-novax text-white border-novax'
                : 'border-slate-200 text-slate-600 hover:border-novax-border hover:bg-novax-light/50',
            )}
            title="AI filter removes off-topic and wrong-language content"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Filter
            {aiFilter && removedCount > 0 && (
              <span className="ml-0.5 bg-white/20 text-white rounded-full px-1.5 text-[10px] font-bold">
                -{removedCount}
              </span>
            )}
          </button>

          <button
            onClick={fetchFeed}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:border-novax-border hover:bg-novax-light/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">

        {/* LEFT — Feed */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <TrendingUp className="w-10 h-10 text-slate-200 mb-3" />
              <p className="text-sm font-medium text-slate-500">
                No trending content found for this filter
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Try a different industry or platform
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(item => (
                <InspirationCard
                  key={item.id}
                  item={item}
                  isSaved={savedUrls.has(item.url)}
                  clientId={selectedClientId ?? undefined}
                  onSave={handleSave}
                  onUnsave={handleUnsave}
                  onUseAsInspiration={handleUseAsInspiration}
                />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — Board panel (desktop) */}
        <div className="hidden lg:block w-72 shrink-0 sticky top-6">
          <InspirationBoardPanel
            clientId={selectedClientId}
            savedItems={savedItems}
            onRemove={handleRemove}
            onClientChange={setSelectedClientId}
            clients={clients}
          />
        </div>
      </div>

      {/* Mobile board bottom sheet */}
      {boardOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex items-end">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setBoardOpen(false)}
          />

          {/* Sheet */}
          <div className="relative w-full bg-white rounded-t-3xl p-4 max-h-[80vh] overflow-y-auto z-50">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-slate-900">Inspiration Board</p>
              <button
                onClick={() => setBoardOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <InspirationBoardPanel
              clientId={selectedClientId}
              savedItems={savedItems}
              onRemove={handleRemove}
              onClientChange={setSelectedClientId}
              clients={clients}
            />
          </div>
        </div>
      )}
    </div>
  )
}
