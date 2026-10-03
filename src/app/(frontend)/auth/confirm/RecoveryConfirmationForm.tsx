'use client'

import { useState } from 'react'
import { Alert } from '@/components/atoms/alert'
import { Button } from '@/components/atoms/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { UiLink } from '@/components/molecules/Link'

export type RecoveryState = 'idle' | 'pending' | 'invalid' | 'retry' | 'completed'
export function RecoverySafeError() {
  return (
    <Alert variant="error" role="alert">
      This link is invalid or has expired. Request a new recovery email to continue.
    </Alert>
  )
}
export function RecoveryRequestLink() {
  return (
    <UiLink
      href="/auth/password/reset"
      className="flex min-h-11 items-center text-primary underline underline-offset-4"
    >
      Request a recovery email
    </UiLink>
  )
}
export function RecoveryConfirmationForm({ csrf }: Readonly<{ csrf: string | null }>) {
  const [state, setState] = useState<RecoveryState>(csrf ? 'idle' : 'invalid')
  async function confirm() {
    setState('pending')
    try {
      const response = await fetch('/auth/callback?flow=recovery', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf }),
        redirect: 'error',
      })
      const body = await response.json().catch(() => null)
      if (response.ok && body?.redirectTo === '/auth/password/reset/complete') {
        setState('completed')
        window.location.assign('/auth/password/reset/complete')
      } else setState(response.status === 503 ? 'retry' : 'invalid')
    } catch {
      setState('retry')
    }
  }
  return <RecoveryConfirmationView state={state} onConfirm={confirm} />
}
export function RecoveryConfirmationView({
  state,
  onConfirm,
}: Readonly<{ state: RecoveryState; onConfirm: () => void }>) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <Heading as="h1" size="h4" align="center">
          Confirm password recovery
        </Heading>
        <CardDescription className="text-center text-foreground">
          Continue only if you requested this email. Then choose a new password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === 'pending' && (
          <p className="sr-only" role="status">
            Confirming your recovery link.
          </p>
        )}
        {state === 'invalid' && <RecoverySafeError />}
        {state === 'retry' && (
          <Alert variant="warning" role="alert">
            We could not finish right now. Try again here. If your link was confirmed, you do not need another link.
          </Alert>
        )}
        {state === 'completed' && (
          <Alert variant="success" role="status">
            Link confirmed. Opening password completion...
          </Alert>
        )}
        {state !== 'invalid' && state !== 'completed' && (
          <Button className="w-full" disabled={state === 'pending'} onClick={onConfirm}>
            {state === 'pending' ? 'Confirming...' : state === 'retry' ? 'Try again' : 'Confirm recovery'}
          </Button>
        )}
        <RecoveryRequestLink />
      </CardContent>
    </Card>
  )
}
