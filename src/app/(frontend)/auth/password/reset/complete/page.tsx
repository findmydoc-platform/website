import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetPasswordCompleteForm } from './ResetPasswordCompleteForm'
import { createSiteMetadata } from '@/utilities/generateMeta'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createSiteMetadata({
  title: 'Complete password reset',
  path: '/auth/password/reset/complete',
})

export default async function CompleteResetPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams

  return (
    <main className="min-h-screen bg-muted/20 py-12">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6">
          <Link href="/login/patient" className="text-sm text-primary hover:underline">
            ← Back to sign in
          </Link>
        </div>
        <ResetPasswordCompleteForm error={params.error} />
      </div>
    </main>
  )
}
