'use client'

import { type FormEvent, useId, useState } from 'react'

import { Button } from '@/components/atoms/button'
import { Field, FieldError } from '@/components/atoms/field'
import { Input } from '@/components/atoms/input'
import { Textarea } from '@/components/atoms/textarea'
import { usePublicFormValidation } from '@/components/molecules/PublicFormValidation'
import {
  DEFAULT_CONTACT_FORM_LABELS,
  DEFAULT_CONTACT_FORM_SLUG,
  type ContactRequestFormLabels,
} from './contactRequestForm.shared'

export type ContactFormContext = 'clinic_partner_landing' | 'clinic_profile_inquiry'
export type ContactSubmissionMetadata = Partial<Record<'clinic' | 'source', string>>

type ContactRequestContextPayload = ContactSubmissionMetadata & {
  form_context?: ContactFormContext
}

type ContactRequestPayload = ContactRequestContextPayload &
  ({ email: string } | { name: string; email: string; message: string })

export type ContactRequestSubmitter = (
  targetSlug: string,
  payload: ContactRequestPayload,
  genericErrorMessage?: string,
) => Promise<void>

type ContactRequestFormProps = {
  contactMode: 'compact' | 'full'
  contactFormSlug?: string
  formContext?: ContactFormContext
  labels?: ContactRequestFormLabels
  onSubmitContact?: ContactRequestSubmitter
  primaryCtaLabel: string
  submissionMetadata?: ContactSubmissionMetadata
}

