'use client'

import type React from 'react'
import { useId, useState } from 'react'
import { Button } from '@/components/atoms/button'
import { Field, FieldError } from '@/components/atoms/field'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { Alert } from '@/components/atoms/alert'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import {
  focusFirstInvalidControl,
  usePublicFormValidation,
  type NativeValidationMessageOverridesByField,
} from '@/components/molecules/PublicFormValidation'
import Link from 'next/link'
import { cn } from '@/utilities/ui'

interface FormField {
  name: string
  label: string
  type: string
  autoComplete?: React.ComponentProps<typeof Input>['autoComplete']
  placeholder?: string
  required?: boolean
  minLength?: number
  hint?: string
  gridCol?: '1' | '2'
}

export type RegistrationSubmitHandler = (data: Record<string, string>) => Promise<void>

interface RegistrationFormProps {
  title: string
  description: string
  successMessage?: string
  fields: FormField[]
  submitButtonText: string
  formMessages?: {
    validation?: NativeValidationMessageOverridesByField
    passwordMismatch?: string
    pending?: string
    loginPrompt?: string
    fallbackError?: string
  }
  formRef?: React.Ref<HTMLFormElement>
  initialValues?: Record<string, string>
  containerClassName?: string
  links?: {
    login?: { href: string; text: string }
    home?: { href: string; text: string }
  }
  onSubmit: RegistrationSubmitHandler
  onSuccess?: (data: Record<string, string>) => Promise<void> | void
}

type FieldGroup = { kind: 'single'; field: FormField } | { kind: 'grid'; fields: FormField[] }

export function RegistrationForm({
  title,
  description,
  successMessage = 'Your registration was submitted successfully.',
  fields,
  submitButtonText,
  formMessages,
  containerClassName,
  formRef,
  initialValues,
  links,
  onSubmit,
  onSuccess,
}: RegistrationFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const headingId = useId()
  const formValidation = usePublicFormValidation({ messages: formMessages?.validation })
  const passwordMismatch = formMessages?.passwordMismatch ?? 'Passwords do not match.'
  const pendingText = formMessages?.pending ?? 'Creating Account...'

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setHasSubmitted(false)
    setError(null)

    const form = e.currentTarget
    if (!formValidation.validateForm(form)) return

    const formData = new FormData(form)
    const data: Record<string, string> = {}

    fields.forEach((field) => {
      data[field.name] = formData.get(field.name) as string
    })

    if (data.password && data.confirmPassword && data.password !== data.confirmPassword) {
      formValidation.setCustomFieldError('confirmPassword', passwordMismatch)
      focusFirstInvalidControl(form, 'confirmPassword')
      return
    }

    const { confirmPassword: _confirmPassword, ...submissionData } = data
    setIsLoading(true)

    try {
      await onSubmit(submissionData)
      await onSuccess?.(submissionData)
      setHasSubmitted(true)
      formValidation.clearAllFieldErrors()
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      setError(msg || (formMessages?.fallbackError ?? 'Registration failed'))
    } finally {
      setIsLoading(false)
    }
  }

  const renderField = (field: FormField) => {
    const fieldError = formValidation.getFieldError(field.name)
    const fieldErrorId = formValidation.getFieldErrorId(field.name)
    const hintId = field.hint ? `${headingId}-${field.name}-hint` : undefined
    const fieldProps = formValidation.getFieldProps(field.name)

    return (
      <Field key={field.name} data-invalid={fieldError ? true : undefined}>
        <Label htmlFor={field.name}>{field.label}</Label>
        {field.hint && (
          <p id={hintId} className="text-xs text-foreground">
            {field.hint}
          </p>
        )}
        <Input
          id={field.name}
          name={field.name}
          type={field.type}
          placeholder={field.placeholder}
          autoComplete={field.autoComplete}
          required={field.required}
          disabled={isLoading}
          minLength={field.minLength}
          defaultValue={initialValues?.[field.name]}
          onChange={(event) => {
            formValidation.handleFieldChange(event)
            if (field.name === 'password' && formValidation.getFieldError('confirmPassword') === passwordMismatch) {
              formValidation.clearFieldError('confirmPassword')
            }
          }}
          {...fieldProps}
          aria-describedby={[hintId, fieldProps['aria-describedby']].filter(Boolean).join(' ') || undefined}
        />
        <FieldError id={fieldErrorId}>{fieldError}</FieldError>
      </Field>
    )
  }

  // Preserve the authored field order while still grouping adjacent paired fields responsively.
  const fieldGroups = fields.reduce<FieldGroup[]>((groups, field) => {
    if (field.gridCol === '2') {
      const lastGroup = groups.at(-1)

      if (lastGroup?.kind === 'grid') {
        lastGroup.fields.push(field)
        return groups
      }

      groups.push({ kind: 'grid', fields: [field] })
      return groups
    }

    groups.push({ kind: 'single', field })
    return groups
  }, [])

  return (
    <div className={cn('flex items-start justify-center px-0 py-8 sm:px-4 sm:py-12', containerClassName)}>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 p-5 pb-4 sm:p-6 sm:pb-5">
          <Heading
            as="h1"
            id={headingId}
            align="center"
            size="h4"
            className="text-[1.65rem] leading-tight text-balance sm:text-2xl"
          >
            {title}
          </Heading>
          <CardDescription className="text-center leading-6 text-balance">{description}</CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
          <div className="space-y-5">
            {error && (
              <Alert variant="error" className="text-left break-words">
                {error}
              </Alert>
            )}
            {hasSubmitted ? (
              <Alert variant="success" role="status" className="text-left break-words">
                {successMessage}
              </Alert>
            ) : (
              <form
                ref={formRef}
                aria-labelledby={headingId}
                onSubmit={handleSubmit}
                onInvalid={formValidation.handleInvalid}
                className="space-y-4"
                noValidate
              >
                <p className="sr-only" role="status">
                  {isLoading ? pendingText : null}
                </p>
                {fieldGroups.map((group, index) =>
                  group.kind === 'grid' ? (
                    <div key={`grid-group-${index}`} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {group.fields.map(renderField)}
                    </div>
                  ) : (
                    renderField(group.field)
                  ),
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? pendingText : submitButtonText}
                </Button>
              </form>
            )}

            {links && (
              <div className="space-y-3 text-center [&_a]:break-words [&_p]:leading-5">
                {links.login && (
                  <p className="text-sm text-muted-foreground">
                    {formMessages?.loginPrompt ?? 'Already have an account?'}{' '}
                    <Link href={links.login.href} className="text-primary hover:underline">
                      {links.login.text}
                    </Link>
                  </p>
                )}
                {links.home && (
                  <p className="text-sm text-muted-foreground">
                    <Link href={links.home.href} className="text-primary hover:underline">
                      {links.home.text}
                    </Link>
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
