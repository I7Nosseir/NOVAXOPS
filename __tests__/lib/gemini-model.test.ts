import { describe, test, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Regression tests ensuring the Gemini model string is always the correct
 * approved string: 'gemini-3-flash-preview'
 *
 * We test via file source reads to avoid calling the SDK (no API key in tests)
 * and via dynamic imports with global fetch mocked.
 */

// Mock fetch globally so geminiGenerate doesn't make real network calls
vi.stubGlobal('fetch', vi.fn())

const APPROVED_MODEL = 'gemini-3-flash-preview'
const GEMINI_FILE = join(process.cwd(), 'lib', 'gemini.ts')
const AI_CLIENT_FILE = join(process.cwd(), 'lib', 'ai-client.ts')

describe('Gemini model string — lib/gemini.ts source', () => {
  const source = readFileSync(GEMINI_FILE, 'utf-8')

  test('file declares MODEL as "gemini-3-flash-preview"', () => {
    expect(source).toContain(`'${APPROVED_MODEL}'`)
  })

  test('MODEL constant is assigned the approved model', () => {
    // Exact line check
    expect(source).toMatch(/const MODEL\s+=\s+'gemini-3-flash-preview'/)
  })

  test('no other gemini model strings appear in the file', () => {
    // Strip approved references then check for any other gemini-* strings
    const stripped = source.replace(/gemini-3-flash-preview/g, '')
    expect(stripped).not.toMatch(/gemini-[a-z0-9.\-]+/i)
  })
})

describe('Gemini model string — lib/ai-client.ts source', () => {
  const source = readFileSync(AI_CLIENT_FILE, 'utf-8')

  test('file contains the approved model string for the dev fallback', () => {
    expect(source).toContain(APPROVED_MODEL)
  })

  test('AI_MODELS.primary is claude-sonnet-4-6', () => {
    expect(source).toContain("primary: 'claude-sonnet-4-6'")
  })

  test('AI_MODELS.advanced is claude-opus-4-7', () => {
    expect(source).toContain("advanced: 'claude-opus-4-7'")
  })
})

describe('geminiGenerate — module exports', () => {
  test('lib/gemini.ts exports geminiGenerate as a function (source check)', () => {
    const source = readFileSync(GEMINI_FILE, 'utf-8')
    expect(source).toContain('export async function geminiGenerate')
  })

  test('lib/gemini.ts exports geminiJson as a function (source check)', () => {
    const source = readFileSync(GEMINI_FILE, 'utf-8')
    expect(source).toContain('export async function geminiJson')
  })
})

describe('Gemini URL construction uses the correct model', () => {
  test('the fetch URL in lib/gemini.ts includes the model variable', () => {
    const source = readFileSync(GEMINI_FILE, 'utf-8')
    // The URL construction should reference MODEL
    expect(source).toContain('${MODEL}')
  })

  test('the URL pattern looks correct (v1beta endpoint)', () => {
    const source = readFileSync(GEMINI_FILE, 'utf-8')
    expect(source).toContain('generativelanguage.googleapis.com/v1beta/models/')
  })
})
