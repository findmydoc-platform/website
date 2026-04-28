import { expect, Page } from '@playwright/test'

export type BrowserIssueCollector = {
  consoleErrors: string[]
  pageErrors: string[]
}

export type BrowserIssueCollectorOptions = {
  ignoredConsoleErrors?: Array<string | RegExp>
}

const consoleErrorMatches = (text: string, pattern: string | RegExp) =>
  typeof pattern === 'string' ? text.includes(pattern) : new RegExp(pattern.source, pattern.flags).test(text)

export const createBrowserIssueCollector = (
  page: Page,
  options: BrowserIssueCollectorOptions = {},
): BrowserIssueCollector => {
  const issues: BrowserIssueCollector = {
    consoleErrors: [],
    pageErrors: [],
  }

  page.on('console', (message) => {
    if (message.type() !== 'error') {
      return
    }

    const text = message.text()
    if (options.ignoredConsoleErrors?.some((pattern) => consoleErrorMatches(text, pattern))) {
      return
    }

    issues.consoleErrors.push(text)
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
