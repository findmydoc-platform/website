'use client'

import { useId, useState, type FormEvent } from 'react'
import { Alert } from '@/components/atoms/alert'
import { Button } from '@/components/atoms/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { Field, FieldError } from '@/components/atoms/field'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { usePublicFormValidation } from '@/components/molecules/PublicFormValidation'
import { RECOVERY_PASSWORD_MAX_LENGTH, RECOVERY_PASSWORD_MIN_LENGTH } from '@/auth/actions/websiteRecoveryPassword'
import { createPasswordResetCompleteFlash, writeAuthFlash } from '@/auth/utilities/authFlash'
import { resetPostHogBrowserIdentity } from '@/posthog/client-api'
import type { RecoveryCompletionCopy } from '@/features/uiCopy/passwordRecovery'
import { RECOVERY_COMPLETION_PATH, localizedPatientAuthPath } from '@/i18n/patientAuthPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { RecoveryRequestLink, RecoverySafeError, type RecoveryState } from '../../../confirm/RecoveryConfirmationForm'

type PasswordInput = { password?: string; confirmPassword?: string }
export type RecoveryPasswordResult = 'completed' | 'retry' | 'invalid' | 'password-rejected' | 'inquiry-continuation'
export function ResetPasswordCompleteForm({
  copy,
  csrf,
  locale,
  resume = false,
  inquiryContinuationPending = false,
}: Readonly<{
  copy: RecoveryCompletionCopy
  csrf: string | null
  locale: UiCopyLocale
  resume?: boolean
  inquiryContinuationPending?: boolean
}>) {
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
        if (body.inquiryContinuationPending) {
          // Discard the signed-out document's in-memory session before continuing the separate inquiry work.
          const completionPath = localizedPatientAuthPath(RECOVERY_COMPLETION_PATH, locale)
          window.location.assign(`${completionPath}?inquiry=continue`)
          return 'inquiry-continuation'
        }
        writeAuthFlash(createPasswordResetCompleteFlash())
        // A full navigation discards this document's in-memory Supabase session after server cookie cleanup.
        const signInPath =
          body.redirectTo === '/login/patient?status=recovery-complete'
            ? `${localizedPatientAuthPath('/login/patient', locale)}?status=recovery-complete`
            : body.redirectTo
        window.location.assign(signInPath)
        return 'completed'
      }
      return response.status === 503 ? 'retry' : response.status === 422 ? 'password-rejected' : 'invalid'
    } catch {
      return 'retry'
    }
  }
  return (
    <RecoveryPasswordView
      copy={copy}
      available={Boolean(csrf)}
      resume={resume}
      initialState={inquiryContinuationPending ? 'inquiry-continuation' : 'idle'}
      onComplete={complete}
    />
  )
}
export function RecoveryPasswordView({
  available,
  copy,
  resume = false,
  onComplete,
  initialState = 'idle',
}: Readonly<{
  available: boolean
  copy: RecoveryCompletionCopy
  resume?: boolean
  onComplete: (input: PasswordInput) => Promise<RecoveryPasswordResult>
  initialState?: RecoveryState | 'inquiry-continuation'
}>) {
  const [state, setState] = useState<RecoveryState | 'inquiry-continuation'>(available ? initialState : 'invalid')
  const [accountCompleted, setAccountCompleted] = useState(initialState === 'inquiry-continuation')
  const continuing = resume || accountCompleted
  const [passwordRejected, setPasswordRejected] = useState(false)
  const id = useId()
  const passwordHintId = `${id}-hint`
  const validation = usePublicFormValidation({
    messages: {
      password: { valueMissing: copy.requiredPassword, tooShort: copy.shortPassword, tooLong: copy.longPassword },
      confirmPassword: { valueMissing: copy.requiredConfirmation, tooLong: copy.longPassword },
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
    if (!continuing && (password.length < RECOVERY_PASSWORD_MIN_LENGTH || password !== confirmPassword)) {
      const field = password.length < RECOVERY_PASSWORD_MIN_LENGTH ? 'password' : 'confirmPassword'
      validation.setCustomFieldError(field, field === 'password' ? copy.shortPassword : copy.mismatchedPassword)
      const input = form.elements.namedItem(field)
      if (input instanceof HTMLElement) input.focus()
      return
    }
    setState('pending')
    const result = await onComplete(continuing ? {} : { password, confirmPassword })
    if (result === 'password-rejected') {
      setPasswordRejected(true)
      setState('idle')
      const passwordField = form.elements.namedItem('password')
      if (passwordField instanceof HTMLInputElement) passwordField.focus()
    } else {
      if (result === 'inquiry-continuation') setAccountCompleted(true)
      setState(result)
      if (result === 'invalid' || result === 'completed') form.reset()
    }
  }
  const busy = state === 'pending' || state === 'completed'
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <Heading as="h1" size="h4" align="center">
          {state === 'invalid'
            ? copy.shared.invalidTitle
            : accountCompleted
              ? copy.inquiryTitle
              : resume
                ? copy.resumeTitle
                : copy.title}
        </Heading>
        {state !== 'invalid' && (
          <CardDescription className="text-center text-foreground">
            {accountCompleted ? copy.inquiryDescription : resume ? copy.resumeDescription : copy.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {state === 'invalid' ? (
          <RecoverySafeError message={copy.shared.invalidLink} />
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
                {copy.pending}
              </p>
            )}
            {state === 'retry' && (
              <Alert variant="warning" role="alert">
                {copy.unavailable}
              </Alert>
            )}
            {passwordRejected && (
              <Alert variant="error" role="alert">
                {copy.rejected}
              </Alert>
            )}
            {state === 'completed' && (
              <Alert variant="success" role="status">
                {copy.completed}
              </Alert>
            )}
            {state === 'inquiry-continuation' && (
              <Alert variant="success" role="status">
                {copy.inquiryPending}
              </Alert>
            )}
            {!continuing && (
              <>
                <Field data-invalid={validation.getFieldError('password') ? true : undefined}>
                  <Label htmlFor={`${id}-password`}>{copy.password}</Label>
                  {copy.passwordHint && (
                    <p id={passwordHintId} className="text-xs text-foreground">
                      {copy.passwordHint}
                    </p>
                  )}
                  <Input
                    id={`${id}-password`}
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={RECOVERY_PASSWORD_MIN_LENGTH}
                    maxLength={RECOVERY_PASSWORD_MAX_LENGTH}
                    disabled={busy}
                    onChange={validation.handleFieldChange}
                    {...validation.getFieldProps('password')}
                    aria-describedby={
                      [copy.passwordHint && passwordHintId, validation.getFieldProps('password')['aria-describedby']]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                  />
                  <FieldError id={validation.getFieldErrorId('password')}>
                    {validation.getFieldError('password')}
                  </FieldError>
                </Field>
                <Field data-invalid={validation.getFieldError('confirmPassword') ? true : undefined}>
                  <Label htmlFor={`${id}-confirmPassword`}>{copy.confirmPassword}</Label>
                  <Input
                    id={`${id}-confirmPassword`}
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    maxLength={RECOVERY_PASSWORD_MAX_LENGTH}
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
            <Button type="submit" className="h-auto min-h-11 w-full whitespace-normal" disabled={busy}>
              {state === 'pending'
                ? copy.finishing
                : state === 'completed'
                  ? copy.openingSignIn
                  : state === 'inquiry-continuation'
                    ? copy.continueInquiries
                    : state === 'retry'
                      ? copy.shared.retry
                      : resume
                        ? copy.finish
                        : copy.submit}
            </Button>
          </form>
        )}
        <RecoveryRequestLink {...copy.shared.requestLink} prominent={state === 'invalid'} />
      </CardContent>
    </Card>
  )
}
