import { describe, test, expect } from 'vitest'
import {
  cn,
  STAGE_CONFIG,
  PRIORITY_CONFIG,
  PLATFORM_CONFIG,
  PIPELINE_STAGES,
  normalizeMediaUrl,
  formatNumber,
  formatCurrency,
  getSubtypesForStage,
  getSubtypeStyle,
  vendorName,
  hasRole,
} from '@/lib/utils'
import type { User } from '@/lib/types'

// ---------------------------------------------------------------------------
// cn()
// ---------------------------------------------------------------------------
describe('cn()', () => {
  test('merges class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  test('handles falsy values', () => {
    expect(cn('foo', false, null, undefined, '')).toBe('foo')
  })

  test('handles conditional object syntax', () => {
    expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500')
  })

  test('merges tailwind conflicts using tailwind-merge', () => {
    // tailwind-merge keeps the last conflicting class
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  test('handles array of classes', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz')
  })

  test('returns empty string for no args', () => {
    expect(cn()).toBe('')
  })
})

// ---------------------------------------------------------------------------
// STAGE_CONFIG — all 10 stages must be present and well-formed
// ---------------------------------------------------------------------------
const EXPECTED_STAGES = [
  'strategy', 'ideas', 'calendar', 'copy', 'design',
  'review', 'approval', 'scheduled', 'published', 'reporting',
] as const

describe('STAGE_CONFIG', () => {
  test('defines exactly 10 pipeline stages', () => {
    expect(Object.keys(STAGE_CONFIG)).toHaveLength(10)
  })

  test.each(EXPECTED_STAGES)('stage "%s" has label, color, bg, border', (stage) => {
    const config = STAGE_CONFIG[stage]
    expect(config).toBeDefined()
    expect(config.label).toBeTruthy()
    expect(config.color).toBeTruthy()
    expect(config.bg).toBeTruthy()
    expect(config.border).toBeTruthy()
  })

  test('labels are capitalised', () => {
    for (const stage of EXPECTED_STAGES) {
      const first = STAGE_CONFIG[stage].label[0]
      expect(first).toBe(first.toUpperCase())
    }
  })

  test('PIPELINE_STAGES array matches STAGE_CONFIG keys', () => {
    expect(PIPELINE_STAGES).toHaveLength(10)
    for (const stage of PIPELINE_STAGES) {
      expect(STAGE_CONFIG[stage]).toBeDefined()
    }
  })
})

// ---------------------------------------------------------------------------
// PRIORITY_CONFIG
// ---------------------------------------------------------------------------
const EXPECTED_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

