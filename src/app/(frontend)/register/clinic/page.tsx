import {
  PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME,
  PublicAuthRouteShell,
} from '@/app/(frontend)/_components/PublicAuthRouteShell'
import { ClinicRegistrationForm } from '@/components/organisms/Auth/ClinicRegistrationForm'

export default function ClinicRegistrationPage() {
  return (
    <PublicAuthRouteShell>
      <ClinicRegistrationForm containerClassName={PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME} />
    </PublicAuthRouteShell>
  )
}
