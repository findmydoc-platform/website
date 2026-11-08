import { createLocalReq, getPayload } from 'payload'
import config from '@payload-config'
import { readPreparationBinding } from '@/features/inquiryPreparations/context'
import { readInquiryPreparationRegistration } from '@/features/inquiryCommunication/service'
import {
  PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME,
  PublicAuthRouteShell,
} from '@/app/(frontend)/_components/PublicAuthRouteShell'
import { PatientRegistrationForm } from '@/components/organisms/Auth/PatientRegistrationForm'
import { headers } from 'next/headers'
import { PatientVerificationResendForm } from './PatientVerificationResendForm'

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

  return (
    <PublicAuthRouteShell>
      <div className="flex w-full max-w-md flex-col gap-6">
        <PatientRegistrationForm
          containerClassName={PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME}
          initialValues={
            preparation
              ? { firstName: preparation.firstName, lastName: preparation.lastName, email: preparation.email }
              : undefined
          }
          preparationExpiresAt={preparation?.expiresAt}
          loginHref={
            preparation && inquiry
              ? `/login/patient?inquiry=${encodeURIComponent(inquiry)}&next=/patient/inquiries`
              : undefined
          }
        />
        <PatientVerificationResendForm initialEmail={preparation?.email} />
      </div>
    </PublicAuthRouteShell>
  )
}
