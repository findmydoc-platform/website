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

export function PatientVerificationResendForm() {
  const [state, setState] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
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
      const response = await fetch('/api/auth/register/patient/resend', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: new FormData(form).get('email') }),
        redirect: 'error',
      })
      if (!response.ok) {
        setState('error')
        return
      }
      form.reset()
      setState('success')
    } catch {
      setState('error')
    }
  }
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <Heading as="h2" size="h5" align="left">
          Need another verification email?
        </Heading>
        <CardDescription>Enter the email you used to register.</CardDescription>
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
              onChange={validation.handleFieldChange}
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
