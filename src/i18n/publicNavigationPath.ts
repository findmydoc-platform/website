import { ABOUT_PATHS, CLINIC_PARTNER_PATHS } from './editorialLandingPaths'
import { BLOG_ARCHIVE_PATHS } from './blogArchivePath'
import { CLINIC_APPLICATION_PATHS } from './clinicApplicationPath'
import { CONTACT_PATHS } from './contactPath'
import { LISTING_COMPARISON_PATHS } from './listingComparisonPath'
import { localizedPatientAuthPath, PATIENT_LOGIN_PATH, PATIENT_LOGOUT_PATH } from './patientAuthPath'
import { SAVED_CLINICS_PATHS } from './savedClinicsPath'
import { uiCopyLocaleFromPath, type UiCopyLocale } from './requestLocale'

/** Fixed navigation targets. CMS Pages and Posts resolve from their published locale instead. */
export const publicNavigationPaths: Record<string, { en?: string }> = {
  [ABOUT_PATHS.de]: { en: ABOUT_PATHS.en },
  [CONTACT_PATHS.de]: { en: CONTACT_PATHS.en },
  '/listing-comparison': { en: LISTING_COMPARISON_PATHS.en },
  [CLINIC_PARTNER_PATHS.de]: { en: CLINIC_PARTNER_PATHS.en },
  [CLINIC_APPLICATION_PATHS.de]: { en: CLINIC_APPLICATION_PATHS.en },
  '/admin/login': {},
  [BLOG_ARCHIVE_PATHS.de]: { en: BLOG_ARCHIVE_PATHS.en },
  [PATIENT_LOGIN_PATH]: { en: localizedPatientAuthPath(PATIENT_LOGIN_PATH, 'en') },
  [PATIENT_LOGOUT_PATH]: { en: localizedPatientAuthPath(PATIENT_LOGOUT_PATH, 'en') },
  '/register/patient': { en: localizedPatientAuthPath('/register/patient', 'en') },
  [SAVED_CLINICS_PATHS.de]: { en: SAVED_CLINICS_PATHS.en },
  '/patient/inquiries': {},
}

export function publicPageLocaleFromPath(pathname: string): UiCopyLocale {
  const localized = uiCopyLocaleFromPath(pathname)
  if (localized) return localized
  if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/auth/')) return 'en'
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'de'
}
