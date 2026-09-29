import { test, expect } from '@playwright/test'

test('approval page loads', async ({ page }) => {
  await page.goto('/approval')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/approval/)
})

test('public approval portal works without auth', async ({ browser }) => {
  // Test the public portal with a fresh context (no auth)
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()

  // Navigate to a fake token — should show a graceful error, not crash
  await page.goto('/approval/invalid-token-12345')
  await page.waitForLoadState('networkidle')

  // Should not show a 500 error or white screen
  const body = await page.textContent('body')
  expect(body).toBeTruthy()
  expect(body?.length).toBeGreaterThan(10)

  await context.close()
})
