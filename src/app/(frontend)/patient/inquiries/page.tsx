import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { buildPatientLoginHref } from '@/features/favorites/redirects'
import { resolveFavoriteClinicAuthContext } from '@/features/favorites/server'
import { PatientInquiriesController } from '@/features/patientInquiries/PatientInquiriesController.client'
import { createSiteMetadata } from '@/utilities/generateMeta'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createSiteMetadata({
  title: 'My inquiries',
  description: 'Read and reply to private clinic inquiries from your patient account.',
  path: '/patient/inquiries',
})

export default async function PatientInquiriesIndexPage() {
  const requestHeaders = await headers()
  const payload = await getPayload({ config: configPromise })
  const authContext = await resolveFavoriteClinicAuthContext({ payload, headers: requestHeaders })

  if (!authContext.patient) redirect(buildPatientLoginHref('/patient/inquiries'))

  return <PatientInquiriesController loginHref={buildPatientLoginHref('/patient/inquiries')} mode="index" />
}
