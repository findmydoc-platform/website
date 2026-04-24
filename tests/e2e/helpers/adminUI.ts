import { expect, type Locator, type Page } from '@playwright/test'
import type { AdminSessionCredentials } from './adminSession'
import { createBrowserIssueCollector, expectNoBrowserIssues } from './browserIssues'

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const toFieldId = (fieldPath: string) => `field-${fieldPath.replace(/\./g, '__')}`
const resolveShortcutModifier = () => (process.platform === 'darwin' ? 'Meta' : 'Control')

type AdminSurface = Locator | Page

const resolveLabeledCombobox = async (surface: AdminSurface, label: string) => {
  const exactLabel = new RegExp(`^${escapeRegExp(label)}(?:\\s*\\*)?$`, 'i')
  const labeledCombobox = surface.getByRole('combobox', { name: exactLabel }).first()

  if ((await labeledCombobox.count()) > 0) {
    return labeledCombobox
  }

  return surface
    .getByText(exactLabel)
    .first()
    .locator('xpath=ancestor::*[.//*[@role="combobox"]][1]')
    .getByRole('combobox')
    .first()
}

export const loginToAdmin = async (page: Page, credentials: AdminSessionCredentials) => {
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/admin(?:\/)?$/)
}

export const loginAsAdmin = async (page: Page, credentials: AdminSessionCredentials) => loginToAdmin(page, credentials)

export const openAdminCollectionPage = async (page: Page, collectionSlug: string) => {
  await page.goto(`/admin/collections/${collectionSlug}`, { waitUntil: 'domcontentloaded' })
}

export const openAdminCreatePage = async (page: Page, collectionSlug: string) => {
  await page.goto(`/admin/collections/${collectionSlug}/create`, { waitUntil: 'domcontentloaded' })
}

export const openAdminDocumentPage = async (page: Page, collectionSlug: string, documentId: number | string) => {
  await page.goto(`/admin/collections/${collectionSlug}/${documentId}`, { waitUntil: 'domcontentloaded' })
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

export const selectComboboxOption = async (
  page: Page,
  label: string,
  optionLabel: string,
  options: {
    scope?: AdminSurface
  } = {},
) => {
  const surface = options.scope ?? page
  const combobox = await resolveLabeledCombobox(surface, label)
  await expect(combobox).toBeVisible()
  await combobox.click()
  await combobox.fill(optionLabel)
  const option = page.getByRole('option', { name: new RegExp(`^${escapeRegExp(optionLabel)}$`, 'i') }).first()
  await expect(option).toBeVisible()
  await option.click()
}

export const selectComboboxOptionIfVisible = async (
  page: Page,
  label: string,
  optionLabel: string,
  options: {
    scope?: AdminSurface
  } = {},
) => {
  const surface = options.scope ?? page
  const combobox = await resolveLabeledCombobox(surface, label)

  if ((await combobox.count()) === 0) {
    return false
  }

  try {
    await expect(combobox).toBeVisible({ timeout: 750 })
  } catch {
    return false
  }

  await selectComboboxOption(page, label, optionLabel, options)
  return true
}

export { createBrowserIssueCollector, expectNoBrowserIssues }

export const getAdminFieldRoot = (surface: AdminSurface, fieldPath: string) =>
  surface.locator(`[id="${toFieldId(fieldPath)}"]`).first()

export const getAdminDocumentDrawer = (page: Page) => page.locator('.doc-drawer').last()

export const openAdminJoinCreateDrawer = async (page: Page, fieldPath: string) => {
  const fieldRoot = getAdminFieldRoot(page, fieldPath)
  await expect(fieldRoot).toBeVisible()
  await fieldRoot
    .getByRole('button', { name: /add new/i })
    .first()
    .click()

  const drawer = getAdminDocumentDrawer(page)
  await expect(drawer).toBeVisible()
  return drawer
}

export const saveAdminDocument = async (page: Page) => {
  return saveAdminDocumentForCollection(page, 'clinics')
}

export const saveAdminDocumentForCollection = async (page: Page, collectionSlug: string) => {
  const escapedSlug = escapeRegExp(collectionSlug)
  await page.getByRole('button', { name: /^Save$/ }).click()
  await page.waitForURL(new RegExp(`/admin/collections/${escapedSlug}/[^/]+$`))

  const currentUrl = page.url()
  const match = currentUrl.match(new RegExp(`/admin/collections/${escapedSlug}/([^/?#]+)$`))
  return match?.[1]
}

export const saveAdminDrawerDocument = async (page: Page) => {
  const drawer = getAdminDocumentDrawer(page)
  await expect(drawer).toBeVisible()
  await drawer.getByRole('button', { name: /^Save$/ }).click()
  await expect(drawer).toBeHidden({ timeout: 15_000 })
}

export const fillAdminRichTextField = async (
  page: Page,
  label: string,
  value: string,
  options: {
    fieldPath?: string
    scope?: AdminSurface
  } = {},
) => {
  const surface = options.scope ?? page
  const fieldRoot = options.fieldPath ? getAdminFieldRoot(surface, options.fieldPath) : surface
  const exactLabel = new RegExp(`^${escapeRegExp(label)}(?:\\s*\\*)?$`, 'i')
  const labeledEditable = fieldRoot.getByLabel(exactLabel).first()
  const fieldTextbox = fieldRoot.getByRole('textbox').first()

  let editor = labeledEditable

  if ((await editor.count()) === 0 && (await fieldTextbox.count()) > 0) {
    editor = fieldTextbox
  }

  if ((await editor.count()) === 0) {
    editor = fieldRoot
      .getByText(exactLabel)
      .first()
      .locator('xpath=ancestor::*[.//*[@contenteditable] or .//*[@role="textbox"]][1]')
      .locator('[contenteditable], [role="textbox"]')
      .first()
  }

  await expect(editor).toBeVisible()
  await editor.click()
  await page.keyboard.press(`${resolveShortcutModifier()}+A`)
  await editor.fill(value)
}

export const selectFirstComboboxOption = async (
  page: Page,
  label: string,
  options: {
    scope?: AdminSurface
  } = {},
) => {
  const surface = options.scope ?? page
  const combobox = await resolveLabeledCombobox(surface, label)
  await expect(combobox).toBeVisible()
  await combobox.click()

  const option = page.getByRole('option').first()
  await expect(option).toBeVisible()
  const optionLabel = (await option.textContent())?.trim() ?? ''
  await option.click()

  return optionLabel
}

export const selectFirstComboboxOptionIfVisible = async (
  page: Page,
  label: string,
  options: {
    scope?: AdminSurface
  } = {},
) => {
  const surface = options.scope ?? page
  const combobox = await resolveLabeledCombobox(surface, label)

  if ((await combobox.count()) === 0) {
    return undefined
  }

  try {
    await expect(combobox).toBeVisible({ timeout: 750 })
  } catch {
    return undefined
  }

  return selectFirstComboboxOption(page, label, options)
}
