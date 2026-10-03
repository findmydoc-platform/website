'use client'

import { useState } from 'react'
import { Alert } from '@/components/atoms/alert'
import { Button } from '@/components/atoms/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/atoms/card'
import { Field, FieldError } from '@/components/atoms/field'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { Heading } from '@/components/atoms/Heading'
import { usePublicFormValidation } from '@/components/molecules/PublicFormValidation'

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
  onRequest = requestVerification,
}: Readonly<{ onRequest?: (email: string) => Promise<void> }>) {
  const [state, setState] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [email, setEmail] = useState('')
  const validation = usePublicFormValidation({
    messages: {
      email: {
        typeMismatch: 'Enter a valid email address.',
        valueMissing: 'This field is required.',
      },
    },
  })
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setState('idle')
    if (!validation.validateForm(form)) return
    setState('pending')
    try {
      await onRequest(email)
      setEmail('')
      setState('success')
    } catch {
      setState('error')
    }
  }
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <Heading as="h2" size="h5" align="left" id="patient-verification-resend" tabIndex={-1}>
          Need another verification email?
        </Heading>
        <CardDescription className="text-foreground">Enter the email you used to register.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          method="post"
          action="/api/auth/register/patient/resend"
          onSubmit={submit}
          onInvalid={validation.handleInvalid}
          noValidate
          className="space-y-4"
        >
          {state === 'pending' ? (
            <p className="sr-only" role="status">
              Requesting your verification email.
            </p>
          ) : null}
          {state === 'success' ? (
            <Alert variant="success" role="status">
              If an eligible registration exists, you will receive a verification email. Check your inbox and spam
              folder.
            </Alert>
          ) : null}
          {state === 'error' ? (
            <Alert variant="error" role="alert">
              We could not accept this request. Please try again.
            </Alert>
          ) : null}
          <Field data-invalid={validation.getFieldError('email') ? true : undefined}>
            <Label htmlFor="verification-resend-email">Email</Label>
            <Input
              id="verification-resend-email"
              name="email"
              type="email"
              maxLength={254}
              autoComplete="email"
              required
              disabled={state === 'pending'}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                validation.handleFieldChange(event)
              }}
              {...validation.getFieldProps('email')}
            />
            <FieldError id={validation.getFieldErrorId('email')}>{validation.getFieldError('email')}</FieldError>
          </Field>
          <Button type="submit" className="w-full" disabled={state === 'pending'}>
            {state === 'pending' ? 'Requesting...' : 'Request verification email'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
