import Link from 'next/link'
import { ResetPasswordRequestForm, type ResetPasswordReason } from './ResetPasswordRequestForm'
import { recoveryRequestMetadata } from './recoveryRequestMetadata'
import { headers } from 'next/headers'
import { createLocalReq, getPayload } from 'payload'
import config from '@payload-config'
import { readPreparationBinding } from '@/features/inquiryPreparations/context'
import { readInquiryPreparationRegistration } from '@/features/inquiryCommunication/service'
import { recoveryRequestCopy } from '@/features/uiCopy/passwordRecovery'

export function generateMetadata() {
  return recoveryRequestMetadata('de')
}

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
  const copy = await recoveryRequestCopy(preparation?.expiresAt)
  const patientSignInHref =
    preparation && params?.inquiry
      ? `${copy.patientSignInHref}?inquiry=${encodeURIComponent(params.inquiry)}&next=/patient/inquiries`
      : copy.patientSignInHref

  return (
    <main className="min-h-svh bg-site-canvas py-6 sm:py-12">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-2 sm:mb-6">
          <nav aria-label={copy.signInOptions} className="-mx-3 flex flex-wrap gap-1">
            <Link href={patientSignInHref} className={signInOptionLinkClassName}>
              {copy.patientSignIn}
            </Link>
            <Link href="/admin/login" className={signInOptionLinkClassName}>
              {copy.staffSignIn}
            </Link>
          </nav>
        </div>
        <ResetPasswordRequestForm
          copy={copy.form}
          reason={reason}
          initialEmail={preparation?.email}
          preparationNotice={copy.preparationNotice}
        />
      </div>
    </main>
  )
}
