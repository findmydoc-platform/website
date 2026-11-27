import Link from 'next/link'

import { Alert } from '@/components/atoms/alert'
import { Heading } from '@/components/atoms/Heading'

type PreparedInquiryConfirmationProps = {
  title: string
  guidance: string
  savedStatus: string
  deadline: string
  expiresAt: string
  resendHref: string
  resendLabel: string
}

export function PreparedInquiryConfirmation({
  title,
  guidance,
  savedStatus,
  deadline,
  expiresAt,
  resendHref,
  resendLabel,
}: PreparedInquiryConfirmationProps) {
  return (
    <>
      <Heading as="h1" size="h4" align="left" className="mb-3 text-2xl leading-tight text-balance">
        {title}
      </Heading>
      <p className="mb-4 text-sm leading-6">{guidance}</p>
      <Alert variant="info" role="status" className="space-y-1">
        <p>{savedStatus}</p>
        <p className="text-xs leading-5">
          <time dateTime={expiresAt}>{deadline}</time>
        </p>
      </Alert>
      <Link
        href={resendHref}
        className="mt-2 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4"
      >
        {resendLabel}
      </Link>
    </>
  )
}
