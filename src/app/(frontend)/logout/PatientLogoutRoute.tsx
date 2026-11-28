import { getTranslations } from 'next-intl/server'

import { PATIENT_LOGIN_PATH, localizedPatientAuthPath } from '@/i18n/patientAuthPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'

import { PatientLogout } from './PatientLogout.client'

export async function PatientLogoutRoute({ locale }: { locale: UiCopyLocale }) {
  const t = await getTranslations({ locale, namespace: 'auth.patientLogout' })
  const loginHref = localizedPatientAuthPath(PATIENT_LOGIN_PATH, locale)

  return (
    <PatientLogout
      title={t('title')}
      description={t('description')}
      exitPreviewPath={`/next/exit-preview?redirect=${encodeURIComponent(loginHref)}`}
    />
  )
}
