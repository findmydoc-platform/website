import { LISTING_COMPARISON_PATHS } from './listingComparisonPath'
import { localizedPatientAuthPath } from './patientAuthPath'
import { uiCopyLocaleFromPath, type UiCopyLocale } from './requestLocale'

/** Fixed navigation targets. CMS Pages and Posts resolve from their published locale instead. */
export const publicNavigationPaths: Record<string, { en?: string }> = {
  '/about': {},
  '/contact': {},
  '/listing-comparison': { en: LISTING_COMPARISON_PATHS.en },
  '/partners/clinics': {},
  '/register/clinic': {},
  '/admin/login': {},
  '/posts': {},
  '/login/patient': { en: localizedPatientAuthPath('/login/patient', 'en') },
  '/register/patient': { en: localizedPatientAuthPath('/register/patient', 'en') },
  '/patient/favorites': {},
  '/patient/inquiries': {},
}

export function publicPageLocaleFromPath(pathname: string): UiCopyLocale {
  return uiCopyLocaleFromPath(pathname) ?? (pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'de')
}
