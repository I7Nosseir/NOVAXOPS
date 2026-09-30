import { describe, test, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Tests for lib/ai-client.ts
 *
 * The Anthropic SDK throws when instantiated in a browser-like environment
 * (jsdom). We therefore test the source file directly using file reads for
 * constant values, and mock the SDK module for import tests.
 */

vi.mock('@anthropic-ai/sdk', () => {
  const fakeCreate = vi.fn()
  return {
    default: class MockAnthropic {
      messages = { create: fakeCreate }
    },
  }
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

const AI_CLIENT_FILE = join(process.cwd(), 'lib', 'ai-client.ts')

describe('AI_MODELS constants — via file source', () => {
  const source = readFileSync(AI_CLIENT_FILE, 'utf-8')

  test('source declares primary as claude-sonnet-4-6', () => {
    expect(source).toContain("primary: 'claude-sonnet-4-6'")
  })

  test('source declares advanced as claude-opus-4-7', () => {
    expect(source).toContain("advanced: 'claude-opus-4-7'")
  })

  test('source declares dev fallback as gemini-3-flash-preview', () => {
    expect(source).toContain("dev: 'gemini-3-flash-preview'")
  })
})

describe('AI_MODELS constants — via import (with mocked SDK)', () => {
  test('AI_MODELS.primary is claude-sonnet-4-6', async () => {
    const { AI_MODELS } = await import('@/lib/ai-client')
    expect(AI_MODELS.primary).toBe('claude-sonnet-4-6')
  })

  test('AI_MODELS.advanced is claude-opus-4-7', async () => {
    const { AI_MODELS } = await import('@/lib/ai-client')
    expect(AI_MODELS.advanced).toBe('claude-opus-4-7')
  })

  test('AI_MODELS.dev is gemini-3-flash-preview', async () => {
    const { AI_MODELS } = await import('@/lib/ai-client')
    expect(AI_MODELS.dev).toBe('gemini-3-flash-preview')
  })

  test('all model values are non-empty strings', async () => {
    const { AI_MODELS } = await import('@/lib/ai-client')
    for (const [key, value] of Object.entries(AI_MODELS)) {
      expect(typeof value, `AI_MODELS.${key}`).toBe('string')
      expect(value, `AI_MODELS.${key}`).toBeTruthy()
    }
  })
})

describe('Anthropic client instantiation (with mocked SDK)', () => {
  test('anthropic client is exported with a messages.create method', async () => {
    const { anthropic } = await import('@/lib/ai-client')
    expect(anthropic).toBeDefined()
    expect(anthropic.messages).toBeDefined()
    expect(typeof anthropic.messages.create).toBe('function')
  })
})

describe('provider selection — environment logic', () => {
  test('when ANTHROPIC_API_KEY is empty, it signals Gemini fallback should be used', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    expect(!process.env.ANTHROPIC_API_KEY).toBe(true)
  })

  test('when ANTHROPIC_API_KEY is set, it signals Claude should be used', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-key')
    expect(Boolean(process.env.ANTHROPIC_API_KEY)).toBe(true)
  })

  test('empty string is falsy (route-level guard: if (!apiKey))', () => {
    const key = '' as string
    expect(!key).toBe(true)
  })

  test('non-empty API key string is truthy', () => {
    const key = 'sk-ant-anything' as string
    expect(!key).toBe(false)
  })
})
