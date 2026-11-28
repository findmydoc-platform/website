import { patientFavoritesMetadata, renderPatientFavoritesPage } from './PatientFavoritesPage'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  return patientFavoritesMetadata('de')
}

export default function PatientFavoritesPage() {
  return renderPatientFavoritesPage('de')
}
