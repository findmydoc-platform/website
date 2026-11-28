import { clinicPartnerMetadata, renderClinicPartnerPage } from '../../../partners/clinics/ClinicPartnerPage'

export const revalidate = 600

export function generateMetadata() {
  return clinicPartnerMetadata('en')
}

export default function ClinicPartnerRoute() {
  return renderClinicPartnerPage('en')
}
