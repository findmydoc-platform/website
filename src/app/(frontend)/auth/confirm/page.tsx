import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ConfirmTokenHashForm } from './ConfirmTokenHashForm'
import { createSiteMetadata } from '@/utilities/generateMeta'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createSiteMetadata({
  title: 'Confirm secure email link',
  path: '/auth/confirm',
})

export default async function ConfirmTokenHashPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Readonly<{ type?: string }>> }>) {
  const { type } = await searchParams
  if (type !== 'invite' && type !== 'recovery') redirect('/auth/password/reset?reason=expired')
  return <ConfirmTokenHashForm type={type} />
}
