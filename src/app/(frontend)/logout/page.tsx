import type { Metadata } from 'next'

import { PatientLogoutRoute } from './PatientLogoutRoute'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function GermanPatientLogoutPage() {
  return PatientLogoutRoute({ locale: 'de' })
}
