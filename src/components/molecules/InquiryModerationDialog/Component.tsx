'use client'

import * as React from 'react'

import { Button } from '@/components/atoms/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/atoms/dialog'
import { Field, FieldError } from '@/components/atoms/field'
import { Label } from '@/components/atoms/label'
import { Textarea } from '@/components/atoms/textarea'
import { usePublicFormValidation } from '@/components/molecules/PublicFormValidation'
import type {
  InquiryModerationReportCategory,
  InquiryModerationReportInput,
} from '@/features/inquiryModeration/contracts'

export type InquiryReportTarget = Pick<InquiryModerationReportInput, 'inquiryId' | 'targetId' | 'targetType'> & {
  label: string
  preview: string
}

type MutationResult = { error?: string; ok: boolean }

export type InquiryReportFormValues = {
  category: InquiryModerationReportCategory
  description?: string
}

export type InquiryAppealFormValues = { text: string }

const categories: Array<{ label: string; value: InquiryModerationReportCategory }> = [
  { label: 'Harassment or threats', value: 'harassment-threats' },
  { label: 'Spam, fraud or impersonation', value: 'spam-fraud-impersonation' },
  { label: 'Suspected illegal content', value: 'suspected-illegal-content' },
  { label: 'Privacy concern or wrong recipient', value: 'privacy-concern' },
  { label: 'Other', value: 'other' },
]

