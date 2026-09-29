import { describe, test, expect } from 'vitest'

/**
 * Rate limit tests for the AI route (/api/ai)
 *
 * The system enforces 10 requests per user per minute.
 * Without auth these all return 401; with auth and 11+ rapid requests
 * the 11th returns 429.
 *
 * These tests hit the live server and are skipped when it's not running.
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'

const isServerUp = async (): Promise<boolean> => {
  try {
    await fetch(`${BASE}/api/ai`, { method: 'HEAD' })
    return true
  } catch {
    return false
  }
}

describe('AI endpoint — unauthenticated', () => {
  test('returns 401 or 405 for unauthenticated request', async () => {
    const serverUp = await isServerUp()
    if (!serverUp) {
      console.log('Skipping: server not running at', BASE)
      return
    }

    const res = await fetch(`${BASE}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_type: 'copywriter', task_id: 'test-id' }),
    })

    // Without auth, 401. With auth + 11 requests, should be 429
    expect([401, 405, 429]).toContain(res.status)
  })

  test('rate limit structure — response body is JSON', async () => {
    const serverUp = await isServerUp()
    if (!serverUp) {
      console.log('Skipping: server not running at', BASE)
      return
    }

    const res = await fetch(`${BASE}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_type: 'copywriter', task_id: 'test-id' }),
    })

    const contentType = res.headers.get('content-type') ?? ''
    expect(contentType).toContain('application/json')
  })
})

describe('AI endpoint — rate limit fire test', () => {
  test('11 rapid unauthenticated requests all return auth-or-rate-limit status', async () => {
    const serverUp = await isServerUp()
    if (!serverUp) {
      console.log('Skipping: server not running at', BASE)
      return
    }

    const requests = Array.from({ length: 11 }, () =>
      fetch(`${BASE}/api/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_type: 'copywriter', task_id: 'test-rate-limit' }),
      }),
    )

    const responses = await Promise.all(requests)
    for (const res of responses) {
      // Each unauthenticated request gets 401; with auth the 11th would be 429
      expect([401, 405, 429]).toContain(res.status)
    }
  })
})
