'use client'

import { useState } from 'react'
import { Alert } from '@/components/atoms/alert'
import { Button } from '@/components/atoms/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { UiLink } from '@/components/molecules/Link'

export type PatientVerificationState = 'idle' | 'pending' | 'invalid' | 'retry' | 'completed'
export function PatientVerificationForm({ csrf }: Readonly<{ csrf: string | null }>) {
  const [state, setState] = useState<PatientVerificationState>(csrf ? 'idle' : 'invalid')
  async function confirm() {
    setState('pending')
    try {
      const response = await fetch('/auth/callback', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf }),
        redirect: 'error',
      })
      const body = await response.json().catch(() => null)
      if (response.ok && body?.redirectTo === '/patient/inquiries') {
        setState('completed')
        window.location.assign('/patient/inquiries')
      } else setState(response.status === 503 ? 'retry' : 'invalid')
    } catch {
      setState('retry')
    }
  }
  return <PatientVerificationView state={state} onConfirm={confirm} />
}

export function PatientVerificationView({
  state,
  onConfirm,
}: Readonly<{ state: PatientVerificationState; onConfirm: () => void }>) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <Heading as="h1" size="h4" align="center">
          Verify your email
        </Heading>
        <CardDescription className="text-center">Confirm your email to open your patient account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === 'pending' ? (
          <p className="sr-only" role="status">
            Confirming your email.
          </p>
        ) : null}
        {state === 'invalid' ? (
          <Alert variant="error" role="alert">
            This link is invalid or has expired. Request a new verification email to continue.
          </Alert>
        ) : null}
        {state === 'retry' ? (
          <Alert variant="warning" role="alert">
            We could not finish right now. Try again here. If your email was confirmed, you do not need another link.
          </Alert>
        ) : null}
        {state === 'completed' ? (
          <Alert variant="success" role="status">
            Your email is verified. Opening your inquiries...
          </Alert>
        ) : null}
        {state !== 'invalid' && state !== 'completed' ? (
          <Button className="w-full" disabled={state === 'pending'} onClick={onConfirm}>
            {state === 'pending' ? 'Confirming...' : state === 'retry' ? 'Try again' : 'Confirm email'}
          </Button>
        ) : null}
        <UiLink href="/register/patient#patient-verification-resend" className="flex min-h-11 items-center">
          Request a verification email
        </UiLink>
      </CardContent>
    </Card>
  )
}
