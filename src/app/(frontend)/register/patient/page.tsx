import { createLocalReq, getPayload } from 'payload'
import config from '@payload-config'
import { readPreparationBinding } from '@/features/inquiryPreparations/context'
import { readInquiryPreparationRegistration } from '@/features/inquiryCommunication/service'
import {
  PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME,
  PublicAuthRouteShell,
} from '@/app/(frontend)/_components/PublicAuthRouteShell'
import { PatientRegistrationForm } from '@/features/patientRegistration/PatientRegistrationForm.client'
import { patientRegistrationCopy } from '@/features/uiCopy/patientRegistration'
import { localizedPatientAuthPath } from '@/i18n/patientAuthPath'
import { uiCopyLocaleFromHeaders } from '@/i18n/requestLocale'
import { headers } from 'next/headers'
import { PatientVerificationResendForm } from './PatientVerificationResendForm'
import { patientVerificationResendCopy } from '@/features/uiCopy/patientVerification'

export default async function PatientRegistrationPage({
  searchParams = Promise.resolve({}),
}: { searchParams?: Promise<{ inquiry?: string }> } = {}) {
  const requestHeaders = await headers()

  const { inquiry } = await searchParams
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
  const loginPath = localizedPatientAuthPath('/login/patient', uiCopyLocaleFromHeaders(requestHeaders))

  return (
    <PublicAuthRouteShell>
      <div className="flex w-full max-w-md flex-col gap-6">
        <PatientRegistrationForm
          copy={copy}
          containerClassName={PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME}
          initialValues={
            preparation
              ? { firstName: preparation.firstName, lastName: preparation.lastName, email: preparation.email }
              : undefined
          }
          loginHref={
            preparation && inquiry
              ? `${loginPath}?inquiry=${encodeURIComponent(inquiry)}&next=/patient/inquiries`
              : loginPath
          }
          successHref={`${loginPath}?message=patient-check-email`}
        />
        <PatientVerificationResendForm copy={await patientVerificationResendCopy()} initialEmail={preparation?.email} />
      </div>
    </PublicAuthRouteShell>
  )
}
