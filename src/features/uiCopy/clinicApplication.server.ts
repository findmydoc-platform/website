import { getTranslations } from 'next-intl/server'

import type { UiCopyLocale } from '@/i18n/requestLocale'
import { buildClinicApplicationCopy } from './clinicApplication'

export async function clinicApplicationCopy(locale: UiCopyLocale) {
  return buildClinicApplicationCopy(await getTranslations({ locale, namespace: 'website.clinicApplication' }))
}
