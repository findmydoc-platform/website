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
import type { RecoveryRequestFormCopy } from '@/features/uiCopy/passwordRecovery'

const formSchema = z.object({
  email: z.string().email(),
})

type RecoveryRequestFailure = 'invalid-email' | 'retry'
type FormState = { status: 'idle' | 'submitting' | 'success' } | { status: 'failed'; failure: RecoveryRequestFailure }

type ParsedData = z.infer<typeof formSchema>

export type ResetPasswordReason = 'expired'

async function submitRequest(data: ParsedData): Promise<RecoveryRequestFailure | void> {
  const response = await fetch('/api/auth/password/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) return response.status === 400 ? 'invalid-email' : 'retry'
}

export function ResetPasswordRequestForm({
  copy,
  reason,
  onRequest = submitRequest,
  initialEmail,
  preparationNotice,
}: {
  copy: RecoveryRequestFormCopy
  reason?: ResetPasswordReason | null
  onRequest?: (data: ParsedData) => Promise<RecoveryRequestFailure | void>
  initialEmail?: string
  preparationNotice?: string
}) {
  const [formState, setFormState] = useState<FormState>({ status: 'idle' })
  const formValidation = usePublicFormValidation({
    messages: {
      email: {
        typeMismatch: copy.invalidEmail,
        valueMissing: copy.requiredEmail,
      },
    },
  })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const form = event.currentTarget
    setFormState({ status: 'idle' })
    if (!formValidation.validateForm(form)) return

    setFormState({ status: 'submitting' })

    const formData = new FormData(form)
    const result = formSchema.safeParse({ email: formData.get('email') })

    if (!result.success) {
      formValidation.setCustomFieldError('email', copy.invalidEmail)
      document.getElementById('email')?.focus()
      setFormState({ status: 'idle' })
      return
    }

    try {
      const failure = await onRequest(result.data)
      if (failure) {
        setFormState({ status: 'failed', failure })
        return
      }
      form.reset()
      formValidation.clearAllFieldErrors()
      setFormState({ status: 'success' })
    } catch {
      setFormState({ status: 'failed', failure: 'retry' })
    }
  }

  const isSubmitting = formState.status === 'submitting'
  const isSuccess = formState.status === 'success'

  return (
    <div className="flex items-start justify-center py-6 sm:px-4 sm:py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Heading as="h1" align="center" size="h4" className="font-semibold">
            {copy.title}
          </Heading>
          <CardDescription className="text-center text-foreground">{copy.description}</CardDescription>
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
                {copy.expired}
              </Alert>
            ) : null}
            {preparationNotice ? (
              <Alert variant="info" role="status">
                {preparationNotice}
              </Alert>
            ) : null}
            {formState.status === 'failed' && (
              <Alert variant="error">
                {formState.failure === 'invalid-email' ? copy.invalidRequest : copy.unavailable}
              </Alert>
            )}
            {isSuccess && (
              <Alert variant="success" role="status">
                {copy.success}
              </Alert>
            )}
            <Field data-invalid={formValidation.getFieldError('email') ? true : undefined}>
              <Label htmlFor="email">{copy.email}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={initialEmail}
                required
                disabled={isSubmitting || isSuccess}
                onChange={formValidation.handleFieldChange}
                {...formValidation.getFieldProps('email')}
              />
              <FieldError id={formValidation.getFieldErrorId('email')}>
                {formValidation.getFieldError('email')}
              </FieldError>
            </Field>
            <Button
              type="submit"
              className="h-auto min-h-10 w-full whitespace-normal"
              disabled={isSubmitting || isSuccess}
            >
              {isSubmitting ? copy.sending : copy.submit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
