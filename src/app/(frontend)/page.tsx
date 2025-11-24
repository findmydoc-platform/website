import Link from 'next/link'
import { Button } from '@/components/ui/button'
import React from 'react'

/**
 * Renders the public landing page with featured clinics and quick entry points.
 */
export default async function Home() {
  return (
    <main className="page-shell py-16">
      <div className="mt-16 text-center">
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
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
