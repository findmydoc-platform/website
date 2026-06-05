import * as React from 'react'
import { ChevronDown, CircleAlert } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/atoms/alert'
import { Field, FieldError } from '@/components/atoms/field'
import { Heading } from '@/components/atoms/Heading'
import { Label } from '@/components/atoms/label'
import { cn } from '@/utilities/ui'
import { contactRoleOptions, formContentClassName } from '../constants'
import type {
  ClinicRegistrationFormValues,
  ClinicRegistrationFunnelVariant,
  PublicFormValidationController,
} from '../types'
import { ContactNotice } from '../components/ContactNotice'
import { RegistrationField } from '../components/RegistrationField'
import { StepActions } from '../components/StepActions'
import { StepForm } from '../components/StepForm'

export function ContactStep({
  formValues,
  headingRef,
  isSubmitting = false,
  onBack,
  onSubmit,
  onValueChange,
  submitError,
  validation,
  variant = 'default',
}: {
  formValues: ClinicRegistrationFormValues
  headingRef: React.Ref<HTMLHeadingElement>
  isSubmitting?: boolean
  onBack: () => void
  onSubmit: () => Promise<void> | void
  onValueChange: (fieldName: keyof ClinicRegistrationFormValues, value: string) => void
  submitError?: string | null
  validation: PublicFormValidationController
  variant?: ClinicRegistrationFunnelVariant
}) {
  const idBase = React.useId()
  const headingId = `${idBase}-contact-heading`
  const noticeId = `${idBase}-contact-notice`
  const positionId = `${idBase}-position`
  const positionError = validation.getFieldError('contactRole')
  const positionErrorId = validation.getFieldErrorId('contactRole')
  const isLanding = variant === 'landing'

  return (
    <StepForm ariaBusy={isSubmitting} ariaLabelledBy={headingId} onSubmit={onSubmit} validation={validation}>
      <div className={cn(formContentClassName, isLanding && 'mt-7 sm:mt-8 lg:mt-9')}>
        <Heading
          align="left"
          as="h2"
          className={cn('text-[32px] leading-tight', isLanding ? 'text-foreground' : 'text-[#172033]')}
          id={headingId}
          ref={headingRef}
          size="h3"
          tabIndex={-1}
        >
          Your contact
        </Heading>
        <p className={cn('mt-3 text-base', isLanding ? 'leading-7 text-slate-700' : 'text-card-foreground/70')}>
          Who should we contact for follow-up questions?
        </p>

        <div className="mt-8 grid gap-5 sm:mt-10 sm:gap-6 lg:mt-12">
          <div className="grid min-w-0 gap-5 sm:grid-cols-2 sm:gap-4">
            <RegistrationField
              descriptionId={noticeId}
              id={`${idBase}-contact-first-name`}
              label="First name"
              name="contactFirstName"
              onValueChange={(value) => onValueChange('contactFirstName', value)}
              placeholder="e.g. Ada"
              required
              validation={validation}
              value={formValues.contactFirstName}
              variant={variant}
            />
            <RegistrationField
              descriptionId={noticeId}
              id={`${idBase}-contact-last-name`}
              label="Last name"
              name="contactLastName"
              onValueChange={(value) => onValueChange('contactLastName', value)}
              placeholder="e.g. Lovelace"
              required
              validation={validation}
              value={formValues.contactLastName}
              variant={variant}
            />
          </div>
          <RegistrationField
            descriptionId={noticeId}
            id={`${idBase}-contact-email`}
            label="Email address"
            name="contactEmail"
            onValueChange={(value) => onValueChange('contactEmail', value)}
            placeholder="name@example-clinic.com"
            required
            type="email"
            validation={validation}
            value={formValues.contactEmail}
            variant={variant}
          />
          <Field className="min-w-0 gap-2 text-left" data-invalid={positionError ? true : undefined}>
            <Label
              className={cn(
                'mb-2 block text-left text-sm font-semibold',
                isLanding ? 'text-foreground' : 'text-[#172033]',
              )}
              htmlFor={positionId}
            >
              Position / role
            </Label>
            <div className="relative">
              <select
                {...validation.getFieldProps('contactRole', noticeId)}
                className={cn(
                  'h-[60px] w-full min-w-0 appearance-none border px-3 pr-10 text-left text-base text-slate-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden aria-invalid:border-destructive/70 aria-invalid:focus-visible:ring-destructive/20 sm:px-4 sm:pr-12 md:text-base',
                  isLanding
                    ? 'rounded-2xl border-slate-200 bg-white/95 focus-visible:border-secondary/40 focus-visible:ring-accent/70'
                    : 'rounded-[8px] border-slate-300 bg-[#fbfcff] focus-visible:ring-primary',
                )}
                id={positionId}
                name="contactRole"
                onChange={(event) => {
                  validation.handleFieldChange(event)
                  onValueChange('contactRole', event.currentTarget.value)
                }}
                required
                value={formValues.contactRole}
              >
                <option disabled value="">
                  Please select
                </option>
                {contactRoleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 sm:right-4 sm:size-5',
                  isLanding ? 'text-secondary/60' : 'text-slate-500',
                )}
              />
            </div>
            {isLanding ? (
              <div className="min-h-4">
                <FieldError id={positionErrorId}>{positionError}</FieldError>
              </div>
            ) : (
              <FieldError id={positionErrorId}>{positionError}</FieldError>
            )}
          </Field>
          <ContactNotice id={noticeId} variant={variant} />
          {submitError ? (
            <Alert className={cn(isLanding && 'rounded-2xl')} variant="error">
              <CircleAlert aria-hidden="true" className="size-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}
          <p aria-live="polite" className="sr-only" role="status">
            {isSubmitting ? 'Submitting your clinic registration.' : ''}
          </p>
        </div>
      </div>
      <StepActions
        disabled={isSubmitting}
        onBack={onBack}
        primaryLabel={isSubmitting ? 'Submitting...' : 'Submit request'}
        primaryType="submit"
        variant={variant}
      />
    </StepForm>
  )
}
