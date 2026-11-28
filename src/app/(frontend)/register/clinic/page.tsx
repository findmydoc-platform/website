import { ClinicApplicationPage, clinicApplicationMetadata } from './ClinicApplicationPage'

export function generateMetadata() {
  return clinicApplicationMetadata('de')
}

export default function ClinicRegistrationPage() {
  return <ClinicApplicationPage locale="de" />
}
