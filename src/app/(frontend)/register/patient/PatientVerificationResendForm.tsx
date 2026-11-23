'use client'

import { useState, type Ref } from 'react'
import { Alert } from '@/components/atoms/alert'
import { Button } from '@/components/atoms/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/atoms/card'
import { Field, FieldError } from '@/components/atoms/field'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { Heading } from '@/components/atoms/Heading'
import { usePublicFormValidation } from '@/components/molecules/PublicFormValidation'
import type { PatientVerificationResendCopy } from '@/features/uiCopy/patientVerification'

export const PATIENT_VERIFICATION_RESEND_ID = 'patient-verification-resend'

async function requestVerification(email: string) {
  const response = await fetch('/api/auth/register/patient/resend', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
    redirect: 'error',
  })
  if (!response.ok) throw new Error('REQUEST_UNAVAILABLE')
}

export function PatientVerificationResendForm({
  copy,
  onRequest = requestVerification,
  initialEmail,
  formRef,
}: Readonly<{
  copy: PatientVerificationResendCopy
  onRequest?: (email: string) => Promise<void>
  initialEmail?: string
  formRef?: Ref<HTMLFormElement>
}>) {
  const [state, setState] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const validation = usePublicFormValidation({
    messages: {
      email: copy.emailValidation,
    },
  })
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setState('idle')
    if (!validation.validateForm(form)) return
    const email = new FormData(form).get('email')
    if (typeof email !== 'string') return

    setState('pending')
    try {
      await onRequest(email)
      const emailField = form.elements.namedItem('email')
      if (emailField instanceof HTMLInputElement) emailField.value = ''
      setState('success')
    } catch {
      setState('error')
    }
  }
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <Heading as="h2" size="h5" align="left" id={PATIENT_VERIFICATION_RESEND_ID} tabIndex={-1}>
          {copy.title}
        </Heading>
        <CardDescription className="text-foreground">{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          method="post"
          action="/api/auth/register/patient/resend"
          onSubmit={submit}
          onInvalid={validation.handleInvalid}
          noValidate
          className="space-y-4"
        >
          {state === 'pending' ? (
            <p className="sr-only" role="status">
              {copy.announcementPending}
            </p>
          ) : null}
          {state === 'success' ? (
            <Alert variant="success" role="status">
              {copy.success}
            </Alert>
          ) : null}
          {state === 'error' ? (
            <Alert variant="error" role="alert">
              {copy.error}
            </Alert>
          ) : null}
          <Field data-invalid={validation.getFieldError('email') ? true : undefined}>
            <Label htmlFor="verification-resend-email">{copy.email}</Label>
            <Input
              id="verification-resend-email"
              name="email"
              type="email"
              maxLength={254}
              autoComplete="email"
              required
              disabled={state === 'pending'}
              defaultValue={initialEmail}
              onChange={validation.handleFieldChange}
              {...validation.getFieldProps('email')}
            />
            <FieldError id={validation.getFieldErrorId('email')}>{validation.getFieldError('email')}</FieldError>
          </Field>
          <Button type="submit" className="w-full" disabled={state === 'pending'}>
            {state === 'pending' ? copy.requesting : copy.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