export function InquiryReportDialog({
  onFallbackFocus,
  onOpenChange,
  onSubmit,
  open,
  target,
}: {
  onFallbackFocus?: () => void
  onOpenChange: (open: boolean) => void
  onSubmit: (values: InquiryReportFormValues) => Promise<MutationResult>
  open: boolean
  target?: InquiryReportTarget
}) {
  const [category, setCategory] = React.useState<InquiryModerationReportCategory | ''>('')
  const [description, setDescription] = React.useState('')
  const [error, setError] = React.useState<string>()
  const [status, setStatus] = React.useState<'editing' | 'submitting' | 'submitted'>('editing')
  const reasonRef = React.useRef<HTMLSelectElement>(null)
  const returnFocusRef = React.useRef<HTMLElement>(null)
  const submittedHeadingRef = React.useRef<HTMLHeadingElement>(null)
  const formValidation = usePublicFormValidation()

  React.useEffect(() => {
    if (status === 'submitted') submittedHeadingRef.current?.focus()
  }, [status])

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setCategory('')
      setDescription('')
      setError(undefined)
      setStatus('editing')
      formValidation.clearAllFieldErrors()
    }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formValidation.validateForm(event.currentTarget)) return
    if (!target || !category) return
    setError(undefined)
    setStatus('submitting')
    const result = await onSubmit({
      category,
      ...(description ? { description } : {}),
    })
    if (result.ok) setStatus('submitted')
    else {
      setError(result.error ?? 'The report could not be submitted. Try again.')
      setStatus('editing')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90svh] overflow-y-auto rounded-xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          reasonRef.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus()
          else onFallbackFocus?.()
        }}
      >
        {status === 'submitted' ? (
          <>
            <DialogHeader>
              <DialogTitle ref={submittedHeadingRef} tabIndex={-1}>
                Report received
              </DialogTitle>
              <DialogDescription>
                findmydoc will review the report. Reporting does not automatically restrict the conversation.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} onInvalid={formValidation.handleInvalid} noValidate>
            <DialogHeader>
              <DialogTitle>Report {target?.label ?? 'content'}</DialogTitle>
              <DialogDescription>
                Share the reason with findmydoc. The other participant will not see your report details.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 space-y-5">
              <div className="rounded-lg border border-border bg-muted/35 px-3 py-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Reported {target?.label ?? 'content'}
                </p>
                <p className="mt-1 line-clamp-3 text-sm leading-6 text-foreground">{target?.preview}</p>
              </div>
              <Field className="space-y-2" data-invalid={formValidation.getFieldError('category') ? true : undefined}>
                <Label htmlFor="inquiry-report-reason">Reason</Label>
                <select
                  ref={reasonRef}
                  id="inquiry-report-reason"
                  aria-label="Reason"
                  {...formValidation.getFieldProps('category')}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  name="category"
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value as InquiryModerationReportCategory)
                    formValidation.handleFieldChange(event)
                  }}
                  required
                >
                  <option value="">Select a reason</option>
                  {categories.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <FieldError id={formValidation.getFieldErrorId('category')}>
                  {formValidation.getFieldError('category')}
                </FieldError>
              </Field>
              <Field
                className="space-y-2"
                data-invalid={formValidation.getFieldError('description') ? true : undefined}
              >
                <Label htmlFor="inquiry-report-description">
                  Additional details {category === 'other' ? '(required)' : '(optional)'}
                </Label>
                <Textarea
                  id="inquiry-report-description"
                  aria-label="Additional details"
                  {...formValidation.getFieldProps('description')}
                  maxLength={1000}
                  name="description"
                  required={category === 'other'}
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value)
                    formValidation.handleFieldChange(event)
                  }}
                />
                <FieldError id={formValidation.getFieldErrorId('description')}>
                  {formValidation.getFieldError('description')}
                </FieldError>
              </Field>
              <p className="rounded-lg border border-warning/35 bg-warning/10 px-3 py-3 text-sm leading-6 text-foreground">
                This report is not an emergency channel. Contact local emergency services if someone is in immediate
                danger.
              </p>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={status === 'submitting' || !target}>
                {status === 'submitting' ? 'Submitting…' : 'Submit report'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function InquiryAppealDialog({
  caseId,
  onFallbackFocus,
  onOpenChange,
  onSubmit,
  open,
}: {
  caseId?: string
  onFallbackFocus?: () => void
  onOpenChange: (open: boolean) => void
  onSubmit: (values: InquiryAppealFormValues) => Promise<MutationResult>
  open: boolean
}) {
  const [text, setText] = React.useState('')
  const [error, setError] = React.useState<string>()
  const [status, setStatus] = React.useState<'editing' | 'submitting' | 'submitted'>('editing')
  const appealRef = React.useRef<HTMLTextAreaElement>(null)
  const returnFocusRef = React.useRef<HTMLElement>(null)
  const submittedHeadingRef = React.useRef<HTMLHeadingElement>(null)
  const submittedOnCloseRef = React.useRef(false)
  const formValidation = usePublicFormValidation()

  React.useEffect(() => {
    if (status === 'submitted') submittedHeadingRef.current?.focus()
  }, [status])

  const handleOpenChange = (nextOpen: boolean) => {
    submittedOnCloseRef.current = !nextOpen && status === 'submitted'
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setText('')
      setError(undefined)
      setStatus('editing')
      formValidation.clearAllFieldErrors()
    }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formValidation.validateForm(event.currentTarget)) return
    if (!caseId) return
    setStatus('submitting')
    const result = await onSubmit({ text })
    if (result.ok) setStatus('submitted')
    else {
      setError(result.error ?? 'The appeal could not be submitted. Try again.')
      setStatus('editing')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="rounded-xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          appealRef.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (submittedOnCloseRef.current) onFallbackFocus?.()
          else if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus()
          else onFallbackFocus?.()
          submittedOnCloseRef.current = false
        }}
      >
        {status === 'submitted' ? (
          <>
            <DialogHeader>
              <DialogTitle ref={submittedHeadingRef} tabIndex={-1}>
                Appeal submitted
              </DialogTitle>
              <DialogDescription>findmydoc will review this one appeal.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} onInvalid={formValidation.handleInvalid} noValidate>
            <DialogHeader>
              <DialogTitle>Appeal this restriction</DialogTitle>
              <DialogDescription>Explain briefly why the decision should be reviewed.</DialogDescription>
            </DialogHeader>
            <Field className="mt-6 space-y-2" data-invalid={formValidation.getFieldError('appeal') ? true : undefined}>
              <Label htmlFor="inquiry-appeal-text">Appeal</Label>
              <Textarea
                ref={appealRef}
                id="inquiry-appeal-text"
                aria-label="Appeal"
                {...formValidation.getFieldProps('appeal')}
                maxLength={1000}
                name="appeal"
                required
                value={text}
                onChange={(event) => {
                  setText(event.target.value)
                  formValidation.handleFieldChange(event)
                }}
              />
              <FieldError id={formValidation.getFieldErrorId('appeal')}>
                {formValidation.getFieldError('appeal')}
              </FieldError>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </Field>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={status === 'submitting' || !caseId}>
                {status === 'submitting' ? 'Submitting…' : 'Submit appeal'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
