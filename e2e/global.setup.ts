import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '.auth/user.json')

setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL || 'test@novaxops.com'
  const password = process.env.TEST_USER_PASSWORD || 'testpassword123'

  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|login/i }).click()

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  await expect(page).toHaveURL(/dashboard/)

  // Save auth state
  await page.context().storageState({ path: authFile })
})
