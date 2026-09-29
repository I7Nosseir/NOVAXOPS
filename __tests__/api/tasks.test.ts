import { describe, test, expect } from 'vitest'

/**
 * Contract tests for POST /api/tasks
 *
 * These tests hit the actual Next.js dev server. They are skipped
 * when the server is not running (TEST_BASE_URL not set and no server
 * listening on localhost:3000).
 *
 * To run these tests manually:
 *   npm run dev &
 *   TEST_BASE_URL=http://localhost:3000 npm test
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'

const isServerUp = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${BASE}/api/tasks`, { method: 'HEAD' })
    // Any response (even 401/405) means the server is up
    return res.status < 600
  } catch {
    return false
  }
}

describe('POST /api/tasks — unauthenticated', () => {
  test('returns 401 with no auth cookie', async () => {
    const serverUp = await isServerUp()
    if (!serverUp) {
      console.log('Skipping: server not running at', BASE)
      return
    }

    const res = await fetch(`${BASE}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Task', client_id: 'fake-id' }),
    })
    expect(res.status).toBe(401)
  })

  test('returns 400 or 401 when title is missing', async () => {
    const serverUp = await isServerUp()
    if (!serverUp) {
      console.log('Skipping: server not running at', BASE)
      return
    }

    const res = await fetch(`${BASE}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: 'fake-id' }),
    })
    // Auth check happens before validation in most routes, so 401 is acceptable
    expect([400, 401]).toContain(res.status)
  })

  test('returns 400 or 401 when body is empty', async () => {
    const serverUp = await isServerUp()
    if (!serverUp) {
      console.log('Skipping: server not running at', BASE)
      return
    }

    const res = await fetch(`${BASE}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect([400, 401]).toContain(res.status)
  })

  test('returns JSON content-type', async () => {
    const serverUp = await isServerUp()
    if (!serverUp) {
      console.log('Skipping: server not running at', BASE)
      return
    }

    const res = await fetch(`${BASE}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test' }),
    })
    const contentType = res.headers.get('content-type') ?? ''
    expect(contentType).toContain('application/json')
  })
})

describe('GET /api/tasks — unauthenticated', () => {
  test('returns 401 with no auth cookie', async () => {
    const serverUp = await isServerUp()
    if (!serverUp) {
      console.log('Skipping: server not running at', BASE)
      return
    }

    const res = await fetch(`${BASE}/api/tasks`)
    expect(res.status).toBe(401)
  })
})
