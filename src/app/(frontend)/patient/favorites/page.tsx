import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { Button } from '@/components/atoms/button'
import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'
import { FavoriteClinicsList } from '@/features/favorites/FavoriteClinicsList.client'
import { buildPatientLoginHref } from '@/features/favorites/redirects'
import { findPatientFavoriteClinicListItems, resolveFavoriteClinicAuthContext } from '@/features/favorites/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Saved clinics | findmydoc',
  description: 'Review and manage clinics saved to your patient account.',
}

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
  const savedClinicLabel = items.length === 1 ? 'saved clinic' : 'saved clinics'

  return (
    <main className="bg-muted/30 py-10 sm:py-14">
      <Container className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            <Heading as="h1" align="left" size="h2" className="text-secondary">
              Saved clinics
            </Heading>
            <p className="text-sm leading-6 text-muted-foreground">
              {items.length} {savedClinicLabel} in your patient account.
            </p>
          </div>
          <Button asChild variant="secondary" className="w-full sm:w-auto">
            <Link href="/listing-comparison">Browse clinics</Link>
          </Button>
        </div>

        <FavoriteClinicsList initialItems={items} />
      </Container>
    </main>
  )
}