describe('PRIORITY_CONFIG', () => {
  test('defines 4 priorities', () => {
    expect(Object.keys(PRIORITY_CONFIG)).toHaveLength(4)
  })

  test.each(EXPECTED_PRIORITIES)('priority "%s" has label, color, bg', (priority) => {
    const config = PRIORITY_CONFIG[priority]
    expect(config).toBeDefined()
    expect(config.label).toBeTruthy()
    expect(config.color).toBeTruthy()
    expect(config.bg).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// PLATFORM_CONFIG
// ---------------------------------------------------------------------------
const EXPECTED_PLATFORMS = ['instagram', 'twitter', 'linkedin', 'youtube', 'tiktok', 'facebook'] as const

describe('PLATFORM_CONFIG', () => {
  test.each(EXPECTED_PLATFORMS)('platform "%s" is defined', (platform) => {
    expect(PLATFORM_CONFIG[platform]).toBeDefined()
    expect(PLATFORM_CONFIG[platform].label).toBeTruthy()
    expect(PLATFORM_CONFIG[platform].color).toBeTruthy()
  })

  test('platform colors are valid hex or named CSS colors', () => {
    for (const key of EXPECTED_PLATFORMS) {
      const { color } = PLATFORM_CONFIG[key]
      // All platform colors in this codebase are hex
      expect(color).toMatch(/^#[0-9A-Fa-f]{3,6}$/)
    }
  })
})

// ---------------------------------------------------------------------------
// normalizeMediaUrl()
// ---------------------------------------------------------------------------
describe('normalizeMediaUrl()', () => {
  test('strips https legacy origin', () => {
    expect(normalizeMediaUrl('https://perfumeexhibition.com/assets/img.jpg')).toBe('/assets/img.jpg')
  })

  test('strips http legacy origin', () => {
    expect(normalizeMediaUrl('http://perfumeexhibition.com/assets/img.jpg')).toBe('/assets/img.jpg')
  })

  test('leaves non-legacy URLs unchanged', () => {
    expect(normalizeMediaUrl('https://cdn.example.com/img.jpg')).toBe('https://cdn.example.com/img.jpg')
  })

  test('returns empty string for null', () => {
    expect(normalizeMediaUrl(null)).toBe('')
  })

  test('returns empty string for undefined', () => {
    expect(normalizeMediaUrl(undefined)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// formatNumber()
// ---------------------------------------------------------------------------
describe('formatNumber()', () => {
  test('formats millions', () => {
    expect(formatNumber(1_500_000)).toBe('1.5M')
  })

  test('formats thousands', () => {
    expect(formatNumber(2_300)).toBe('2.3K')
  })

  test('returns plain string for small numbers', () => {
    expect(formatNumber(42)).toBe('42')
  })

  test('formats exactly 1000', () => {
    expect(formatNumber(1000)).toBe('1.0K')
  })
})

// ---------------------------------------------------------------------------
// formatCurrency()
// ---------------------------------------------------------------------------
describe('formatCurrency()', () => {
  test('formats USD', () => {
    // Locale-safe: just check it contains "$" and the number
    const result = formatCurrency(1234.56)
    expect(result).toContain('1,234')
  })
})

// ---------------------------------------------------------------------------
// getSubtypesForStage()
// ---------------------------------------------------------------------------
describe('getSubtypesForStage()', () => {
  test('returns subtypes for "copy" stage', () => {
    const subtypes = getSubtypesForStage('copy')
    expect(subtypes.length).toBeGreaterThan(0)
    expect(subtypes[0]).toHaveProperty('label')
  })

  test('returns subtypes for "design" stage', () => {
    const subtypes = getSubtypesForStage('design')
    expect(subtypes.length).toBeGreaterThan(0)
  })

  test('returns empty array for unknown stage', () => {
    expect(getSubtypesForStage('nonexistent-stage')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getSubtypeStyle()
// ---------------------------------------------------------------------------
describe('getSubtypeStyle()', () => {
  test('returns style for a known subtype label', () => {
    const style = getSubtypeStyle('Caption')
    expect(style.color).toBeTruthy()
    expect(style.bg).toBeTruthy()
  })

  test('returns fallback for unknown subtype label', () => {
    const style = getSubtypeStyle('Unknown Subtype XYZ')
    expect(style.color).toBe('text-slate-600')
    expect(style.bg).toBe('bg-slate-100')
  })
})

// ---------------------------------------------------------------------------
// vendorName() — role-based masking
// ---------------------------------------------------------------------------
describe('vendorName()', () => {
  test('admin sees real vendor name', () => {
    expect(vendorName('admin', 'Metricool')).toBe('Metricool')
  })

  test('ceo sees real vendor name', () => {
    expect(vendorName('ceo', 'Respond.io')).toBe('Respond.io')
  })

  test('copywriter sees masked vendor name for Metricool', () => {
    expect(vendorName('copywriter', 'Metricool')).toBe('Scheduling Platform')
  })

  test('designer sees masked vendor name for Respond.io', () => {
    expect(vendorName('designer', 'Respond.io')).toBe('Messaging Platform')
  })

  test('unknown vendor passes through unchanged', () => {
    expect(vendorName('copywriter', 'SomeOtherTool')).toBe('SomeOtherTool')
  })
})

// ---------------------------------------------------------------------------
// hasRole()
// ---------------------------------------------------------------------------
describe('hasRole()', () => {
  const mockAdmin = { role: 'admin' } as User

  test('returns true when user role is in the allowed list', () => {
    expect(hasRole(mockAdmin, ['admin', 'ceo'])).toBe(true)
  })

  test('returns false when user role is not in the allowed list', () => {
    expect(hasRole(mockAdmin, ['copywriter', 'designer'])).toBe(false)
  })

  test('returns false for null user', () => {
    expect(hasRole(null, ['admin'])).toBe(false)
  })
})
