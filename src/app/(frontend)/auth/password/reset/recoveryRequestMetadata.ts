import type { Metadata } from 'next'

import { recoveryMetadataTitle } from '@/features/uiCopy/passwordRecovery'
import { localizedPatientAuthPath } from '@/i18n/patientAuthPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { createSiteMetadata } from '@/utilities/generateMeta'

export async function recoveryRequestMetadata(locale: UiCopyLocale): Promise<Metadata> {
  return {
    ...createSiteMetadata({
      title: await recoveryMetadataTitle('request', locale),
      path: localizedPatientAuthPath('/auth/password/reset', locale),
    }),
    robots: { index: false, follow: false },
  }
}
