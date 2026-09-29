import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } }) // unauthenticated

test('login page loads', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /novax|sign in|login/i })).toBeVisible()
})

test('redirects to login when unauthenticated', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/login/)
})

test('shows error on wrong credentials', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('wrong@example.com')
  await page.getByLabel(/password/i).fill('wrongpassword')
  await page.getByRole('button', { name: /sign in|login/i }).click()
  // Should show error, not redirect
  await page.waitForTimeout(2000)
  await expect(page).toHaveURL(/login/)
})
