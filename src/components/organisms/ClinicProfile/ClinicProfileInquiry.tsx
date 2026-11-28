'use client'

import * as React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { Alert } from '@/components/atoms/alert'
import { Button } from '@/components/atoms/button'
import { Field, FieldError } from '@/components/atoms/field'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { Textarea } from '@/components/atoms/textarea'
import { UiLink } from '@/components/molecules/Link'
import { ClinicInquiryPicker } from './ClinicInquiryPicker'
import { usePublicFormValidation } from '@/components/molecules/PublicFormValidation'
import { INQUIRY_SUBMISSION_CONSENT_TEXT } from '@/features/inquiryCommunication/consent'
import {
  inquiryPreferredContactWindowOptions,
  inquiryTreatmentTimelineOptions,
} from '@/features/inquiryRequest/options'
import type { PatientInquiryCreationContext } from '@/features/patientInquiries/creationContext'

import type { ClinicDetailDoctor, ClinicDetailTreatment } from '@/features/clinicDetail/contracts'

import type { ContactFormFields, ContactFormSelectionError } from '@/components/organisms/ClinicDetail/types'

type ClinicProfileInquiryProps = {
  sectionId: string
  sectionRef: React.RefObject<HTMLElement | null>
  fields: ContactFormFields
  inquiryCreation: PatientInquiryCreationContext
  isPhoneLocked: boolean
  requiresReauthentication: boolean
  submittedInquiryHref: string | null
  preparationRegistrationHref?: string | null
  selectedDoctorId: string
  selectedTreatmentId: string
  doctors: ClinicDetailDoctor[]
  treatments: ClinicDetailTreatment[]
  message: string | null
  messageTone: 'success' | 'error'
  selectionError: ContactFormSelectionError
  isSubmitting: boolean
  isSubmitted: boolean
  feedbackRef: React.RefObject<HTMLDivElement | null>
  onFieldChange: <K extends keyof ContactFormFields>(
    field: K,
    value: ContactFormFields[K],
    isUserEdit?: boolean,
  ) => void
  onDoctorChange: (doctorId: string) => void
  onTreatmentChange: (treatmentId: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

const inputClassName =
  'h-14 w-full rounded-[28px] border border-primary/45 bg-background px-4 text-sm text-secondary outline-hidden transition-colors placeholder:text-secondary/45 focus:border-primary focus:ring-2 focus:ring-primary/20 read-only:cursor-not-allowed read-only:border-border read-only:bg-muted read-only:text-secondary/75 aria-invalid:border-destructive/70 aria-invalid:focus:ring-destructive/15'
const textAreaClassName =
  'min-h-32 w-full rounded-[24px] border border-primary/45 bg-background px-4 py-3 text-sm text-secondary outline-hidden transition-colors placeholder:text-secondary/45 focus:border-primary focus:ring-2 focus:ring-primary/20 aria-invalid:border-destructive/70 aria-invalid:focus:ring-destructive/15'

const isAutofilled = (element: Element): boolean => {
  for (const selector of [':autofill', ':-webkit-autofill']) {
    try {
      if (element.matches(selector)) return true
    } catch {
      // An engine can support only one of the standard and prefixed selectors.
    }
  }
  return false
}

export function ClinicProfileInquiry({
  sectionId,
  sectionRef,
  fields,
  inquiryCreation,
  isPhoneLocked,
  requiresReauthentication,
  submittedInquiryHref,
  preparationRegistrationHref,
  selectedDoctorId,
  selectedTreatmentId,
  doctors,
  treatments,
  message,
  messageTone,
  selectionError,
  isSubmitting,
  isSubmitted,
  feedbackRef,
  onFieldChange,
  onDoctorChange,
  onTreatmentChange,
  onSubmit,
}: ClinicProfileInquiryProps) {
  const headingId = `${sectionId}-heading`
  const feedbackId = `${sectionId}-feedback`
  const selectionInstructionId = `${sectionId}-selection-instruction`
  const doctorHasError = selectionError === 'selection' || selectionError === 'doctor'
  const treatmentHasError = selectionError === 'selection' || selectionError === 'treatment'
  const doctorDescribedBy = doctorHasError ? `${selectionInstructionId} ${feedbackId}` : selectionInstructionId
  const treatmentDescribedBy = treatmentHasError ? `${selectionInstructionId} ${feedbackId}` : selectionInstructionId
  const identityLocked = inquiryCreation.kind === 'authenticated'
  const formBlocked = requiresReauthentication || inquiryCreation.kind === 'reauthentication-required'
  const doctorSelectRef = React.useRef<HTMLButtonElement | null>(null)
  const treatmentSelectRef = React.useRef<HTMLButtonElement | null>(null)
  const formValidation = usePublicFormValidation({
    messages: {
      accountAuthorization: { valueMissing: 'Authorize account creation and this inquiry submission.' },
      consent: { valueMissing: 'Confirm that we may process your contact details.' },
      email: {
        typeMismatch: 'Enter a valid email address.',
        valueMissing: 'Enter your email address.',
      },
      firstName: { valueMissing: 'Enter your first name.' },
      lastName: { valueMissing: 'Enter your last name.' },
      message: { valueMissing: 'Enter a message.' },
      phoneNumber: { valueMissing: 'Enter your phone number.' },
    },
  })

  React.useEffect(() => {
    if (!message) return

    window.requestAnimationFrame(() => {
      const target =
        messageTone === 'error' && (selectionError === 'selection' || selectionError === 'doctor')
          ? doctorSelectRef.current || treatmentSelectRef.current
          : messageTone === 'error' && selectionError === 'treatment'
            ? treatmentSelectRef.current
            : feedbackRef.current

      if (!target) return

      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target.focus({ preventScroll: true })
    })
  }, [feedbackRef, message, messageTone, selectionError])

  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!formValidation.validateForm(event.currentTarget)) return

      onSubmit(event)
      formValidation.clearAllFieldErrors()
    },
    [formValidation, onSubmit],
  )

  const handleFieldChange = React.useCallback(
    (
      field: keyof ContactFormFields,
      event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => {
      formValidation.handleFieldChange(event)
      const nativeEvent = event.nativeEvent
      const isUserEdit =
        event.target instanceof HTMLSelectElement ||
        (nativeEvent instanceof InputEvent &&
          Boolean(nativeEvent.inputType) &&
          !isAutofilled(event.target) &&
          (nativeEvent.inputType !== 'insertReplacementText' ||
            // Accepted spelling/writing suggestions replace text in the active field.
            // Native autofill can use the same inputType, with no replacement data.
            (event.target === document.activeElement && nativeEvent.data !== null)))
      onFieldChange(field, event.target.value, isUserEdit)
    },
    [formValidation, onFieldChange],
  )

  const handleConsentChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      formValidation.handleFieldChange(event)
      onFieldChange('consentAccepted', event.target.checked)
    },
    [formValidation, onFieldChange],
  )

  return (
    <section id={sectionId} ref={sectionRef} className="text-left" tabIndex={-1} aria-labelledby={headingId}>
      <div className="max-w-[800px] space-y-6 lg:space-y-8">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Start a conversation</p>
          <Heading
            id={headingId}
            as="h2"
            align="left"
            size="h2"
            className="text-3xl leading-tight text-secondary sm:text-4xl"
          >
            Contact the clinic
          </Heading>
        </div>

        <p className="text-muted-foreground">
          Tell us what you have in mind. The clinic can help you understand your options and plan the next step.
        </p>

        <form
          className="space-y-5 text-left [&_label]:text-left"
          onSubmit={handleSubmit}
          onInvalid={formValidation.handleInvalid}
          aria-busy={isSubmitting}
          aria-label="Clinic appointment request"
          noValidate
        >
          {formBlocked ? (
            <Alert ref={feedbackRef} variant="error" role="alert" className="text-left" tabIndex={-1}>
              <p>Your session has ended. Sign in again before sending this request.</p>
              {inquiryCreation.kind !== 'guest' ? (
                <UiLink
                  href={inquiryCreation.loginHref}
                  label="Sign in again"
                  appearance="inline"
                  className="mt-2 inline-flex"
                />
              ) : null}
            </Alert>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            {treatments.length ? (
              <Field>
                <Label htmlFor={`${sectionId}-treatment`} className="text-sm font-medium text-secondary">
                  Treatment
                </Label>
                <ClinicInquiryPicker
                  ref={treatmentSelectRef}
                  id={`${sectionId}-treatment`}
                  label="Treatment"
                  options={treatments.map((item) => ({
                    id: item.id,
                    name: item.name,
                    keywords: item.category ? [item.category] : [],
                  }))}
                  value={selectedTreatmentId}
                  onChange={onTreatmentChange}
                  invalid={treatmentHasError}
                  describedBy={treatmentDescribedBy}
                />
                {selectedTreatmentId ? (
                  <Button
                    type="button"
                    variant="link"
                    className="min-h-11 self-start p-0"
                    onClick={() => onTreatmentChange('')}
                  >
                    Clear treatment
                  </Button>
                ) : null}
              </Field>
            ) : null}
            {doctors.length ? (
              <Field>
                <Label htmlFor={`${sectionId}-doctor`} className="text-sm font-medium text-secondary">
                  Doctor
                </Label>
                <ClinicInquiryPicker
                  ref={doctorSelectRef}
                  id={`${sectionId}-doctor`}
                  label="Doctor"
                  options={doctors.map((item) => ({
                    id: item.id,
                    name: item.name,
                    keywords: [
                      ...(item.specialty === 'General Practice' ? [] : [item.specialty]),
                      ...(item.languages || []),
                    ],
                  }))}
                  value={selectedDoctorId}
                  onChange={onDoctorChange}
                  invalid={doctorHasError}
                  describedBy={doctorDescribedBy}
                />
                {selectedDoctorId ? (
                  <Button
                    type="button"
                    variant="link"
                    className="min-h-11 self-start p-0"
                    onClick={() => onDoctorChange('')}
                  >
                    No doctor preference
                  </Button>
                ) : null}
              </Field>
            ) : null}
            <p id={selectionInstructionId} className="text-sm text-muted-foreground md:col-span-2">
              Select at least one doctor or treatment before submitting the request.
            </p>
          </div>

          <Field data-invalid={formValidation.getFieldError('message') ? true : undefined}>
            <Label htmlFor={`${sectionId}-message`} className="text-sm font-medium text-secondary">
              Message
            </Label>
            <Textarea
              id={`${sectionId}-message`}
              name="message"
              className={textAreaClassName}
              placeholder="Tell us about your request and what you want to clarify."
              value={fields.note}
              onChange={(event) => handleFieldChange('note', event)}
              maxLength={3000}
              required
              {...formValidation.getFieldProps('message')}
            />
            <FieldError id={formValidation.getFieldErrorId('message')}>
              {formValidation.getFieldError('message')}
            </FieldError>
          </Field>

          {identityLocked ? (
            <p className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-6 text-secondary">
              Your account details are used for this request and cannot be changed here.
            </p>
          ) : null}

          {identityLocked ? (
            <div
              aria-label="Patient account details"
              className="grid gap-4 rounded-2xl border border-border bg-muted/35 p-4 md:grid-cols-2"
              role="group"
            >
              {[
                ['First name', fields.firstName],
                ['Last name', fields.lastName],
                ['Email', fields.email],
                ...(isPhoneLocked ? [['Phone number', fields.phoneNumber]] : []),
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
                  <p className="mt-1 text-sm font-medium break-words text-secondary">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-5 md:grid-cols-2">
                <Field data-invalid={formValidation.getFieldError('firstName') ? true : undefined}>
                  <Label htmlFor={`${sectionId}-firstName`} className="text-sm font-medium text-secondary">
                    First Name
                  </Label>
                  <Input
                    id={`${sectionId}-firstName`}
                    type="text"
                    name="firstName"
                    autoComplete="given-name"
                    className={inputClassName}
                    value={fields.firstName}
                    onChange={(event) => handleFieldChange('firstName', event)}
                    maxLength={100}
                    disabled={formBlocked}
                    required
                    {...formValidation.getFieldProps('firstName')}
                  />
                  <FieldError id={formValidation.getFieldErrorId('firstName')}>
                    {formValidation.getFieldError('firstName')}
                  </FieldError>
                </Field>
                <Field data-invalid={formValidation.getFieldError('lastName') ? true : undefined}>
                  <Label htmlFor={`${sectionId}-lastName`} className="text-sm font-medium text-secondary">
                    Last Name
                  </Label>
                  <Input
                    id={`${sectionId}-lastName`}
                    type="text"
                    name="lastName"
                    autoComplete="family-name"
                    className={inputClassName}
                    value={fields.lastName}
                    onChange={(event) => handleFieldChange('lastName', event)}
                    maxLength={100}
                    disabled={formBlocked}
                    required
                    {...formValidation.getFieldProps('lastName')}
                  />
                  <FieldError id={formValidation.getFieldErrorId('lastName')}>
                    {formValidation.getFieldError('lastName')}
                  </FieldError>
                </Field>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <Field data-invalid={formValidation.getFieldError('phoneNumber') ? true : undefined}>
                  <Label htmlFor={`${sectionId}-phoneNumber`} className="text-sm font-medium text-secondary">
                    Phone Number
                  </Label>
                  <Input
                    id={`${sectionId}-phoneNumber`}
                    type="tel"
                    name="phoneNumber"
                    autoComplete="tel"
                    className={inputClassName}
                    value={fields.phoneNumber}
                    onChange={(event) => handleFieldChange('phoneNumber', event)}
                    maxLength={80}
                    disabled={formBlocked}
                    required
                    {...formValidation.getFieldProps('phoneNumber')}
                  />
                  <FieldError id={formValidation.getFieldErrorId('phoneNumber')}>
                    {formValidation.getFieldError('phoneNumber')}
                  </FieldError>
                </Field>
                <Field data-invalid={formValidation.getFieldError('email') ? true : undefined}>
                  <Label htmlFor={`${sectionId}-email`} className="text-sm font-medium text-secondary">
                    Email
                  </Label>
                  <Input
                    id={`${sectionId}-email`}
                    type="email"
                    name="email"
                    autoComplete="email"
                    className={inputClassName}
                    value={fields.email}
                    onChange={(event) => handleFieldChange('email', event)}
                    maxLength={254}
                    disabled={formBlocked}
                    required
                    {...formValidation.getFieldProps('email')}
                  />
                  <FieldError id={formValidation.getFieldErrorId('email')}>
                    {formValidation.getFieldError('email')}
                  </FieldError>
                </Field>
              </div>
            </>
          )}

          {identityLocked && !isPhoneLocked ? (
            <Field data-invalid={formValidation.getFieldError('phoneNumber') ? true : undefined}>
              <Label htmlFor={`${sectionId}-phoneNumber`} className="text-sm font-medium text-secondary">
                Phone Number
              </Label>
              <Input
                id={`${sectionId}-phoneNumber`}
                type="tel"
                name="phoneNumber"
                autoComplete="tel"
                className={inputClassName}
                value={fields.phoneNumber}
                onChange={(event) => handleFieldChange('phoneNumber', event)}
                maxLength={80}
                disabled={formBlocked}
                required
                {...formValidation.getFieldProps('phoneNumber', `${sectionId}-phoneNumber-help`)}
              />
              <p id={`${sectionId}-phoneNumber-help`} className="text-sm leading-6 text-secondary/75">
                Add your phone number once. It will be saved to your patient account before this request is created.
              </p>
              <FieldError id={formValidation.getFieldErrorId('phoneNumber')}>
                {formValidation.getFieldError('phoneNumber')}
              </FieldError>
            </Field>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            <Field>
              <Label htmlFor={`${sectionId}-treatmentTimeline`} className="text-sm font-medium text-secondary">
                How Soon Are You Considering Treatment?
              </Label>
              <select
                id={`${sectionId}-treatmentTimeline`}
                name="treatmentTimeline"
                className={inputClassName}
                value={fields.treatmentTimeline}
                onChange={(event) => handleFieldChange('treatmentTimeline', event)}
              >
                <option value="">Select timeline</option>
                {inquiryTreatmentTimelineOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field>
              <Label htmlFor={`${sectionId}-preferredContactWindow`} className="text-sm font-medium text-secondary">
                When Should We Contact You?
              </Label>
              <select
                id={`${sectionId}-preferredContactWindow`}
                name="preferredContactWindow"
                className={inputClassName}
                value={fields.preferredContactWindow}
                onChange={(event) => handleFieldChange('preferredContactWindow', event)}
              >
                <option value="">Select contact window</option>
                {inquiryPreferredContactWindowOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field data-invalid={formValidation.getFieldError('consent') ? true : undefined}>
            <label className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-background px-4 py-3 text-sm leading-6 text-secondary">
              <input
                type="checkbox"
                name="consent"
                className="mt-1 size-4 rounded border-primary/45 text-primary focus:ring-2 focus:ring-primary/20"
                checked={fields.consentAccepted}
                onChange={handleConsentChange}
                required
                {...formValidation.getFieldProps('consent')}
              />
              <span>{INQUIRY_SUBMISSION_CONSENT_TEXT}</span>
            </label>
            <FieldError id={formValidation.getFieldErrorId('consent')}>
              {formValidation.getFieldError('consent')}
            </FieldError>
          </Field>

          {inquiryCreation.kind === 'guest' ? (
            <Field data-invalid={formValidation.getFieldError('accountAuthorization') ? true : undefined}>
              <label className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-background px-4 py-3 text-sm leading-6 text-secondary">
                <input
                  type="checkbox"
                  name="accountAuthorization"
                  className="mt-1 size-4 shrink-0"
                  checked={fields.accountAuthorization ?? false}
                  onChange={(event) => {
                    formValidation.handleFieldChange(event)
                    onFieldChange('accountAuthorization', event.target.checked)
                  }}
                  required
                  {...formValidation.getFieldProps('accountAuthorization')}
                />
                <span>
                  I authorize creation of my patient account and submission of this inquiry after I set my password and
                  confirm my email. The inquiry is saved privately for seven days and is not sent before account
                  completion.
                </span>
              </label>
              <FieldError id={formValidation.getFieldErrorId('accountAuthorization')}>
                {formValidation.getFieldError('accountAuthorization')}
              </FieldError>
            </Field>
          ) : null}

          <Alert
            id={feedbackId}
            ref={formBlocked ? undefined : feedbackRef}
            variant={messageTone === 'error' ? 'error' : 'success'}
            role={messageTone === 'error' ? 'alert' : 'status'}
            tabIndex={message ? -1 : undefined}
            className={message && !formBlocked ? 'text-left break-words' : 'sr-only'}
          >
            {!formBlocked ? (message ?? '') : ''}
            {message && !formBlocked && preparationRegistrationHref ? (
              <UiLink
                href={preparationRegistrationHref}
                label="Continue account creation"
                appearance="inline"
                className="mt-2 inline-flex font-medium text-secondary underline underline-offset-4"
              />
            ) : null}
            {message && !formBlocked && submittedInquiryHref ? (
              <UiLink
                href={submittedInquiryHref}
                label="View in My inquiries"
                appearance="inline"
                className="mt-2 inline-flex"
              />
            ) : null}
          </Alert>

          <Button
            type="submit"
            className="w-full rounded-full px-8 sm:w-auto"
            disabled={formBlocked || isSubmitting || isSubmitted}
          >
            {isSubmitting
              ? inquiryCreation.kind === 'guest'
                ? 'Saving request...'
                : 'Sending Request...'
              : isSubmitted
                ? preparationRegistrationHref
                  ? 'Inquiry saved, not sent'
                  : 'Request sent'
                : inquiryCreation.kind === 'guest'
                  ? 'Save inquiry and create account'
                  : 'Submit Contact Request'}
          </Button>
        </form>
      </div>
    </section>
  )
}
