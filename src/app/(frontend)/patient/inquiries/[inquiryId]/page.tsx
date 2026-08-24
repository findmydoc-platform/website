import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { buildPatientLoginHref } from '@/features/favorites/redirects'
import { resolveFavoriteClinicAuthContext } from '@/features/favorites/server'
import { PatientInquiriesController } from '@/features/patientInquiries/PatientInquiriesController.client'
import { createSiteMetadata } from '@/utilities/generateMeta'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createSiteMetadata({
  title: 'Clinic inquiry',
  description: 'Read and reply to a private clinic inquiry.',
  path: '/patient/inquiries',
})

export default async function PatientInquiryDetailPage({ params }: { params: Promise<{ inquiryId: string }> }) {
  const { inquiryId } = await params
  if (!inquiryId || inquiryId.length > 100) notFound()

  const path = `/patient/inquiries/${encodeURIComponent(inquiryId)}`
  const requestHeaders = await headers()
  const payload = await getPayload({ config: configPromise })
  const authContext = await resolveFavoriteClinicAuthContext({ payload, headers: requestHeaders })

  if (!authContext.patient) redirect(buildPatientLoginHref(path))

  return (
    <PatientInquiriesController initialInquiryId={inquiryId} loginHref={buildPatientLoginHref(path)} mode="detail" />
  )
}
