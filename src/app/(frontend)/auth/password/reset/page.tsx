import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetPasswordRequestForm } from './ResetPasswordRequestForm'

export const metadata: Metadata = {
  title: 'Reset password',
}

export default function ResetPasswordPage() {
  return (
    <main className="bg-muted/20 min-h-screen py-12">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6">
          <Link href="/login/patient" className="text-primary text-sm hover:underline">
            ← Back to sign in
          </Link>
        </div>
        <ResetPasswordRequestForm />
      </div>
    </main>
  )
}
