'use client'

import { type ReactNode, useCallback, useId, useLayoutEffect, useRef, useState } from 'react'
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
import {
  readChangedPatientAuthInput,
  patientAuthFormInput,
  usePatientAuthFormHandoff,
} from '@/features/languageSwitch/PatientAuthFormHandoff.client'
import {
  useLanguageSwitchRoute,
  type LanguageSwitchTargets,
} from '@/features/languageSwitch/LanguageSwitchRouteProvider.client'
import type { UiCopyLocale } from '@/i18n/requestLocale'

const formSchema = z.object({
  email: z.string().email(),
})

type RecoveryRequestFailure = 'invalid-email' | 'retry'
type FormState = { status: 'idle' | 'submitting' | 'success' } | { status: 'failed'; failure: RecoveryRequestFailure }

type ParsedData = z.infer<typeof formSchema>

export type ResetPasswordReason = 'expired'

async function submitRequest(data: ParsedData, locale?: UiCopyLocale): Promise<RecoveryRequestFailure | void> {
  const response = await fetch('/api/auth/password/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, locale }),
  })

  if (!response.ok) return response.status === 400 ? 'invalid-email' : 'retry'
}

export function ResetPasswordRequestForm({
  copy,
  reason,
  onRequest,
  initialEmail,
  preparationNotice,
  languageSwitch,
  signInOptions,
}: {
  copy: RecoveryRequestFormCopy
  reason?: ResetPasswordReason | null
  onRequest?: (data: ParsedData) => Promise<RecoveryRequestFailure | void>
  initialEmail?: string
  preparationNotice?: string
  languageSwitch?: { locale: UiCopyLocale; targets: LanguageSwitchTargets }
  signInOptions?: ReactNode
}) {
  const [formState, setFormState] = useState<FormState>({ status: 'idle' })
  const formRef = useRef<HTMLFormElement>(null)
  const emailId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const handoff = usePatientAuthFormHandoff()
  const onNavigate = useCallback(
    (href: string) => {
      const email = readChangedPatientAuthInput(formRef.current, 'email')
      if (email !== undefined) handoff?.save(href, { form: 'recovery', email })
    },
    [handoff],
  )

  useLanguageSwitchRoute(languageSwitch && { ...languageSwitch, onNavigate })

  useLayoutEffect(() => {
    if (!languageSwitch) return

    const draft = handoff?.take()
    if (draft?.form !== 'recovery') return

    const email = patientAuthFormInput(formRef.current, 'email')
    if (email) email.value = draft.email
  }, [handoff, languageSwitch])

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
      patientAuthFormInput(form, 'email')?.focus()
      setFormState({ status: 'idle' })
      return
    }

    try {
      const failure = await (onRequest ? onRequest(result.data) : submitRequest(result.data, languageSwitch?.locale))
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

  useLayoutEffect(() => {
    if (isSuccess) headingRef.current?.focus()
  }, [isSuccess])

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <Heading ref={headingRef} tabIndex={-1} as="h1" align="center" size="h4">
          {isSuccess ? copy.successTitle : copy.title}
        </Heading>
        {!isSuccess && <CardDescription className="text-center text-foreground">{copy.description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          method="post"
          action="/api/auth/password/reset"
          onSubmit={handleSubmit}
          onInvalid={formValidation.handleInvalid}
          className="space-y-4"
          noValidate
        >
          <p aria-live="polite" className="sr-only">
            {isSubmitting ? copy.sending : null}
          </p>
          {!isSuccess && reason === 'expired' ? (
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
          <div className={isSuccess ? 'space-y-4 border-t border-site-divider pt-4' : 'space-y-4'}>
            <Field data-invalid={formValidation.getFieldError('email') ? true : undefined}>
              <Label htmlFor={emailId}>{copy.email}</Label>
              <Input
                id={emailId}
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
              className={
                isSuccess
                  ? 'h-auto min-h-11 w-full whitespace-normal disabled:bg-muted disabled:text-foreground disabled:opacity-100'
                  : 'h-auto min-h-11 w-full whitespace-normal'
              }
              disabled={isSubmitting || isSuccess}
            >
              {isSubmitting ? copy.sending : copy.submit}
            </Button>
          </div>
        </form>
        {signInOptions}
      </CardContent>
    </Card>
  )
}
