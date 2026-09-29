import { test, expect } from '@playwright/test'

test('studio hub loads', async ({ page }) => {
  await page.goto('/studio')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/studio/)
})

test('hook lab loads and has input form', async ({ page }) => {
  await page.goto('/studio/hooks')
  await page.waitForLoadState('networkidle')
  // Should have a brief/input area
  const input = page.getByRole('textbox').first().or(page.locator('textarea').first())
  await expect(input).toBeVisible({ timeout: 10000 })
})

test('content studio loads', async ({ page }) => {
  await page.goto('/studio/content')
  await page.waitForLoadState('networkidle')
  await expect(page).not.toHaveURL(/error/)
})
