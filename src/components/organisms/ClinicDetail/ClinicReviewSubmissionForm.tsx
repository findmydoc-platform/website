'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'

import { Button } from '@/components/atoms/button'
import { Field, FieldError } from '@/components/atoms/field'
import { Label } from '@/components/atoms/label'
import { Textarea } from '@/components/atoms/textarea'
import { UiLink } from '@/components/molecules/Link'
import { usePublicFormValidation, type PublicFormValidation } from '@/components/molecules/PublicFormValidation'
import type { ClinicReviewFields, ClinicReviewSubmissionResult } from '@/features/clinicDetail/reviewSubmission'
import type { ClinicReviewsCopy } from '@/features/clinicDetail/reviewsCopy'

type ReviewOption = { id: string; name: string }
type ClinicReviewSubmissionFormProps = {
  copy: ClinicReviewsCopy['form']
  doctors: ReviewOption[]
  treatments: ReviewOption[]
  loginHref: string
  onSubmit?: (fields: ClinicReviewFields) => Promise<ClinicReviewSubmissionResult>
}

const RATINGS: ReviewOption[] = ['5', '4', '3', '2', '1'].map((value) => ({ id: value, name: value }))

function ReviewSelect({
  name,
  label,
  placeholder,
  options,
  validation,
}: {
  name: string
  label: string
  placeholder: string
  options: ReviewOption[]
  validation: PublicFormValidation
}) {
  const id = useId()
  const error = validation.getFieldError(name)
  return (
    <Field className="min-w-0" data-invalid={error ? true : undefined}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        required
        defaultValue=""
        className="h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm"
        onChange={validation.handleFieldChange}
        {...validation.getFieldProps(name)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <FieldError id={validation.getFieldErrorId(name)}>{error}</FieldError>
    </Field>
  )
}

export function ClinicReviewSubmissionForm({
  copy,
  doctors,
  treatments,
  loginHref,
  onSubmit,
}: ClinicReviewSubmissionFormProps) {
  const formId = useId()
  const commentId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState<ClinicReviewSubmissionResult | null>(null)
  const sending = useRef(false)
  const status = useRef<HTMLParagraphElement>(null)
  const validation = usePublicFormValidation({
    messages: {
      doctor: { valueMissing: copy.chooseDoctor },
      treatment: { valueMissing: copy.chooseTreatment },
      rating: { valueMissing: copy.chooseRating },
      comment: { valueMissing: copy.enterComment },
    },
  })

  useEffect(() => {
    if (result === 'pending') status.current?.focus()
  }, [result])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending.current || !onSubmit) return

    const form = event.currentTarget
    setResult(null)
    if (!validation.validateForm(form)) return

    const data = new FormData(form)
    const comment = String(data.get('comment') ?? '')
    if (!comment.trim()) {
      validation.setCustomFieldError('comment', copy.enterComment)
      form.querySelector('textarea')?.focus()
      return
    }

    sending.current = true
    setIsSending(true)
    try {
      setResult(
        await onSubmit({
          doctorId: Number(data.get('doctor')),
          treatmentId: Number(data.get('treatment')),
          rating: Number(data.get('rating')),
          comment,
          allowName: data.has('allowName'),
        }),
      )
    } catch {
      setResult('failed')
    } finally {
      sending.current = false
      setIsSending(false)
    }
  }

  if (!doctors.length || !treatments.length) {
    return <p className="text-sm text-supporting-foreground">{copy.unavailable}</p>
  }

  if (!onSubmit) {
    return (
      <div className="flex flex-wrap items-center gap-3 border-t border-primary/10 pt-5">
        <p className="text-sm text-supporting-foreground">{copy.loginPrompt}</p>
        <UiLink href={loginHref} appearance="secondary">
          {copy.signIn}
        </UiLink>
      </div>
    )
  }

  if (result === 'pending') {
    return (
      <p ref={status} role="status" tabIndex={-1} className="rounded-lg bg-primary/5 p-4 text-sm text-secondary">
        {copy.success}
      </p>
    )
  }

  return (
    <div className="space-y-4 border-t border-primary/10 pt-5">
      <Button
        type="button"
        variant="secondary"
        aria-expanded={isOpen}
        aria-controls={formId}
        disabled={isSending}
        onClick={() => setIsOpen((open) => !open)}
      >
        {copy.heading}
      </Button>
      <form
        id={formId}
        hidden={!isOpen}
        aria-label={copy.heading}
        noValidate
        onInvalid={validation.handleInvalid}
        onSubmit={submit}
      >
        <fieldset disabled={isSending} className="min-w-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ReviewSelect
              name="doctor"
              label={copy.doctor}
              placeholder={copy.chooseDoctor}
              options={doctors}
              validation={validation}
            />
            <ReviewSelect
              name="treatment"
              label={copy.treatment}
              placeholder={copy.chooseTreatment}
              options={treatments}
              validation={validation}
            />
          </div>
          <ReviewSelect
            name="rating"
            label={copy.rating}
            placeholder={copy.chooseRating}
            options={RATINGS}
            validation={validation}
          />
          <Field data-invalid={validation.getFieldError('comment') ? true : undefined}>
            <Label htmlFor={commentId}>{copy.comment}</Label>
            <Textarea
              id={commentId}
              name="comment"
              required
              rows={4}
              onChange={validation.handleFieldChange}
              {...validation.getFieldProps('comment')}
            />
            <FieldError id={validation.getFieldErrorId('comment')}>{validation.getFieldError('comment')}</FieldError>
          </Field>
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input type="checkbox" name="allowName" className="mt-1 size-4 shrink-0 accent-primary" />
            <span>{copy.allowName}</span>
          </label>
          <Button type="submit" variant="primary">
            {isSending ? copy.submitting : copy.submit}
          </Button>
        </fieldset>
        {result ? (
          <div className="mt-4 space-y-2">
            <FieldError>{copy[result]}</FieldError>
            {result === 'reauthenticate' ? (
              <UiLink href={loginHref} appearance="secondary">
                {copy.signIn}
              </UiLink>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  )
}
