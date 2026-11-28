import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

import { FRONTEND_PATH_HEADER } from '@/i18n/requestLocale'

const headers = vi.hoisted(() => vi.fn())
vi.mock('next/headers', () => ({ headers }))

it.each([
  ['/fehlende-seite', 'de'],
  ['/en/missing-page', 'en'],
])('marks the 404 help on %s with the requested language', async (path, locale) => {
  headers.mockResolvedValue(new Headers({ [FRONTEND_PATH_HEADER]: path }))
  const { default: NotFound } = await import('@/app/(frontend)/not-found')
  const html = renderToStaticMarkup(await NotFound())

  expect(html).toMatch(new RegExp(`lang="${locale}"`))
  expect(html).toMatch(/<h1[^>]*>404<\/h1>/)
  expect(html).toMatch(/<a[^>]+href="\/"/)
})
