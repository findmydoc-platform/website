import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { Container } from '@/components/molecules/Container'
import { FavoriteClinicsList } from '@/features/favorites/FavoriteClinicsList.client'
import { buildPatientLoginHref } from '@/features/favorites/redirects'
import { findPatientFavoriteClinicListItems, resolveFavoriteClinicAuthContext } from '@/features/favorites/server'
import { createSiteMetadata } from '@/utilities/generateMeta'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createSiteMetadata({
  title: 'Saved clinics',
  description: 'Review and manage clinics saved to your patient account.',
  path: '/patient/favorites',
})

export default async function PatientFavoritesPage() {
  const requestHeaders = await headers()
  const payload = await getPayload({ config: configPromise })
  const authContext = await resolveFavoriteClinicAuthContext({
    payload,
    headers: requestHeaders,
  })

  if (!authContext.patient) {
    redirect(buildPatientLoginHref('/patient/favorites'))
  }

  const items = await findPatientFavoriteClinicListItems({
    payload,
    patientId: authContext.patient.id,
  })

  return (
    <main className="bg-muted/30 py-8 sm:py-12 lg:py-14">
      <Container>
        <FavoriteClinicsList initialItems={items} />
      </Container>
    </main>
  )
}
