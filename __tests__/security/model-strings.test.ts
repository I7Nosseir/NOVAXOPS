import { describe, test, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

/**
 * Regression tests — model string hygiene
 *
 * These tests scan the entire TypeScript/TSX source to ensure:
 *   1. No deprecated @google/generative-ai import is used (use the REST client instead)
 *   2. All Gemini model references use exactly 'gemini-3-flash-preview'
 *   3. Claude model references use the approved versioned strings
 */

const SKIP_DIRS = new Set(['node_modules', '.next', '__tests__', 'e2e', '.git', 'coverage'])

function findTsFiles(dir: string): string[] {
  const results: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }
  for (const f of entries) {
    const full = join(dir, f)
    let stat
    try {
      stat = statSync(full)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(f)) results.push(...findTsFiles(full))
    } else if (f.endsWith('.ts') || f.endsWith('.tsx')) {
      results.push(full)
    }
  }
  return results
}

const ROOT = process.cwd()
const TS_FILES = findTsFiles(ROOT)

describe('no deprecated @google/generative-ai import', () => {
  test('no source file imports from @google/generative-ai', () => {
    const violations: string[] = []
    for (const file of TS_FILES) {
      const content = readFileSync(file, 'utf-8')
      if (content.includes('@google/generative-ai')) {
        violations.push(file.replace(ROOT, ''))
      }
    }
    if (violations.length > 0) {
      console.error('Files with @google/generative-ai import:', violations)
    }
    expect(violations).toEqual([])
  })
})

describe('all gemini model references use gemini-3-flash-preview', () => {
  // This pattern matches any gemini-<something> that is NOT gemini-3-flash-preview
  const BAD_GEMINI_MODEL = /gemini-(?!3-flash-preview)[a-z0-9.\-]+/g

  test('no non-approved gemini model strings exist in the codebase', () => {
    const violations: string[] = []
    for (const file of TS_FILES) {
      const content = readFileSync(file, 'utf-8')
      const matches = content.match(BAD_GEMINI_MODEL)
      if (matches) {
        violations.push(`${file.replace(ROOT, '')}: ${matches.join(', ')}`)
      }
    }
    if (violations.length > 0) {
      console.error('Unapproved Gemini model strings:', violations)
    }
    expect(violations).toEqual([])
  })
})

describe('Claude model string hygiene', () => {
  const APPROVED_CLAUDE_MODELS = [
    'claude-sonnet-4-6',
    'claude-opus-4-7',
  ]

  test('lib/ai-client.ts only references approved Claude model IDs', () => {
    const aiClientPath = join(ROOT, 'lib', 'ai-client.ts')
    const content = readFileSync(aiClientPath, 'utf-8')

    // Check no alias strings are used
    expect(content).not.toContain('claude-3-sonnet')
    expect(content).not.toContain('claude-3-opus')
    expect(content).not.toContain('claude-instant')
    expect(content).not.toContain('claude-2')

    // The approved models should be present
    for (const model of APPROVED_CLAUDE_MODELS) {
      expect(content).toContain(model)
    }
  })

  test('no "claude-latest" alias appears in source (always use versioned model IDs)', () => {
    const violations: string[] = []
    for (const file of TS_FILES) {
      const content = readFileSync(file, 'utf-8')
      if (content.includes('claude-latest') || content.includes('claude-3-latest')) {
        violations.push(file.replace(ROOT, ''))
      }
    }
    expect(violations).toEqual([])
  })
})

describe('Gemini model constant value', () => {
  test('lib/gemini.ts defines MODEL as gemini-3-flash-preview', () => {
    const geminiPath = join(ROOT, 'lib', 'gemini.ts')
    const content = readFileSync(geminiPath, 'utf-8')
    expect(content).toContain("const MODEL   = 'gemini-3-flash-preview'")
  })

  test('lib/ai-client.ts dev fallback is gemini-3-flash-preview', () => {
    const aiClientPath = join(ROOT, 'lib', 'ai-client.ts')
    const content = readFileSync(aiClientPath, 'utf-8')
    expect(content).toContain('gemini-3-flash-preview')
  })
})
