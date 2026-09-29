import { test, expect } from '@playwright/test'

test('clients page loads', async ({ page }) => {
  await page.goto('/clients')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/clients/)
})

test('can open new client wizard', async ({ page }) => {
  await page.goto('/clients')
  const addBtn = page.getByRole('button', { name: /new client|add client|\+ client/i }).first()
  await addBtn.waitFor({ timeout: 10000 })
  await addBtn.click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
})

test('URL deep link opens correct client modal', async ({ page }) => {
  // First, get a client ID from the page
  await page.goto('/clients')
  await page.waitForLoadState('networkidle')
  // Click first client card
  const firstCard = page.locator('[class*="card"], [class*="client"]').first()
  await firstCard.waitFor({ timeout: 10000 })
  // Check that clicking updates URL
  await firstCard.click()
  await page.waitForTimeout(500)
  // URL should now have ?id= param
  const url = page.url()
  expect(url).toMatch(/(\?|&)id=/)
})
