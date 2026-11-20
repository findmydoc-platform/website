import { headers } from 'next/headers'
import { expect, it, vi } from 'vitest'

import getRequestConfig from '@/i18n/request'

vi.mock('next/headers', () => ({ headers: vi.fn() }))
vi.mock('next-intl/server', () => ({ getRequestConfig: (configure: typeof getRequestConfig) => configure }))
vi.mock('@findmydoc-platform/ui-copy/de.json', () => ({
  default: {
    auth: { patientLogin: { title: 'German fixture title', description: 'Deutscher Testtext als Fallback' } },
  },
}))
vi.mock('@findmydoc-platform/ui-copy/en.json', () => ({
  default: {
    auth: { patientLogin: { title: 'English fixture title', description: 'Deutscher Testtext als Fallback' } },
  },
}))

it.each([
  { locale: 'de', title: 'German fixture title' },
  { locale: 'en', title: 'English fixture title' },
])('selects the $locale catalog for patient sign-in', async ({ locale, title }) => {
  vi.mocked(headers).mockResolvedValue(new Headers({ 'x-findmydoc-ui-copy-locale': locale }))
  const config = await getRequestConfig({ requestLocale: Promise.resolve(undefined) })
  expect(config).toMatchObject({
    locale,
    messages: {
      auth: { patientLogin: { title, description: 'Deutscher Testtext als Fallback' } },
    },
  })
})
