import { getTranslations } from 'next-intl/server'

import { createClient } from '@/auth/utilities/supaBaseServer'
import { PATIENT_LOGIN_PATH, localizedPatientAuthPath } from '@/i18n/patientAuthPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'

import { PatientLogout } from './PatientLogout.client'

async function signOutAction(): Promise<boolean> {
  'use server'

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()
    if (!error) return true
  } catch {
    // The client can retry whether the auth request failed or the session client could not start.
  }

  return false
}

export async function PatientLogoutRoute({ locale }: { locale: UiCopyLocale }) {
  const t = await getTranslations({ locale, namespace: 'auth.patientLogout' })
  const loginHref = localizedPatientAuthPath(PATIENT_LOGIN_PATH, locale)

  return (
    <PatientLogout
      title={t('title')}
      description={t('description')}
      exitPreviewPath={`/next/exit-preview?redirect=${encodeURIComponent(loginHref)}`}
      errorMessage={t('error')}
      retryLabel={t('retry')}
      signOutAction={signOutAction}
    />
  )
}
