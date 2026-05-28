import * as React from 'react'
import { ChevronDown } from 'lucide-react'

import { Field, FieldError } from '@/components/atoms/field'
import { Heading } from '@/components/atoms/Heading'
import { Label } from '@/components/atoms/label'
import { contactRoleOptions, formContentClassName } from '../constants'
import type { ClinicRegistrationFormValues, PublicFormValidationController } from '../types'
import { ContactNotice } from '../components/ContactNotice'
import { RegistrationField } from '../components/RegistrationField'
import { StepActions } from '../components/StepActions'
import { StepForm } from '../components/StepForm'

export function ContactStep({
  formValues,
  headingRef,
  onBack,
  onNext,
  onValueChange,
  validation,
}: {
  formValues: ClinicRegistrationFormValues
  headingRef: React.Ref<HTMLHeadingElement>
  onBack: () => void
  onNext: () => void
  onValueChange: (fieldName: keyof ClinicRegistrationFormValues, value: string) => void
  validation: PublicFormValidationController
}) {
  const idBase = React.useId()
  const headingId = `${idBase}-contact-heading`
  const noticeId = `${idBase}-contact-notice`
  const positionId = `${idBase}-position`
  const positionError = validation.getFieldError('contactRole')
  const positionErrorId = validation.getFieldErrorId('contactRole')

  return (
    <StepForm ariaLabelledBy={headingId} onSubmit={onNext} validation={validation}>
      <div className={formContentClassName}>
        <Heading
          align="left"
          as="h2"
          className="text-[32px] leading-tight text-[#172033]"
          id={headingId}
          ref={headingRef}
          size="h3"
          tabIndex={-1}
        >
          Ihr Kontakt
        </Heading>
        <p className="mt-3 text-base text-card-foreground/70">Wer ist unsere Kontaktperson für die Koordination?</p>

        <div className="mt-12 grid gap-6">
          <RegistrationField
            descriptionId={noticeId}
            id={`${idBase}-contact-name`}
            label="Vollständiger Name"
            name="contactName"
            onValueChange={(value) => onValueChange('contactName', value)}
            placeholder="z.B. Dr. Muster"
            required
            validation={validation}
            value={formValues.contactName}
          />
          <RegistrationField
            descriptionId={noticeId}
            id={`${idBase}-contact-email`}
            label="E-Mail Adresse"
            name="contactEmail"
            onValueChange={(value) => onValueChange('contactEmail', value)}
            placeholder="kontakt@klinik.de"
            required
            type="email"
            validation={validation}
            value={formValues.contactEmail}
          />
          <Field className="min-w-0 gap-2 text-left" data-invalid={positionError ? true : undefined}>
            <Label className="mb-2 block text-left text-sm font-semibold text-[#172033]" htmlFor={positionId}>
              Position / Funktion
            </Label>
            <div className="relative">
              <select
                {...validation.getFieldProps('contactRole', noticeId)}
                className="h-[60px] w-full min-w-0 appearance-none rounded-[8px] border border-slate-300 bg-[#fbfcff] px-3 pr-10 text-left text-base text-slate-500 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-hidden aria-invalid:border-destructive/70 aria-invalid:focus-visible:ring-destructive/20 sm:px-4 sm:pr-12 md:text-base"
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
                  Bitte auswählen
                </option>
                {contactRoleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-500 sm:right-4 sm:size-5"
              />
            </div>
            <FieldError id={positionErrorId}>{positionError}</FieldError>
          </Field>
          <ContactNotice id={noticeId} />
        </div>
      </div>
      <StepActions onBack={onBack} primaryLabel="Anfrage senden" primaryType="submit" />
    </StepForm>
  )
}
