import { test, expect } from '@playwright/test'

test('publishing page loads', async ({ page }) => {
  await page.goto('/publishing')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/publishing/)
})

test('compose button is visible', async ({ page }) => {
  await page.goto('/publishing')
  const composeBtn = page.getByRole('button', { name: /compose|new post|create/i }).first()
  await composeBtn.waitFor({ timeout: 10000 })
  await expect(composeBtn).toBeVisible()
})

test('calendar view toggle works', async ({ page }) => {
  await page.goto('/publishing')
  const calendarBtn = page.getByRole('button', { name: /calendar/i }).first()
  if (await calendarBtn.isVisible()) {
    await calendarBtn.click()
    await page.waitForTimeout(500)
    // Should show calendar grid
    await expect(page.locator('[class*="calendar"]').first()).toBeVisible()
  }
})
