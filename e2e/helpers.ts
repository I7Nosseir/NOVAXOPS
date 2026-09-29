import { Page } from '@playwright/test'

export async function waitForToast(page: Page, text?: string) {
  const toast = page.locator('[data-sonner-toast]').first()
  await toast.waitFor({ state: 'visible', timeout: 10000 })
  if (text) {
    await toast.getByText(text, { exact: false }).waitFor({ timeout: 5000 })
  }
  return toast
}

export async function closeModal(page: Page) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}
