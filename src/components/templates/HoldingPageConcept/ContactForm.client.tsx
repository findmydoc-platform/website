'use client'

import { type FormEvent, useState } from 'react'

import { Button } from '@/components/atoms/button'
import { Input } from '@/components/atoms/input'
import { Textarea } from '@/components/atoms/textarea'
import {
  DEFAULT_CONTACT_FORM_LABELS,
  DEFAULT_CONTACT_FORM_SLUG,
  type HoldingPageContactFormLabels,
} from './contactForm.shared'

type ContactFormProps = {
  contactMode: 'compact' | 'full'
  contactFormSlug?: string
  labels?: HoldingPageContactFormLabels
  primaryCtaLabel: string
}

export function HoldingPageContactForm({ contactMode, contactFormSlug, labels, primaryCtaLabel }: ContactFormProps) {
  const isCompactContact = contactMode === 'compact'
  const targetSlug = contactFormSlug?.trim() || DEFAULT_CONTACT_FORM_SLUG
  const copy = labels ?? DEFAULT_CONTACT_FORM_LABELS

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

  const validate = (): string | null => {
    if (!email.trim()) return copy.emailRequiredMessage
    if (!isCompactContact && !name.trim()) return copy.nameRequiredMessage
    if (!isCompactContact && !message.trim()) return copy.messageRequiredMessage
    return null
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetMessages()

    const validationError = validate()
    if (validationError) {
      setSubmitError(validationError)
      return
    }

    const payload = isCompactContact
      ? { email: email.trim() }
      : { name: name.trim(), email: email.trim(), message: message.trim() }

    setIsSubmitting(true)

    try {
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
            : copy.genericErrorMessage
        throw new Error(errorMessage)
      }

      if (!isCompactContact) {
        setName('')
        setMessage('')
      }
      setEmail('')
      setSubmitSuccess(copy.successMessage)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : copy.genericErrorMessage
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {isCompactContact ? null : (
        <Input
          aria-label="Name"
          name="name"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            resetMessages()
          }}
          placeholder={copy.namePlaceholder}
          autoComplete="name"
          className="h-12 rounded-xl border-slate-200 bg-slate-50/90 text-slate-950 placeholder:text-slate-400"
        />
      )}

      <Input
        aria-label="Email"
        name="email"
        type="email"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value)
          resetMessages()
        }}
        placeholder={copy.emailPlaceholder}
        autoComplete="email"
        className="h-12 rounded-xl border-slate-200 bg-slate-50/90 text-slate-950 placeholder:text-slate-400"
      />

      {isCompactContact ? null : (
        <Textarea
          aria-label="Message"
          name="message"
          value={message}
          onChange={(event) => {
            setMessage(event.target.value)
            resetMessages()
          }}
          placeholder={copy.messagePlaceholder}
          className="min-h-28 rounded-xl border-slate-200 bg-slate-50/90 text-slate-950 placeholder:text-slate-400 sm:min-h-32"
        />
      )}

      <Button
        type="submit"
        variant="primary"
        hoverEffect="wave"
        className="min-h-12 w-full rounded-xl"
        disabled={isSubmitting}
      >
        {isSubmitting ? copy.submittingLabel : primaryCtaLabel}
      </Button>

      {submitSuccess ? <p className="text-xs leading-5 text-emerald-700">{submitSuccess}</p> : null}
      {submitError ? <p className="text-xs leading-5 text-red-600">{submitError}</p> : null}
    </form>
  )
}
