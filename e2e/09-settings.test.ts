import { test, expect } from '@playwright/test'

test('settings page loads', async ({ page }) => {
  await page.goto('/settings')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/settings/)
})

test('team tab is visible', async ({ page }) => {
  await page.goto('/settings')
  const teamTab = page.getByRole('tab', { name: /team/i }).or(
    page.getByRole('button', { name: /team/i })
  ).first()
  await expect(teamTab).toBeVisible({ timeout: 10000 })
})

test('invite button exists on team tab', async ({ page }) => {
  await page.goto('/settings')
  // Click team tab if present
  const teamTab = page.getByRole('tab', { name: /team/i }).first()
  if (await teamTab.isVisible()) {
    await teamTab.click()
    await page.waitForTimeout(500)
  }
  const inviteBtn = page.getByRole('button', { name: /invite/i }).first()
  await expect(inviteBtn).toBeVisible({ timeout: 10000 })
})
