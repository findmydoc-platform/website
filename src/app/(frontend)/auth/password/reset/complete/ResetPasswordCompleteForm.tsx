'use client'

import { useState, type FormEvent } from 'react'
import { Alert } from '@/components/atoms/alert'
import { Button } from '@/components/atoms/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { Field, FieldError } from '@/components/atoms/field'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { usePublicFormValidation } from '@/components/molecules/PublicFormValidation'
import { createPasswordResetCompleteFlash, writeAuthFlash } from '@/auth/utilities/authFlash'
import { resetPostHogBrowserIdentity } from '@/posthog/client-api'
import { RecoveryRequestLink, RecoverySafeError, type RecoveryState } from '../../../confirm/RecoveryConfirmationForm'

type PasswordInput = { password?: string; confirmPassword?: string }
export type RecoveryPasswordResult = 'completed' | 'retry' | 'invalid' | 'password-rejected'
export function ResetPasswordCompleteForm({
  csrf,
  resume = false,
}: Readonly<{ csrf: string | null; resume?: boolean }>) {
  async function complete(input: PasswordInput): Promise<RecoveryPasswordResult> {
    try {
      const response = await fetch('/auth/password/complete', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf, ...input }),
        redirect: 'error',
      })
      const body = await response.json().catch(() => null)
      if (
        response.ok &&
        (body?.redirectTo === '/login/patient?status=recovery-complete' ||
          body?.redirectTo === '/admin/login?status=recovery-complete')
      ) {
        resetPostHogBrowserIdentity()
        writeAuthFlash(createPasswordResetCompleteFlash())
        // A full navigation discards this document's in-memory Supabase session after server cookie cleanup.
        window.location.assign(body.redirectTo)
        return 'completed'
      }
      return response.status === 503 ? 'retry' : response.status === 422 ? 'password-rejected' : 'invalid'
    } catch {
      return 'retry'
    }
  }
  return <RecoveryPasswordView available={Boolean(csrf)} resume={resume} onComplete={complete} />
}
export function RecoveryPasswordView({
  available,
  resume = false,
  onComplete,
  initialState = 'idle',
}: Readonly<{
  available: boolean
  resume?: boolean
  onComplete: (input: PasswordInput) => Promise<RecoveryPasswordResult>
  initialState?: RecoveryState
}>) {
  const [state, setState] = useState<RecoveryState>(available ? initialState : 'invalid')
  const [passwordRejected, setPasswordRejected] = useState(false)
  const validation = usePublicFormValidation({
    messages: {
      password: { valueMissing: 'Enter a new password.', tooShort: 'Password must be at least 8 characters.' },
      confirmPassword: { valueMissing: 'Confirm your new password.' },
    },
  })
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordRejected(false)
    const form = event.currentTarget
    if (!validation.validateForm(form)) return
    const fields = new FormData(form)
    const password = String(fields.get('password') ?? '')
    const confirmPassword = String(fields.get('confirmPassword') ?? '')
    if (!resume && (password.length < 8 || password !== confirmPassword)) {
      const field = password.length < 8 ? 'password' : 'confirmPassword'
      validation.setCustomFieldError(
        field,
        field === 'password' ? 'Password must be at least 8 characters.' : 'Passwords do not match.',
      )
      const input = form.elements.namedItem(field)
      if (input instanceof HTMLElement) input.focus()
      return
    }
    setState('pending')
    const result = await onComplete(resume ? {} : { password, confirmPassword })
    if (result === 'password-rejected') {
      setPasswordRejected(true)
      setState('idle')
      form.querySelector<HTMLInputElement>('#password')?.focus()
    } else {
      setState(result)
      if (result === 'invalid' || result === 'completed') form.reset()
    }
  }
  const busy = state === 'pending' || state === 'completed'
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <Heading as="h1" size="h4" align="center">
          {resume ? 'Finish password recovery' : 'Choose a new password'}
        </Heading>
        <CardDescription className="text-center text-foreground">
          {resume
            ? 'Your password has been saved. Finish signing out your sessions.'
            : 'Set a new password to finish recovering your account.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === 'invalid' ? (
          <RecoverySafeError />
        ) : (
          <form
            noValidate
            onSubmit={submit}
            onInvalid={validation.handleInvalid}
            className="space-y-4"
            aria-busy={busy}
          >
            {state === 'pending' && (
              <p role="status" className="sr-only">
                Finishing password recovery.
              </p>
            )}
            {state === 'retry' && (
              <Alert variant="warning" role="alert">
                We could not finish right now. Try again here. If your password was saved, you do not need another link
                or password change.
              </Alert>
            )}
            {passwordRejected && (
              <Alert variant="error" role="alert">
                We could not save that password. Choose another password and try again.
              </Alert>
            )}
            {state === 'completed' && (
              <Alert variant="success" role="status">
                Password recovery complete. Opening sign in...
              </Alert>
            )}
            {!resume && (
              <>
                <Field data-invalid={validation.getFieldError('password') ? true : undefined}>
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={4096}
                    disabled={busy}
                    onChange={validation.handleFieldChange}
                    {...validation.getFieldProps('password')}
                  />
                  <FieldError id={validation.getFieldErrorId('password')}>
                    {validation.getFieldError('password')}
                  </FieldError>
                </Field>
                <Field data-invalid={validation.getFieldError('confirmPassword') ? true : undefined}>
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    maxLength={4096}
                    disabled={busy}
                    onChange={validation.handleFieldChange}
                    {...validation.getFieldProps('confirmPassword')}
                  />
                  <FieldError id={validation.getFieldErrorId('confirmPassword')}>
                    {validation.getFieldError('confirmPassword')}
                  </FieldError>
                </Field>
              </>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {state === 'pending'
                ? 'Finishing...'
                : state === 'completed'
                  ? 'Opening sign in...'
                  : state === 'retry'
                    ? 'Try again'
                    : resume
                      ? 'Finish recovery'
                      : 'Update password'}
            </Button>
          </form>
        )}
        <RecoveryRequestLink />
      </CardContent>
    </Card>
  )
}
