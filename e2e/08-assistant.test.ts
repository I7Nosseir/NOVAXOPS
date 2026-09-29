import { test, expect } from '@playwright/test'

test('AI assistant page loads', async ({ page }) => {
  await page.goto('/assistant')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/assistant/)
})

test('assistant has a message input', async ({ page }) => {
  await page.goto('/assistant')
  const input = page.getByRole('textbox').first().or(page.locator('textarea').first())
  await expect(input).toBeVisible({ timeout: 10000 })
})

test('assistant input accepts text', async ({ page }) => {
  await page.goto('/assistant')
  const input = page.getByRole('textbox').first().or(page.locator('textarea').first())
  await input.waitFor({ timeout: 10000 })
  await input.fill('Hello, test message')
  await expect(input).toHaveValue('Hello, test message')
})
