import type { UiCopyLocale } from './requestLocale'

export const CONTACT_PATHS = { de: '/contact', en: '/en/contact' } as const satisfies Record<UiCopyLocale, string>

export function contactLocaleFromPath(pathname: string): UiCopyLocale | null {
  const path = pathname.replace(/\/$/, '')
  if (path === CONTACT_PATHS.de) return 'de'
  if (path === CONTACT_PATHS.en) return 'en'
  return null
}
