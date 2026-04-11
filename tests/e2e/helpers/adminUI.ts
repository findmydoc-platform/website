import { expect, Page } from '@playwright/test'
import type { AdminSessionCredentials } from './adminSession'

export type BrowserIssueCollector = {
  consoleErrors: string[]
  pageErrors: string[]
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const createBrowserIssueCollector = (page: Page): BrowserIssueCollector => {
  const issues: BrowserIssueCollector = {
    consoleErrors: [],
    pageErrors: [],
  }

  page.on('console', (message) => {
    if (message.type() === 'error') {
      issues.consoleErrors.push(message.text())
    }
  })

  page.on('pageerror', (error) => {
    issues.pageErrors.push(error.message)
  })

  return issues
}

export const expectNoBrowserIssues = async (issues: BrowserIssueCollector) => {
  expect.soft(issues.consoleErrors, 'Unexpected browser console errors').toEqual([])
  expect.soft(issues.pageErrors, 'Unexpected uncaught browser errors').toEqual([])
}

export const loginAsAdmin = async (page: Page, credentials: AdminSessionCredentials) => {
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/admin(?:\/)?$/)
}

export const openAdminTab = async (page: Page, label: string) => {
  const exactLabel = new RegExp(`^${escapeRegExp(label)}$`, 'i')
  const tab = page.getByRole('tab', { name: exactLabel }).first()

  if ((await tab.count()) > 0) {
    await tab.click()
    return
  }

  await page.getByRole('button', { name: exactLabel }).first().click()
}

export const selectComboboxOption = async (page: Page, label: string, optionLabel: string) => {
  const exactLabel = new RegExp(`^${escapeRegExp(label)}(?:\\s*\\*)?$`, 'i')
  const labeledCombobox = page.getByRole('combobox', { name: exactLabel }).first()

  let combobox = labeledCombobox

  if ((await combobox.count()) === 0) {
    const field = page
      .locator('main')
      .getByText(exactLabel)
      .first()
      .locator('xpath=ancestor::*[.//*[@role="combobox"]][1]')

    combobox = field.getByRole('combobox').first()
  }

  await expect(combobox).toBeVisible()
  await combobox.click()
  await combobox.fill(optionLabel)
  const option = page.getByRole('option', { name: new RegExp(`^${escapeRegExp(optionLabel)}$`, 'i') }).first()
  await expect(option).toBeVisible()
  await option.click()
}

export const saveAdminDocument = async (page: Page) => {
  await page.getByRole('button', { name: /^Save$/ }).click()
  await page.waitForURL(/\/admin\/collections\/clinics\/[^/]+$/)
}

export const saveAdminDocumentForCollection = async (page: Page, collectionSlug: string) => {
  const escapedSlug = escapeRegExp(collectionSlug)
  await page.getByRole('button', { name: /^Save$/ }).click()
  await page.waitForURL(new RegExp(`/admin/collections/${escapedSlug}/[^/]+$`))
}

export const selectFirstComboboxOption = async (page: Page, label: string) => {
  const exactLabel = new RegExp(`^${escapeRegExp(label)}(?:\\s*\\*)?$`, 'i')
  const labeledCombobox = page.getByRole('combobox', { name: exactLabel }).first()

  let combobox = labeledCombobox

  if ((await combobox.count()) === 0) {
    const field = page
      .locator('main')
      .getByText(exactLabel)
      .first()
      .locator('xpath=ancestor::*[.//*[@role="combobox"]][1]')

    combobox = field.getByRole('combobox').first()
  }

  await expect(combobox).toBeVisible()
  await combobox.click()

  const option = page.getByRole('option').first()
  await expect(option).toBeVisible()
  await option.click()
}
