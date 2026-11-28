import { clinicPartnerMetadata, renderClinicPartnerPage } from './ClinicPartnerPage'

export const revalidate = 600

export function generateMetadata() {
  return clinicPartnerMetadata('de')
}

export default function ClinicPartnerRoute() {
  return renderClinicPartnerPage('de')
}
