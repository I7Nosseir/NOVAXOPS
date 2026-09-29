import { describe, test, expect } from 'vitest'
import { canSeePage, PAGE_DEFS, ALL_PAGE_KEYS, PAGE_GROUPS } from '@/lib/page-permissions'

// ---------------------------------------------------------------------------
// canSeePage()
// ---------------------------------------------------------------------------
describe('canSeePage()', () => {
  test('returns true when permissions is null (default — see all)', () => {
    expect(canSeePage('publishing', null)).toBe(true)
    expect(canSeePage('clients', null)).toBe(true)
    expect(canSeePage('studio', null)).toBe(true)
  })

  test('returns true when permissions is undefined (default — see all)', () => {
    expect(canSeePage('publishing', undefined)).toBe(true)
  })

  test('returns true when page key is in permissions array', () => {
    expect(canSeePage('publishing', ['publishing', 'moderation'])).toBe(true)
    expect(canSeePage('moderation', ['publishing', 'moderation'])).toBe(true)
  })

  test('returns false when permissions array is empty', () => {
    expect(canSeePage('publishing', [])).toBe(false)
    expect(canSeePage('clients', [])).toBe(false)
  })

  test('returns false when page key is not in permissions array', () => {
    expect(canSeePage('ceo', ['publishing', 'moderation'])).toBe(false)
    expect(canSeePage('studio', ['clients', 'projects'])).toBe(false)
  })

  test('is case-sensitive', () => {
    expect(canSeePage('Publishing', ['publishing'])).toBe(false)
    expect(canSeePage('publishing', ['Publishing'])).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// PAGE_DEFS structure
// ---------------------------------------------------------------------------
describe('PAGE_DEFS', () => {
  test('every page def has key, label, and group', () => {
    for (const def of PAGE_DEFS) {
      expect(def.key).toBeTruthy()
      expect(def.label).toBeTruthy()
      expect(def.group).toBeTruthy()
    }
  })

  test('all groups are valid', () => {
    const validGroups = new Set(PAGE_GROUPS)
    for (const def of PAGE_DEFS) {
      expect(validGroups.has(def.group as typeof PAGE_GROUPS[number])).toBe(true)
    }
  })

  test('page keys are unique', () => {
    const keys = PAGE_DEFS.map(p => p.key)
    const unique = new Set(keys)
    expect(unique.size).toBe(keys.length)
  })

  test('includes expected workspace pages', () => {
    const keys = PAGE_DEFS.map(p => p.key)
    expect(keys).toContain('clients')
    expect(keys).toContain('projects')
    expect(keys).toContain('publishing')
    expect(keys).toContain('approval')
    expect(keys).toContain('moderation')
  })

  test('includes studio pages', () => {
    const keys = PAGE_DEFS.map(p => p.key)
    expect(keys).toContain('studio')
    expect(keys).toContain('studio-content')
    expect(keys).toContain('studio-hooks')
    expect(keys).toContain('studio-strategy')
    expect(keys).toContain('studio-campaign')
    expect(keys).toContain('studio-visual')
    expect(keys).toContain('studio-formats')
  })
})

// ---------------------------------------------------------------------------
// ALL_PAGE_KEYS
// ---------------------------------------------------------------------------
describe('ALL_PAGE_KEYS', () => {
  test('contains the same keys as PAGE_DEFS', () => {
    expect(ALL_PAGE_KEYS).toHaveLength(PAGE_DEFS.length)
    for (const def of PAGE_DEFS) {
      expect(ALL_PAGE_KEYS).toContain(def.key)
    }
  })
})

// ---------------------------------------------------------------------------
// Required pages (Dashboard, Pipeline, Tasks, Settings) are NOT in PAGE_DEFS
// (they're always visible and not grantable/revokable)
// ---------------------------------------------------------------------------
describe('required pages not in PAGE_DEFS', () => {
  const requiredPages = ['dashboard', 'pipeline', 'tasks', 'settings']

  test.each(requiredPages)('"%s" is not in PAGE_DEFS (it is a required page)', (page) => {
    const keys = PAGE_DEFS.map(p => p.key)
    expect(keys).not.toContain(page)
  })
})

// ---------------------------------------------------------------------------
// Role-based access simulation
// A user with null permissions = admin / default → sees all pages
// A user with an empty array = minimum access → sees nothing optional
// ---------------------------------------------------------------------------
describe('role simulation via permissions arrays', () => {
  test('user with all page keys sees every optional page', () => {
    for (const key of ALL_PAGE_KEYS) {
      expect(canSeePage(key, ALL_PAGE_KEYS as string[])).toBe(true)
    }
  })

  test('user with only publishing/moderation cannot see studio', () => {
    const limited = ['publishing', 'moderation']
    expect(canSeePage('studio', limited)).toBe(false)
    expect(canSeePage('studio-content', limited)).toBe(false)
  })

  test('user with only publishing/moderation can see those pages', () => {
    const limited = ['publishing', 'moderation']
    expect(canSeePage('publishing', limited)).toBe(true)
    expect(canSeePage('moderation', limited)).toBe(true)
  })

  test('social_manager simulation: publishing + moderation access', () => {
    const socialManagerPages = ['publishing', 'moderation', 'assets', 'library']
    expect(canSeePage('publishing', socialManagerPages)).toBe(true)
    expect(canSeePage('moderation', socialManagerPages)).toBe(true)
    expect(canSeePage('clients', socialManagerPages)).toBe(false)
    expect(canSeePage('reports', socialManagerPages)).toBe(false)
    expect(canSeePage('studio', socialManagerPages)).toBe(false)
  })
})
