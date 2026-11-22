import { createLocalReq, getPayload } from 'payload'
import config from '@payload-config'
import { readPreparationBinding } from '@/features/inquiryPreparations/context'
import { readInquiryPreparationRegistration } from '@/features/inquiryCommunication/service'
import {
  PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME,
  PublicAuthRouteShell,
} from '@/app/(frontend)/_components/PublicAuthRouteShell'
import { patientRegistrationCopy } from '@/features/uiCopy/patientRegistration'
import { localizedPatientAuthPath } from '@/i18n/patientAuthPath'
import { uiCopyLocaleFromHeaders } from '@/i18n/requestLocale'
import { headers } from 'next/headers'
import { PatientRegistrationForms } from './PatientRegistrationForms.client'
import { patientVerificationResendCopy } from '@/features/uiCopy/patientVerification'

export default async function PatientRegistrationPage({
  searchParams = Promise.resolve({}),
}: { searchParams?: Promise<{ inquiry?: string | string[] }> } = {}) {
  const requestHeaders = await headers()

  const params = await searchParams
  const inquiry = typeof params.inquiry === 'string' ? params.inquiry : undefined
  const binding = readPreparationBinding(requestHeaders)
  const preparation =
    binding && inquiry
      ? await readInquiryPreparationRegistration(
          await createLocalReq({}, await getPayload({ config })),
          binding,
          inquiry,
        )
      : null

  const copy = await patientRegistrationCopy(preparation?.expiresAt)
  const locale = uiCopyLocaleFromHeaders(requestHeaders)
  const loginPath = localizedPatientAuthPath('/login/patient', locale)
  const inquiryQuery = preparation && inquiry ? `?inquiry=${encodeURIComponent(inquiry)}` : ''

  return (
    <PublicAuthRouteShell>
      <PatientRegistrationForms
        locale={locale}
        targets={{
          de: localizedPatientAuthPath('/register/patient', 'de') + inquiryQuery,
          en: localizedPatientAuthPath('/register/patient', 'en') + inquiryQuery,
        }}
        registration={{
          copy,
          containerClassName: PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME,
          initialValues: preparation
            ? { firstName: preparation.firstName, lastName: preparation.lastName, email: preparation.email }
            : undefined,
          loginHref: inquiryQuery ? `${loginPath}${inquiryQuery}&next=/patient/inquiries` : loginPath,
          successHref: `${loginPath}?message=patient-check-email`,
        }}
        resend={{ copy: await patientVerificationResendCopy(), initialEmail: preparation?.email }}
      />
    </PublicAuthRouteShell>
  )
}
