import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { ClinicCard } from '@/components/ClinicCard'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import React from 'react'
import { SearchBlock } from '@/blocks/SearchBlock/Component'

/**
 * Renders the public landing page with featured clinics and quick entry points.
 */
export default async function Home({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<{ message?: string }>
}) {
  const resolvedSearchParams = await searchParamsPromise
  const message = resolvedSearchParams?.message
  const payload = await getPayload({ config: configPromise })

  const clinics = await payload.find({
    collection: 'clinics',
    where: {
      status: { equals: 'approved' },
    },
    depth: 1,
    limit: 12,
    overrideAccess: true,
    select: {
      slug: true,
      name: true,
      city: true,
      street: true,
      contact: true,
      thumbnail: true,
    },
  })

  return (
    <main className="container mx-auto px-4 py-16">
      <section className="mb-16">
        <div className="mx-auto max-w-4xl">
          <SearchBlock title="Search clinics and treatments" />
        </div>
      </section>

      {message === 'clinic-registration-submitted' && (
        <div className="mx-auto mb-6 max-w-lg rounded border border-success bg-success/30 p-4 text-center">
          Clinic application received. We will review and contact you.
        </div>
      )}
      {/* Hero Section */}
      <div className="mb-16 text-center">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {clinics.docs.map((clinic) => (
            <ClinicCard key={clinic.id} clinic={clinic} />
          ))}
        </div>
      </div>

      {/* Getting Started Section */}
      <div className="mt-16 text-center">
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Ready to Get Started?</h2>
        <p className="text-muted-foreground mb-8">
          Create an account on findmydoc and start your clinic search journey.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/register/patient">Register Patient</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/register/clinic">Register Clinic</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login/patient">Patient Login</Link>
          </Button>
          <Button asChild variant="accent" size="lg">
            <Link href="/admin/login">Staff Login</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}

export { generateMetadata } from './[slug]/page'
