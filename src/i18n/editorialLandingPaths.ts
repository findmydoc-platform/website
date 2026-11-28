export const ABOUT_PATHS = { de: '/about', en: '/en/about' } as const

export const CLINIC_PARTNER_PATHS = { de: '/partners/clinics', en: '/en/partners/clinics' } as const

export function editorialLandingLocaleFromPath(pathname: string) {
  const path = pathname.replace(/\/$/, '')
  if (path === ABOUT_PATHS.de || path === CLINIC_PARTNER_PATHS.de) return 'de'
  if (path === ABOUT_PATHS.en || path === CLINIC_PARTNER_PATHS.en) return 'en'
  return null
}
