import { ClinicApplicationPage, clinicApplicationMetadata } from '../../../register/clinic/ClinicApplicationPage'

export function generateMetadata() {
  return clinicApplicationMetadata('en')
}

export default function ClinicRegistrationPage() {
  return <ClinicApplicationPage locale="en" />
}
