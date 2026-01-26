import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetPasswordCompleteForm } from './ResetPasswordCompleteForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Complete password reset',
}

export default async function CompleteResetPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams

  return (
    <main className="bg-muted/20 min-h-screen py-12">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6">
          <Link href="/login/patient" className="text-primary text-sm hover:underline">
            ← Back to sign in
          </Link>
        </div>
        <ResetPasswordCompleteForm error={params.error} />
      </div>
    </main>
  )
}
