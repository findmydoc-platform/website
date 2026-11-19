'use client'

import { useState } from 'react'
import { Alert } from '@/components/atoms/alert'
import { Button } from '@/components/atoms/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { UiLink } from '@/components/molecules/Link'
import type { PatientVerificationCopy } from '@/features/uiCopy/patientVerification'

export type PatientVerificationState = 'idle' | 'pending' | 'invalid' | 'retry' | 'completed' | 'inquiry-continuation'
export function PatientVerificationForm({
  copy,
  csrf,
  inquiryContinuationPending = false,
}: Readonly<{ copy: PatientVerificationCopy; csrf: string | null; inquiryContinuationPending?: boolean }>) {
  const [state, setState] = useState<PatientVerificationState>(
    csrf ? (inquiryContinuationPending ? 'inquiry-continuation' : 'idle') : 'invalid',
  )
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
        if (body.inquiryContinuationPending) setState('inquiry-continuation')
        else {
          setState('completed')
          window.location.assign('/patient/inquiries')
        }
      } else setState(response.status === 503 ? 'retry' : 'invalid')
    } catch {
      setState('retry')
    }
  }
  return <PatientVerificationView copy={copy} state={state} onConfirm={confirm} />
}

export function PatientVerificationView({
  copy,
  state,
  onConfirm,
}: Readonly<{ copy: PatientVerificationCopy; state: PatientVerificationState; onConfirm: () => void }>) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <Heading as="h1" size="h4" align="center">
          {copy.title}
        </Heading>
        <CardDescription className="text-center text-foreground">{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === 'pending' ? (
          <p className="sr-only" role="status">
            {copy.announcementPending}
          </p>
        ) : null}
        {state === 'invalid' ? (
          <Alert variant="error" role="alert">
            {copy.invalid}
          </Alert>
        ) : null}
        {state === 'retry' ? (
          <Alert variant="warning" role="alert">
            {copy.retry}
          </Alert>
        ) : null}
        {state === 'inquiry-continuation' ? (
          <Alert variant="success" role="status">
            {copy.inquiryContinuation}
          </Alert>
        ) : null}
        {state === 'completed' ? (
          <Alert variant="success" role="status">
            {copy.completed}
          </Alert>
        ) : null}
        {state !== 'invalid' && state !== 'completed' ? (
          <Button className="w-full" disabled={state === 'pending'} onClick={onConfirm}>
            {state === 'pending'
              ? copy.confirming
              : state === 'retry'
                ? copy.retryAction
                : state === 'inquiry-continuation'
                  ? copy.continueAction
                  : copy.confirm}
          </Button>
        ) : null}
        <UiLink href={copy.resendHref} className="flex min-h-11 items-center text-primary underline underline-offset-4">
          {copy.resendLink}
        </UiLink>
      </CardContent>
    </Card>
  )
}
