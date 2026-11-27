// @vitest-environment jsdom
import React from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import {
  CmsDocumentLanguage,
  DocumentLanguage,
  HoldingDocumentLanguage,
} from '@/features/uiCopy/DocumentLanguage.client'

const route = vi.hoisted(() => ({ pathname: '/pflege/deutschland' }))

vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
}))

afterEach(() => {
  cleanup()
  document.documentElement.lang = ''
})

it('preserves the server-selected CMS language after hydration', () => {
  document.documentElement.lang = 'de'
  render(<DocumentLanguage initialLocale="de" />)

  expect(document.documentElement.lang).toBe('de')
})

it('matches the rendered CMS language in client navigation and restores the ordinary route default', () => {
  route.pathname = '/about'
  const { rerender } = render(<DocumentLanguage />)
  expect(document.documentElement.lang).toBe('en')

  route.pathname = '/pflege/deutschland'
  rerender(
    <DocumentLanguage>
      <CmsDocumentLanguage locale="de" />
    </DocumentLanguage>,
  )
  expect(document.documentElement.lang).toBe('de')

  route.pathname = '/posts/old-english-link'
  rerender(
    <DocumentLanguage>
      <CmsDocumentLanguage locale="en" />
    </DocumentLanguage>,
  )
  expect(document.documentElement.lang).toBe('en')

  route.pathname = '/login/patient'
  rerender(<DocumentLanguage />)
  expect(document.documentElement.lang).toBe('de')

  route.pathname = '/about'
  rerender(<DocumentLanguage />)
  expect(document.documentElement.lang).toBe('en')
})

it('updates the Holding document language during navigation and clears it when leaving Holding', () => {
  route.pathname = '/'
  const { rerender } = render(
    <DocumentLanguage initialLocale="de">
      <HoldingDocumentLanguage locale="de" />
    </DocumentLanguage>,
  )
  expect(document.documentElement.lang).toBe('de')

  route.pathname = '/tr'
  rerender(
    <DocumentLanguage>
      <HoldingDocumentLanguage locale="tr" />
    </DocumentLanguage>,
  )
  expect(document.documentElement.lang).toBe('tr')

  route.pathname = '/en'
  rerender(
    <DocumentLanguage>
      <HoldingDocumentLanguage locale="en" />
    </DocumentLanguage>,
  )
  expect(document.documentElement.lang).toBe('en')

  route.pathname = '/'
  rerender(
    <DocumentLanguage>
      <HoldingDocumentLanguage locale="de" />
    </DocumentLanguage>,
  )
  expect(document.documentElement.lang).toBe('de')

  route.pathname = '/posts'
  rerender(<DocumentLanguage />)
  expect(document.documentElement.lang).toBe('en')
})
