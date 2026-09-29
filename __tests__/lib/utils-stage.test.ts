import { describe, test, expect } from 'vitest'
import { STAGE_CONFIG, PIPELINE_STAGES } from '@/lib/utils'

const EXPECTED_STAGES = [
  'strategy', 'ideas', 'calendar', 'copy', 'design',
  'review', 'approval', 'scheduled', 'published', 'reporting',
] as const

describe('STAGE_CONFIG — completeness', () => {
  test('all 10 stages are defined', () => {
    EXPECTED_STAGES.forEach(stage => {
      expect(STAGE_CONFIG[stage]).toBeDefined()
      expect(STAGE_CONFIG[stage].label).toBeTruthy()
      expect(STAGE_CONFIG[stage].color).toBeTruthy()
      expect(STAGE_CONFIG[stage].bg).toBeTruthy()
      expect(STAGE_CONFIG[stage].border).toBeTruthy()
    })
  })

  test('stage count is exactly 10', () => {
    expect(Object.keys(STAGE_CONFIG)).toHaveLength(10)
  })

  test('no extra unexpected stages', () => {
    const configKeys = Object.keys(STAGE_CONFIG)
    for (const key of configKeys) {
      expect(EXPECTED_STAGES).toContain(key as typeof EXPECTED_STAGES[number])
    }
  })
})

describe('STAGE_CONFIG — individual stage values', () => {
  test('strategy stage has violet color', () => {
    expect(STAGE_CONFIG.strategy.color).toContain('violet')
    expect(STAGE_CONFIG.strategy.bg).toContain('violet')
  })

  test('published stage has emerald color (live content)', () => {
    expect(STAGE_CONFIG.published.color).toContain('emerald')
  })

  test('approval stage has pink color', () => {
    expect(STAGE_CONFIG.approval.color).toContain('pink')
  })

  test('reporting stage uses slate color (analytics)', () => {
    expect(STAGE_CONFIG.reporting.color).toContain('slate')
  })

  test('copy stage has amber color (production)', () => {
    expect(STAGE_CONFIG.copy.color).toContain('amber')
  })

  test('review stage has rose color (quality)', () => {
    expect(STAGE_CONFIG.review.color).toContain('rose')
  })
})

describe('STAGE_CONFIG — label correctness', () => {
  test.each([
    ['strategy', 'Strategy'],
    ['ideas', 'Ideas'],
    ['calendar', 'Calendar'],
    ['copy', 'Copy'],
    ['design', 'Design'],
    ['review', 'Review'],
    ['approval', 'Approval'],
    ['scheduled', 'Scheduled'],
    ['published', 'Published'],
    ['reporting', 'Reporting'],
  ] as const)('stage "%s" has label "%s"', (stage, label) => {
    expect(STAGE_CONFIG[stage].label).toBe(label)
  })
})

describe('PIPELINE_STAGES array', () => {
  test('has 10 stages in the correct order', () => {
    expect(PIPELINE_STAGES).toHaveLength(10)
    expect(PIPELINE_STAGES[0]).toBe('strategy')
    expect(PIPELINE_STAGES[9]).toBe('reporting')
  })

  test('published comes before reporting', () => {
    const publishedIdx = PIPELINE_STAGES.indexOf('published')
    const reportingIdx = PIPELINE_STAGES.indexOf('reporting')
    expect(publishedIdx).toBeLessThan(reportingIdx)
  })

  test('approval comes before scheduled', () => {
    const approvalIdx = PIPELINE_STAGES.indexOf('approval')
    const scheduledIdx = PIPELINE_STAGES.indexOf('scheduled')
    expect(approvalIdx).toBeLessThan(scheduledIdx)
  })

  test('copy comes before design', () => {
    const copyIdx = PIPELINE_STAGES.indexOf('copy')
    const designIdx = PIPELINE_STAGES.indexOf('design')
    expect(copyIdx).toBeLessThan(designIdx)
  })
})
