'use client'

import { useState } from 'react'
import { Alert } from '@/components/atoms/alert'
import { Button } from '@/components/atoms/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { UiLink } from '@/components/molecules/Link'
import type { RecoveryConfirmationCopy } from '@/features/uiCopy/passwordRecovery'
import { RECOVERY_COMPLETION_PATH, localizedPatientAuthPath } from '@/i18n/patientAuthPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'

export type RecoveryState = 'idle' | 'pending' | 'invalid' | 'retry' | 'completed'
export function RecoverySafeError({ message }: Readonly<{ message: string }>) {
  return (
    <Alert variant="error" role="alert">
      {message}
    </Alert>
  )
}
export function RecoveryRequestLink({
  href,
  label,
  prominent = false,
}: Readonly<{ href: string; label: string; prominent?: boolean }>) {
  return (
    <UiLink
      href={href}
      appearance={prominent ? 'default' : 'inline'}
      prefetch={false}
      className={
        prominent
          ? 'h-auto min-h-11 w-full text-center whitespace-normal no-underline hover:bg-primary-hover'
          : 'mx-auto flex min-h-11 w-fit max-w-full items-center justify-center rounded-sm px-2 text-center text-sm font-normal text-foreground underline underline-offset-4 hover:text-foreground hover:decoration-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden'
      }
    >
      {label}
    </UiLink>
  )
}
export function RecoveryConfirmationForm({
  copy,
  csrf,
  locale,
}: Readonly<{ copy: RecoveryConfirmationCopy; csrf: string | null; locale: UiCopyLocale }>) {
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
      if (response.ok && body?.redirectTo === RECOVERY_COMPLETION_PATH) {
        setState('completed')
        window.location.assign(localizedPatientAuthPath(RECOVERY_COMPLETION_PATH, locale))
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
        <Heading as="h1" size="h4" align="center" className="lg:text-2xl">
          {state === 'invalid' ? copy.shared.invalidTitle : copy.title}
        </Heading>
        {state !== 'invalid' && (
          <CardDescription className="text-center text-foreground">{copy.description}</CardDescription>
        )}
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
            className="h-auto min-h-11 w-full whitespace-normal"
            disabled={state === 'pending'}
            onClick={onConfirm}
          >
            {state === 'pending' ? copy.confirming : state === 'retry' ? copy.shared.retry : copy.submit}
          </Button>
        )}
        <RecoveryRequestLink {...copy.shared.requestLink} prominent={state === 'invalid'} />
      </CardContent>
    </Card>
  )
}
