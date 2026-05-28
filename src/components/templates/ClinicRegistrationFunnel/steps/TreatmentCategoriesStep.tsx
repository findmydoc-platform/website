import * as React from 'react'

import { Field, FieldError } from '@/components/atoms/field'
import { Heading } from '@/components/atoms/Heading'
import { formContentClassName } from '../constants'
import type { PublicFormValidationController, ResolvedTreatmentCategory } from '../types'
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
}: {
  headingRef: React.Ref<HTMLHeadingElement>
  onBack: () => void
  onNext: () => void
  onToggleCategory: (categoryId: string) => void
  selectedCategories: string[]
  treatmentCategories: ResolvedTreatmentCategory[]
  validation: PublicFormValidationController
}) {
  const idBase = React.useId()
  const headingId = `${idBase}-treatment-categories-heading`
  const descriptionId = `${idBase}-treatment-categories-description`
  const error = validation.getFieldError('treatmentCategories')
  const errorId = validation.getFieldErrorId('treatmentCategories')
  const groupRef = React.useRef<HTMLFieldSetElement>(null)

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
          Schwerpunkte wählen
        </Heading>
        <p className="mt-3 max-w-[590px] text-base leading-relaxed text-card-foreground/70" id={descriptionId}>
          Wählen Sie Ihre Hauptkategorien für die Kliniksuche. Dies hilft uns, die passenden Ergebnisse für Sie zu
          priorisieren.
        </p>

        <Field className="mt-12 min-w-0 gap-3" data-invalid={error ? true : undefined}>
          <fieldset
            aria-describedby={[descriptionId, error ? errorId : undefined].filter(Boolean).join(' ')}
            aria-invalid={error ? true : undefined}
            className="min-w-0 border-0 p-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-hidden"
            data-field-name="treatmentCategories"
            ref={groupRef}
            tabIndex={-1}
          >
            <legend className="sr-only">Behandlungskategorien auswählen</legend>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {treatmentCategories.map((category) => (
                <TreatmentCategoryOptionCard
                  category={category}
                  isSelected={selectedCategories.includes(category.id)}
                  key={category.id}
                  onToggle={onToggleCategory}
                />
              ))}
            </div>
          </fieldset>
          <FieldError id={errorId}>{error}</FieldError>
        </Field>
      </div>
      <StepActions onBack={onBack} primaryLabel="Weiter" primaryType="submit" />
    </StepForm>
  )
}
