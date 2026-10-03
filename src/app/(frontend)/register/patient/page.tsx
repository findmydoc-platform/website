import {
  PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME,
  PublicAuthRouteShell,
} from '@/app/(frontend)/_components/PublicAuthRouteShell'
import { PatientRegistrationForm } from '@/components/organisms/Auth/PatientRegistrationForm'
import { PREVIEW_GUARD_ACTIVE_REQUEST_HEADER } from '@/features/previewGuard'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { PatientVerificationResendForm } from './PatientVerificationResendForm'

export default async function PatientRegistrationPage() {
  const requestHeaders = await headers()

  if (requestHeaders.get(PREVIEW_GUARD_ACTIVE_REQUEST_HEADER) === '1') {
    redirect('/admin/collections/patients/create')
  }

  return (
    <PublicAuthRouteShell>
      <div className="flex w-full max-w-md flex-col gap-6">
        <PatientRegistrationForm containerClassName={PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME} />
        <PatientVerificationResendForm />
      </div>
    </PublicAuthRouteShell>
  )
}
