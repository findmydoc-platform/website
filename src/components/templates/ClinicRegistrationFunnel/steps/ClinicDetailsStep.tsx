import * as React from 'react'
import { Building2, CircleHelp, Globe2 } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import { formContentClassName } from '../constants'
import type { ClinicRegistrationFormValues, PublicFormValidationController } from '../types'
import { RegistrationField } from '../components/RegistrationField'
import { StepActions } from '../components/StepActions'
import { StepForm } from '../components/StepForm'

export function ClinicDetailsStep({
  formValues,
  headingRef,
  onNext,
  onValueChange,
  validation,
}: {
  formValues: ClinicRegistrationFormValues
  headingRef: React.Ref<HTMLHeadingElement>
  onNext: () => void
  onValueChange: (fieldName: keyof ClinicRegistrationFormValues, value: string) => void
  validation: PublicFormValidationController
}) {
  const idBase = React.useId()
  const headingId = `${idBase}-details-heading`
  const descriptionId = `${idBase}-details-notice`

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
          Klinik registrieren
        </Heading>
        <p className="mt-3 text-base text-card-foreground/70">Starten Sie Ihre internationale Präsenz.</p>

        <div className="mt-12 grid gap-6">
          <RegistrationField
            descriptionId={descriptionId}
            id={`${idBase}-clinic-name`}
            icon={Building2}
            label="Klinikname"
            name="clinicName"
            onValueChange={(value) => onValueChange('clinicName', value)}
            placeholder="z.B. Charité"
            required
            validation={validation}
            value={formValues.clinicName}
          />
          <RegistrationField
            descriptionId={descriptionId}
            id={`${idBase}-clinic-website`}
            icon={Globe2}
            label="Website"
            name="clinicWebsite"
            onValueChange={(value) => onValueChange('clinicWebsite', value)}
            placeholder="https://klinik.de"
            required
            type="url"
            validation={validation}
            value={formValues.clinicWebsite}
          />
          <div
            className="grid grid-cols-[20px_minmax(0,1fr)] gap-3 rounded-[8px] border border-primary/15 bg-primary/10 px-4 py-4 text-xs leading-4 text-card-foreground/80"
            id={descriptionId}
          >
            <CircleHelp aria-hidden="true" className="mt-0.5 size-4 text-primary" />
            <p>Diese Informationen werden zur ersten Validierung Ihres Standortes verwendet.</p>
          </div>
        </div>
      </div>
      <StepActions primaryLabel="Weiter" primaryType="submit" />
    </StepForm>
  )
}
