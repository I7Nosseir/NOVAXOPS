import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } }) // unauthenticated for all security tests

test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/login/, { timeout: 10000 })
})

test('unauthenticated access to pipeline redirects to login', async ({ page }) => {
  await page.goto('/pipeline')
  await expect(page).toHaveURL(/login/, { timeout: 10000 })
})

test('unauthenticated access to settings redirects to login', async ({ page }) => {
  await page.goto('/settings')
  await expect(page).toHaveURL(/login/, { timeout: 10000 })
})

test('API tasks endpoint returns 401 without auth', async ({ request }) => {
  const res = await request.post('/api/tasks', {
    data: { title: 'Hack attempt', client_id: 'fake' },
  })
  expect(res.status()).toBe(401)
})

test('API AI endpoint returns 401 without auth', async ({ request }) => {
  const res = await request.post('/api/ai', {
    data: { agent_type: 'copywriter', task_id: 'fake' },
  })
  expect(res.status()).toBe(401)
})

test('API client delete returns 401 without auth', async ({ request }) => {
  const res = await request.delete('/api/clients/fake-id-12345')
  expect(res.status()).toBe(401)
})
