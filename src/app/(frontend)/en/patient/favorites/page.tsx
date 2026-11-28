import { patientFavoritesMetadata, renderPatientFavoritesPage } from '../../../patient/favorites/PatientFavoritesPage'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  return patientFavoritesMetadata('en')
}

export default function PatientFavoritesPage() {
  return renderPatientFavoritesPage('en')
}
