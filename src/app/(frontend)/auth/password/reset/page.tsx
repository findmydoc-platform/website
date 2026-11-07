import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetPasswordRequestForm, type ResetPasswordReason } from './ResetPasswordRequestForm'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { headers } from 'next/headers'
import { createLocalReq, getPayload } from 'payload'
import config from '@payload-config'
import { readPreparationBinding } from '@/features/inquiryPreparations/context'
import { readInquiryPreparationRegistration } from '@/features/inquiryCommunication/service'

export const metadata: Metadata = createSiteMetadata({
  title: 'Reset password',
  path: '/auth/password/reset',
})

const signInOptionLinkClassName =
  'inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    reason?: string | string[]
    inquiry?: string
  }>
}

function resolvePasswordResetReason(reason: string | string[] | undefined): ResetPasswordReason | null {
  const value = Array.isArray(reason) ? reason[0] : reason

  return value === 'expired' ? 'expired' : null
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps = {}) {
  const params = await searchParams
  const reason = resolvePasswordResetReason(params?.reason)
  const binding = readPreparationBinding(await headers())
  const preparation = binding
    ? await readInquiryPreparationRegistration(
        await createLocalReq({}, await getPayload({ config })),
        binding,
        params?.inquiry,
      )
    : null

  return (
    <main className="min-h-svh bg-site-canvas py-6 sm:py-12">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-2 sm:mb-6">
          <nav aria-label="Sign in options" className="-mx-3 flex flex-wrap gap-1">
            <Link
              href={
                preparation && params?.inquiry
                  ? `/login/patient?inquiry=${encodeURIComponent(params.inquiry)}&next=/patient/inquiries`
                  : '/login/patient'
              }
              className={signInOptionLinkClassName}
            >
              Patient sign in
            </Link>
            <Link href="/admin/login" className={signInOptionLinkClassName}>
              Staff sign in
            </Link>
          </nav>
        </div>
        <ResetPasswordRequestForm
          reason={reason}
          initialEmail={preparation?.email}
          preparationExpiresAt={preparation?.expiresAt}
        />
      </div>
    </main>
  )
}
