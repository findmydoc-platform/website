import * as React from 'react'
import { Building2, CircleHelp, Globe2 } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import { cn } from '@/utilities/ui'
import { formContentClassName } from '../constants'
import type {
  ClinicRegistrationFormValues,
  ClinicRegistrationFunnelVariant,
  PublicFormValidationController,
} from '../types'
import { RegistrationField } from '../components/RegistrationField'
import { StepActions } from '../components/StepActions'
import { StepForm } from '../components/StepForm'

export function ClinicDetailsStep({
  formValues,
  headingRef,
  onNext,
  onValueChange,
  validation,
  variant = 'default',
}: {
  formValues: ClinicRegistrationFormValues
  headingRef: React.Ref<HTMLHeadingElement>
  onNext: () => void
  onValueChange: (fieldName: keyof ClinicRegistrationFormValues, value: string) => void
  validation: PublicFormValidationController
  variant?: ClinicRegistrationFunnelVariant
}) {
  const idBase = React.useId()
  const headingId = `${idBase}-details-heading`
  const descriptionId = `${idBase}-details-notice`
  const isLanding = variant === 'landing'

  return (
    <StepForm ariaLabelledBy={headingId} onSubmit={onNext} validation={validation}>
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
          Register your clinic
        </Heading>
        <p className={cn('mt-3 text-base', isLanding ? 'leading-7 text-slate-700' : 'text-card-foreground/70')}>
          Start your international presence.
        </p>

        <div className="mt-8 grid gap-5 sm:mt-10 sm:gap-6 lg:mt-12">
          <RegistrationField
            descriptionId={descriptionId}
            id={`${idBase}-clinic-name`}
            icon={Building2}
            label="Clinic name"
            name="clinicName"
            onValueChange={(value) => onValueChange('clinicName', value)}
            placeholder="e.g. Charité University Medicine"
            required
            validation={validation}
            value={formValues.clinicName}
            variant={variant}
          />
          <RegistrationField
            descriptionId={descriptionId}
            id={`${idBase}-clinic-website`}
            icon={Globe2}
            label="Website"
            name="clinicWebsite"
            onValueChange={(value) => onValueChange('clinicWebsite', value)}
            placeholder="https://www.your-clinic.com"
            required
            type="url"
            validation={validation}
            value={formValues.clinicWebsite}
            variant={variant}
          />
          <div
            className={cn(
              'grid grid-cols-[20px_minmax(0,1fr)] gap-3 border px-4 py-4 text-xs leading-4',
              isLanding
                ? 'rounded-2xl border-accent/30 bg-accent/15 text-accent-foreground'
                : 'rounded-[8px] border-primary/15 bg-primary/10 text-card-foreground/80',
            )}
            id={descriptionId}
          >
            <CircleHelp
              aria-hidden="true"
              className={cn('mt-0.5 size-4', isLanding ? 'text-secondary/75' : 'text-primary')}
            />
            <p>This information is used for the initial validation of your location.</p>
          </div>
        </div>
      </div>
      <StepActions primaryLabel="Continue" primaryType="submit" variant={variant} />
    </StepForm>
  )
}
