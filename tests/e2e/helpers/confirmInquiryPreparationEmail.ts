import { expect, type Page } from '@playwright/test'

export async function confirmInquiryPreparationEmail(page: Page) {
  await expect(page).toHaveURL('/auth/confirm?type=patient-verification')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  const confirm = page.getByRole('main').getByRole('button')
  await expect(confirm).toBeVisible()
  await confirm.click()
}
