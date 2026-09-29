import { test, expect } from '@playwright/test'

test('pipeline board loads with columns', async ({ page }) => {
  await page.goto('/pipeline')
  await page.waitForLoadState('networkidle')
  // Check at least one stage column is visible
  const columns = page.locator('[data-stage], [class*="column"], [class*="stage"]')
  await expect(columns.first()).toBeVisible({ timeout: 10000 })
})

test('can open new task dialog', async ({ page }) => {
  await page.goto('/pipeline')
  // Find new task button
  const newTaskBtn = page.getByRole('button', { name: /new task|add task|\+ task/i }).first()
  await newTaskBtn.waitFor({ timeout: 10000 })
  await newTaskBtn.click()
  // Dialog should open
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
})

test('task dialog has required fields', async ({ page }) => {
  await page.goto('/pipeline')
  const newTaskBtn = page.getByRole('button', { name: /new task|add task|\+ task/i }).first()
  await newTaskBtn.click()
  await page.getByRole('dialog').waitFor({ timeout: 5000 })
  // Title field should be present
  await expect(page.getByLabel(/title/i).or(page.getByPlaceholder(/title/i))).toBeVisible()
})
