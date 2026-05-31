import * as React from 'react'

import { Field, FieldError } from '@/components/atoms/field'
import { Heading } from '@/components/atoms/Heading'
import { cn } from '@/utilities/ui'
import { formContentClassName } from '../constants'
import type {
  ClinicRegistrationFunnelVariant,
  PublicFormValidationController,
  ResolvedTreatmentCategory,
} from '../types'
import { treatmentCategoriesRequiredMessage } from '../validation'
import { StepActions } from '../components/StepActions'
import { StepForm } from '../components/StepForm'
import { TreatmentCategoryOptionCard } from '../components/TreatmentCategoryOptionCard'

export function TreatmentCategoriesStep({
  headingRef,
  onBack,
  onNext,
  onToggleCategory,
  selectedCategories,
  treatmentCategories,
  validation,
  variant = 'default',
}: {
  headingRef: React.Ref<HTMLHeadingElement>
  onBack: () => void
  onNext: () => void
  onToggleCategory: (categoryId: string) => void
  selectedCategories: string[]
  treatmentCategories: ResolvedTreatmentCategory[]
  validation: PublicFormValidationController
  variant?: ClinicRegistrationFunnelVariant
}) {
  const idBase = React.useId()
  const headingId = `${idBase}-treatment-categories-heading`
  const descriptionId = `${idBase}-treatment-categories-description`
  const error = validation.getFieldError('treatmentCategories')
  const errorId = validation.getFieldErrorId('treatmentCategories')
  const groupRef = React.useRef<HTMLFieldSetElement>(null)
  const isLanding = variant === 'landing'

  return (
    <StepForm
      ariaLabelledBy={headingId}
      onSubmit={() => {
        if (selectedCategories.length === 0) {
          validation.setCustomFieldError('treatmentCategories', treatmentCategoriesRequiredMessage)
          groupRef.current?.focus()
          return
        }

        onNext()
      }}
      validation={validation}
    >
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
          Choose focus areas
        </Heading>
        <p
          className={cn(
            'mt-3 max-w-[590px] text-base leading-relaxed',
            isLanding ? 'text-slate-700' : 'text-card-foreground/70',
          )}
          id={descriptionId}
        >
          Choose the main categories for clinic search. This helps us prioritize the right results for you.
        </p>

        <Field className="mt-8 min-w-0 gap-3 sm:mt-10 lg:mt-12" data-invalid={error ? true : undefined}>
          <fieldset
            aria-describedby={[descriptionId, error ? errorId : undefined].filter(Boolean).join(' ')}
            aria-invalid={error ? true : undefined}
            className={cn(
              'min-w-0 border-0 p-0 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden',
              isLanding ? 'focus-visible:ring-[#0d6b59]/70' : 'focus-visible:ring-primary',
            )}
            data-field-name="treatmentCategories"
            ref={groupRef}
            tabIndex={-1}
          >
            <legend className="sr-only">Select treatment categories</legend>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {treatmentCategories.map((category) => (
                <TreatmentCategoryOptionCard
                  category={category}
                  isSelected={selectedCategories.includes(category.id)}
                  key={category.id}
                  onToggle={onToggleCategory}
                  variant={variant}
                />
              ))}
            </div>
          </fieldset>
          <FieldError id={errorId}>{error}</FieldError>
        </Field>
      </div>
      <StepActions onBack={onBack} primaryLabel="Continue" primaryType="submit" variant={variant} />
    </StepForm>
  )
}
