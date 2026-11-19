'use client'

import { useState } from 'react'
import { Alert } from '@/components/atoms/alert'
import { Button } from '@/components/atoms/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { UiLink } from '@/components/molecules/Link'
import type { RecoveryConfirmationCopy } from '@/features/uiCopy/passwordRecovery'

export type RecoveryState = 'idle' | 'pending' | 'invalid' | 'retry' | 'completed'
export function RecoverySafeError({ message }: Readonly<{ message: string }>) {
  return (
    <Alert variant="error" role="alert">
      {message}
    </Alert>
  )
}
export function RecoveryRequestLink({ href, label }: Readonly<{ href: string; label: string }>) {
  return (
    <UiLink href={href} className="flex min-h-11 items-center text-primary underline underline-offset-4">
      {label}
    </UiLink>
  )
}
export function RecoveryConfirmationForm({
  copy,
  csrf,
}: Readonly<{ copy: RecoveryConfirmationCopy; csrf: string | null }>) {
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
  return <RecoveryConfirmationView copy={copy} state={state} onConfirm={confirm} />
}
export function RecoveryConfirmationView({
  copy,
  state,
  onConfirm,
}: Readonly<{ copy: RecoveryConfirmationCopy; state: RecoveryState; onConfirm: () => void }>) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <Heading as="h1" size="h4" align="center">
          {copy.title}
        </Heading>
        <CardDescription className="text-center text-foreground">{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === 'pending' && (
          <p className="sr-only" role="status">
            {copy.pending}
          </p>
        )}
        {state === 'invalid' && <RecoverySafeError message={copy.shared.invalidLink} />}
        {state === 'retry' && (
          <Alert variant="warning" role="alert">
            {copy.unavailable}
          </Alert>
        )}
        {state === 'completed' && (
          <Alert variant="success" role="status">
            {copy.completed}
          </Alert>
        )}
        {state !== 'invalid' && state !== 'completed' && (
          <Button
            className="h-auto min-h-10 w-full whitespace-normal"
            disabled={state === 'pending'}
            onClick={onConfirm}
          >
            {state === 'pending' ? copy.confirming : state === 'retry' ? copy.shared.retry : copy.submit}
          </Button>
        )}
        <RecoveryRequestLink {...copy.shared.requestLink} />
      </CardContent>
    </Card>
  )
}
