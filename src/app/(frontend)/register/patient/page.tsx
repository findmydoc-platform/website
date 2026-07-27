import {
  PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME,
  PublicAuthRouteShell,
} from '@/app/(frontend)/_components/PublicAuthRouteShell'
import { PatientRegistrationForm } from '@/components/organisms/Auth/PatientRegistrationForm'
import { PREVIEW_GUARD_ACTIVE_REQUEST_HEADER } from '@/features/previewGuard'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function PatientRegistrationPage() {
  const requestHeaders = await headers()

  if (requestHeaders.get(PREVIEW_GUARD_ACTIVE_REQUEST_HEADER) === '1') {
    redirect('/admin/collections/patients/create')
  }

  return (
    <PublicAuthRouteShell>
      <PatientRegistrationForm containerClassName={PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME} />
    </PublicAuthRouteShell>
  )
}
