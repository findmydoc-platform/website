import {
  PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME,
  PublicAuthRouteShell,
} from '@/app/(frontend)/_components/PublicAuthRouteShell'
import { PatientRegistrationForm } from '@/components/organisms/Auth/PatientRegistrationForm'

export default async function PatientRegistrationPage() {
  return (
    <PublicAuthRouteShell>
      <PatientRegistrationForm containerClassName={PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME} />
    </PublicAuthRouteShell>
  )
}