const submitContactRequest: ContactRequestSubmitter = async (targetSlug, payload, genericErrorMessage) => {
  const response = await fetch(`/api/form-bridge/${encodeURIComponent(targetSlug)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}))
    const errorMessage =
      typeof (errorPayload as { error?: unknown }).error === 'string'
        ? (errorPayload as { error: string }).error
        : (genericErrorMessage ?? DEFAULT_CONTACT_FORM_LABELS.genericErrorMessage)
    throw new Error(errorMessage)
  }
}

const normalizeSubmissionMetadata = (submissionMetadata?: ContactSubmissionMetadata): ContactSubmissionMetadata => {
  if (!submissionMetadata) return {}

  return Object.fromEntries(
    Object.entries(submissionMetadata).flatMap(([field, value]) => {
      if (typeof value !== 'string') return []

      const normalizedField = field.trim()
      const normalizedValue = value.trim()

      if (!normalizedField || !normalizedValue) return []

      return [[normalizedField, normalizedValue]]
    }),
  )
}

export function ContactRequestForm({
  contactMode,
  contactFormSlug,
  formContext,
  labels,
  onSubmitContact = submitContactRequest,
  primaryCtaLabel,
  submissionMetadata,
}: ContactRequestFormProps) {
  const isCompactContact = contactMode === 'compact'
  const targetSlug = contactFormSlug?.trim() || DEFAULT_CONTACT_FORM_SLUG
  const copy = labels ?? DEFAULT_CONTACT_FORM_LABELS
  const formId = useId()
  const statusMessageId = `${formId}-status`
  const nameInputId = `${formId}-name`
  const emailInputId = `${formId}-email`
  const messageInputId = `${formId}-message`
  const nameLabel = copy.namePlaceholder.trim() || DEFAULT_CONTACT_FORM_LABELS.namePlaceholder
  const emailLabel = copy.emailPlaceholder.trim() || DEFAULT_CONTACT_FORM_LABELS.emailPlaceholder
  const messageLabel = copy.messagePlaceholder.trim() || DEFAULT_CONTACT_FORM_LABELS.messagePlaceholder
  const formValidation = usePublicFormValidation({
    messages: {
      email: {
        typeMismatch: 'Enter a valid email address.',
        valueMissing: copy.emailRequiredMessage,
      },
      message: { valueMissing: copy.messageRequiredMessage },
      name: { valueMissing: copy.nameRequiredMessage },
    },
  })

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  const resetMessages = () => {
    setSubmitError(null)
    setSubmitSuccess(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetMessages()

    if (!formValidation.validateForm(event.currentTarget)) return

    const metadataPayload = normalizeSubmissionMetadata(submissionMetadata)
    const contextPayload: ContactRequestContextPayload = formContext ? { form_context: formContext } : {}
    const payload = isCompactContact
      ? { ...metadataPayload, ...contextPayload, email: email.trim() }
      : { ...metadataPayload, ...contextPayload, name: name.trim(), email: email.trim(), message: message.trim() }

    setIsSubmitting(true)

    try {
      await onSubmitContact(targetSlug, payload, copy.genericErrorMessage)

      if (!isCompactContact) {
        setName('')
        setMessage('')
      }
      setEmail('')
      formValidation.clearAllFieldErrors()
      setSubmitSuccess(copy.successMessage)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : copy.genericErrorMessage
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} onInvalid={formValidation.handleInvalid} className="space-y-3" noValidate>
      {isCompactContact ? null : (
        <Field data-invalid={formValidation.getFieldError('name') ? true : undefined}>
          <label htmlFor={nameInputId} className="text-xs font-medium text-slate-700">
            {nameLabel}
          </label>
          <Input
            id={nameInputId}
            aria-required="true"
            name="name"
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              formValidation.handleFieldChange(event)
              resetMessages()
            }}
            placeholder={nameLabel}
            autoComplete="name"
            className="h-12 rounded-xl border-slate-200 bg-slate-50/90 text-slate-950 placeholder:text-slate-400"
            {...formValidation.getFieldProps('name')}
          />
          <FieldError id={formValidation.getFieldErrorId('name')}>{formValidation.getFieldError('name')}</FieldError>
        </Field>
      )}

      <Field data-invalid={formValidation.getFieldError('email') ? true : undefined}>
        <label htmlFor={emailInputId} className="text-xs font-medium text-slate-700">
          {emailLabel}
        </label>
        <Input
          id={emailInputId}
          aria-required="true"
          name="email"
          required
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            formValidation.handleFieldChange(event)
            resetMessages()
          }}
          placeholder={emailLabel}
          autoComplete="email"
          className="h-12 rounded-xl border-slate-200 bg-slate-50/90 text-slate-950 placeholder:text-slate-400"
          {...formValidation.getFieldProps('email')}
        />
        <FieldError id={formValidation.getFieldErrorId('email')}>{formValidation.getFieldError('email')}</FieldError>
      </Field>

      {isCompactContact ? null : (
        <Field data-invalid={formValidation.getFieldError('message') ? true : undefined}>
          <label htmlFor={messageInputId} className="text-xs font-medium text-slate-700">
            {messageLabel}
          </label>
          <Textarea
            id={messageInputId}
            aria-required="true"
            name="message"
            required
            value={message}
            onChange={(event) => {
              setMessage(event.target.value)
              formValidation.handleFieldChange(event)
              resetMessages()
            }}
            placeholder={messageLabel}
            className="min-h-28 rounded-xl border-slate-200 bg-slate-50/90 text-slate-950 placeholder:text-slate-400 sm:min-h-32"
            {...formValidation.getFieldProps('message')}
          />
          <FieldError id={formValidation.getFieldErrorId('message')}>
            {formValidation.getFieldError('message')}
          </FieldError>
        </Field>
      )}

      {submitSuccess ? (
        <p id={statusMessageId} role="status" className="text-xs leading-5 text-emerald-700">
          {submitSuccess}
        </p>
      ) : null}
      {submitError ? (
        <p id={statusMessageId} role="alert" className="text-xs leading-5 text-destructive/90">
          {submitError}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        hoverEffect="wave"
        className="min-h-12 w-full rounded-xl"
        disabled={isSubmitting}
      >
        {isSubmitting ? copy.submittingLabel : primaryCtaLabel}
      </Button>
    </form>
  )
}
