'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/atoms/card'
import { Field, FieldError } from '@/components/atoms/field'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { Button } from '@/components/atoms/button'
import { Alert } from '@/components/atoms/alert'
import { Heading } from '@/components/atoms/Heading'
import { usePublicFormValidation } from '@/components/molecules/PublicFormValidation'

const formSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
})

type FormState =
  | { status: 'idle'; error: string | null }
  | { status: 'submitting'; error: string | null }
  | { status: 'success'; error: null }

type ParsedData = z.infer<typeof formSchema>

export type ResetPasswordReason = 'expired'

async function submitRequest(data: ParsedData) {
  const response = await fetch('/api/auth/password/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : 'Unable to send reset email.'
    throw new Error(message)
  }
}

export function ResetPasswordRequestForm({ reason }: { reason?: ResetPasswordReason | null }) {
  const [formState, setFormState] = useState<FormState>({ status: 'idle', error: null })
  const formValidation = usePublicFormValidation({
    messages: {
      email: {
        typeMismatch: 'Enter a valid email address.',
        valueMissing: 'This field is required.',
      },
    },
  })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const form = event.currentTarget
    setFormState({ status: 'idle', error: null })
    if (!formValidation.validateForm(form)) return

    setFormState({ status: 'submitting', error: null })

    const formData = new FormData(form)
    const result = formSchema.safeParse({ email: formData.get('email') })

    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'Enter a valid email address.'
      formValidation.setCustomFieldError('email', message)
      document.getElementById('email')?.focus()
      setFormState({ status: 'idle', error: null })
      return
    }

    try {
      await submitRequest(result.data)
      formValidation.clearAllFieldErrors()
      setFormState({ status: 'success', error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send reset email.'
      setFormState({ status: 'idle', error: message })
    }
  }

  const isSubmitting = formState.status === 'submitting'
  const isSuccess = formState.status === 'success'

  return (
    <div className="flex items-start justify-center py-6 sm:px-4 sm:py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Heading as="h1" align="center" size="h4" className="font-semibold">
            Reset your password
          </Heading>
          <CardDescription className="text-center">
            Enter the email associated with your account and we&apos;ll send instructions to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form
            method="post"
            action="/api/auth/password/reset"
            onSubmit={handleSubmit}
            onInvalid={formValidation.handleInvalid}
            className="space-y-4"
            noValidate
          >
            {reason === 'expired' ? (
              <Alert variant="warning" role="status">
                That link is no longer valid. Request a new password reset link.
              </Alert>
            ) : null}
            {formState.error && <Alert variant="error">{formState.error}</Alert>}
            {isSuccess && (
              <Alert variant="success" role="status">
                If the email exists in our records you will receive a password reset link shortly.
              </Alert>
            )}
            <Field data-invalid={formValidation.getFieldError('email') ? true : undefined}>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={isSubmitting || isSuccess}
                onChange={formValidation.handleFieldChange}
                {...formValidation.getFieldProps('email')}
              />
              <FieldError id={formValidation.getFieldErrorId('email')}>
                {formValidation.getFieldError('email')}
              </FieldError>
            </Field>
            <Button type="submit" className="w-full" disabled={isSubmitting || isSuccess}>
              {isSubmitting ? 'Sending reset email...' : 'Send reset instructions'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
