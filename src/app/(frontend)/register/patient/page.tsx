import {
  PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME,
  PublicAuthRouteShell,
} from '@/app/(frontend)/_components/PublicAuthRouteShell'
import { PatientRegistrationForm } from '@/components/organisms/Auth/PatientRegistrationForm'
import { PatientVerificationResendForm } from './PatientVerificationResendForm'

export default async function PatientRegistrationPage() {
  return (
    <PublicAuthRouteShell>
      <div className="flex w-full max-w-md flex-col gap-6">
        <PatientRegistrationForm containerClassName={PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME} />
        <PatientVerificationResendForm />
      </div>
    </PublicAuthRouteShell>
  )
}
