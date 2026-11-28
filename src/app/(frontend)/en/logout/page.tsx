import type { Metadata } from 'next'

import { PatientLogoutRoute } from '../../logout/PatientLogoutRoute'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function EnglishPatientLogoutPage() {
  return PatientLogoutRoute({ locale: 'en' })
}
