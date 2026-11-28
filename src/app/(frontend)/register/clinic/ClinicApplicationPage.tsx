import type { Metadata } from 'next'
import config from '@payload-config'
import { getPayload } from 'payload'

import { Heading } from '@/components/atoms/Heading'
import { LanguageSwitchRoute } from '@/features/languageSwitch/LanguageSwitchRouteProvider.client'
import { clinicApplicationCopy } from '@/features/uiCopy/clinicApplication.server'
import { CLINIC_APPLICATION_PATHS } from '@/i18n/clinicApplicationPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { getClinicRegistrationTreatmentCategories } from '@/utilities/clinicRegistration/treatmentCategories'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { ClinicApplicationForm } from '../../_components/ClinicApplicationForm.client'

export async function clinicApplicationMetadata(locale: UiCopyLocale): Promise<Metadata> {
  const { title, description } = await clinicApplicationCopy(locale)
  return {
    ...createSiteMetadata({ title, description, path: CLINIC_APPLICATION_PATHS[locale] }),
    robots: { index: false, follow: false },
  }
}

export async function ClinicApplicationPage({ locale }: { locale: UiCopyLocale }) {
  const [payload, copy] = await Promise.all([getPayload({ config }), clinicApplicationCopy(locale)])
  const treatmentCategories = await getClinicRegistrationTreatmentCategories(payload, locale)

  return (
    <section className="bg-site-canvas px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] sm:px-6 sm:pt-6 sm:pb-[calc(env(safe-area-inset-bottom)+5rem)] md:px-8 md:pt-8 md:pb-16">
      <LanguageSwitchRoute locale={locale} targets={CLINIC_APPLICATION_PATHS} />
      <div className="mx-auto w-full max-w-[1184px]">
        <Heading align="left" as="h1" className="sr-only">
          {copy.title}
        </Heading>
        <ClinicApplicationForm copy={copy} locale={locale} treatmentCategories={treatmentCategories} />
      </div>
    </section>
  )
}
