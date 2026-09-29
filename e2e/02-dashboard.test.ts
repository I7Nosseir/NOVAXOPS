import { test, expect } from '@playwright/test'

test('dashboard loads with key sections', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/dashboard/)
  // Check page renders something (not a crash)
  await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10000 })
})

test('sidebar navigation is visible', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('nav, aside').first()).toBeVisible()
})

test('can navigate to pipeline from sidebar', async ({ page }) => {
  await page.goto('/dashboard')
  await page.getByRole('link', { name: /pipeline/i }).first().click()
  await expect(page).toHaveURL(/pipeline/)
})
