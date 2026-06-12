// Canonical list of optional pages that admin can grant/revoke per user.
// Required pages (Dashboard, Pipeline, Tasks, Settings) are always visible
// and are NOT in this list.

export const PAGE_DEFS = [
  { key: 'clients',                 label: 'Clients',                group: 'Workspace' },
  { key: 'projects',                label: 'Projects',               group: 'Workspace' },
  { key: 'publishing',              label: 'Publishing',             group: 'Workspace' },
  { key: 'approval',                label: 'Approval',               group: 'Workspace' },
  { key: 'moderation',              label: 'Moderation',             group: 'Workspace' },
  { key: 'assets',                  label: 'Assets',                 group: 'Creative' },
  { key: 'ai-image',                label: 'AI Image',               group: 'Creative' },
  { key: 'creative-eval',           label: 'Creative Eval',          group: 'Creative' },
  { key: 'docs',                    label: 'Documents',              group: 'Creative' },
  { key: 'assistant',               label: 'AI Assistant',           group: 'Intelligence' },
  { key: 'performance',             label: 'Performance',            group: 'Intelligence' },
  { key: 'workload',                label: 'Workload',               group: 'Intelligence' },
  { key: 'library',                 label: 'Content Library',        group: 'Intelligence' },
  { key: 'reports',                 label: 'Reports',                group: 'Intelligence' },
  // Studio tools — granting 'studio' unlocks the hub; individual keys unlock each tool
  { key: 'studio',                  label: 'Studio Hub',             group: 'Studio' },
  { key: 'studio-content',          label: 'Content Studio',         group: 'Studio' },
  { key: 'studio-hooks',            label: 'Hook Lab',               group: 'Studio' },
  { key: 'studio-strategy',         label: 'Strategy',               group: 'Studio' },
  { key: 'studio-campaign',         label: 'Campaign Igniter',       group: 'Studio' },
  { key: 'studio-visual',           label: 'Visual Engine',          group: 'Studio' },
  { key: 'studio-formats',          label: 'Peak Format Generator',  group: 'Studio' },
  { key: 'studio-media-buying',     label: 'Media Buying Plan',      group: 'Studio' },
  { key: 'studio-copy',             label: 'Copy Engine',            group: 'Studio' },
  // Creative evaluation
  { key: 'strategy-eval',           label: 'Strategy & Content Eval', group: 'Creative' },
] as const

export type PageKey = typeof PAGE_DEFS[number]['key']

export const ALL_PAGE_KEYS = PAGE_DEFS.map(p => p.key) as PageKey[]

export const PAGE_GROUPS = ['Workspace', 'Creative', 'Intelligence', 'Studio'] as const

/**
 * Returns true if the user can see a given optional page.
 * null/undefined permissions means all pages are visible (default).
 */
export function canSeePage(key: string, permissions: string[] | null | undefined): boolean {
  if (permissions == null) return true
  return permissions.includes(key)
}
