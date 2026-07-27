import {
  PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME,
  PublicAuthRouteShell,
} from '@/app/(frontend)/_components/PublicAuthRouteShell'
import { PatientRegistrationForm } from '@/components/organisms/Auth/PatientRegistrationForm'
import { isPreviewRuntime } from '@/features/runtimePolicy'
import { redirect } from 'next/navigation'

export default async function PatientRegistrationPage() {
  if (isPreviewRuntime()) {
    redirect('/admin/collections/patients/create')
  }

  return (
    <PublicAuthRouteShell>
      <PatientRegistrationForm containerClassName={PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME} />
    </PublicAuthRouteShell>
  )
}
