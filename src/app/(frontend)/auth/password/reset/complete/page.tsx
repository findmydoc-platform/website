import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetPasswordCompleteForm } from './ResetPasswordCompleteForm'

export const metadata: Metadata = {
  title: 'Complete password reset',
}

export default async function CompleteResetPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams

  return (
    <main className="min-h-screen bg-muted/20 py-12">
      <div className="max-w-4xl mx-auto px-4">
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
