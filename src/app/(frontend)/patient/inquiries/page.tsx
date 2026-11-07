import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import configPromise from '@payload-config'
import { createLocalReq, getPayload } from 'payload'
import { readPreparationBinding } from '@/features/inquiryPreparations/context'
import { readInquiryPreparations } from '@/features/inquiryCommunication/service'
import type { PreparationReceipt } from '@/features/inquiryPreparations/contracts'

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

  const initialItems: PreparationReceipt[] = []
  let initialError: string | undefined
  const binding = readPreparationBinding(requestHeaders)
  if (binding) {
    try {
      const req = await createLocalReq({ user: { ...authContext.patient, collection: 'patients' } }, payload)
      req.headers = new Headers(requestHeaders)
      let cursor: number | null = null
      do {
        const page = await readInquiryPreparations(req, binding, cursor ?? undefined)
        initialItems.push(...page.preparations.filter((item) => item.status !== 'submitted'))
        cursor = page.nextCursor
      } while (cursor)
    } catch {
      initialError = 'Prepared inquiries could not be loaded. Refresh to try again.'
    }
  }

  return (
    <PatientInquiriesController
      loginHref={buildPatientLoginHref('/patient/inquiries')}
      mode="index"
      initialPreparations={initialItems}
      preparationError={initialError}
    />
  )
}
