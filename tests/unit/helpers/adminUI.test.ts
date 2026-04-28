import { describe, expect, it } from 'vitest'
import { createBrowserIssueCollector } from '../../e2e/helpers/adminUI'
import type { Page } from '@playwright/test'

type ConsoleListener = (message: { type: () => string; text: () => string; location: () => { url: string } }) => void
type PageErrorListener = (error: Error) => void

const createMockPage = () => {
  const consoleListeners: ConsoleListener[] = []
  const pageErrorListeners: PageErrorListener[] = []

  const page = {
    on(event: string, handler: ConsoleListener | PageErrorListener) {
      if (event === 'console') {
        consoleListeners.push(handler as ConsoleListener)
      }

      if (event === 'pageerror') {
        pageErrorListeners.push(handler as PageErrorListener)
      }
    },
  } as unknown as Page

  return {
    page,
    emitConsoleError(text: string, url = '') {
      const message = { type: () => 'error', text: () => text, location: () => ({ url }) }
      for (const listener of consoleListeners) {
        listener(message)
      }
    },
    emitPageError(message: string) {
      const error = new Error(message)
      for (const listener of pageErrorListeners) {
        listener(error)
      }
    },
  }
}

describe('createBrowserIssueCollector', () => {
  it('ignores repeated console errors when using a global regular expression filter', () => {
    const mockPage = createMockPage()
    const issues = createBrowserIssueCollector(mockPage.page, {
      ignoredConsoleErrors: [/TypeError: Failed to fetch/g],
    })

    mockPage.emitConsoleError('TypeError: Failed to fetch')
    mockPage.emitConsoleError('TypeError: Failed to fetch')
    mockPage.emitPageError('unexpected page error')

    expect(issues.consoleErrors).toEqual([])
    expect(issues.pageErrors).toEqual(['unexpected page error'])
  })

  it('can ignore a console error only when the source URL matches', () => {
    const mockPage = createMockPage()
    const issues = createBrowserIssueCollector(mockPage.page, {
      ignoredConsoleErrors: [
        /Failed to load resource: the server responded with a status of 404 .*openstreetmap\.org\//,
      ],
    })

    mockPage.emitConsoleError(
      'Failed to load resource: the server responded with a status of 404 ()',
      'https://www.openstreetmap.org/export/embed.html?bbox=1%2C2%2C3%2C4',
    )
    mockPage.emitConsoleError('Failed to load resource: the server responded with a status of 404 ()', '/api/internal')

    expect(issues.consoleErrors).toEqual(['Failed to load resource: the server responded with a status of 404 ()'])
  })
})
