'use client'

import * as React from 'react'

import { usePublicFormValidation } from '@/components/molecules/PublicFormValidation/usePublicFormValidation'
import { StepIndicator } from '@/components/molecules/StepIndicator'
import { cn } from '@/utilities/ui'
import {
  defaultFormValues,
  defaultReviewSummary,
  defaultSelectedTreatmentCategoryIds,
  defaultTreatmentCategories,
  stepStatusLabels,
  totalSteps,
} from './constants'
import { categoryIconMap } from './icons'
import { ContactStep } from './steps/ContactStep'
import { ClinicDetailsStep } from './steps/ClinicDetailsStep'
import { ReviewConfirmationStep } from './steps/ReviewConfirmationStep'
import { TreatmentCategoriesStep } from './steps/TreatmentCategoriesStep'
import type {
  ClinicRegistrationFormValues,
  ClinicRegistrationFunnelProps,
  ClinicRegistrationReviewSummary,
  ClinicRegistrationStep,
  ResolvedTreatmentCategory,
  StepTransitionDirection,
} from './types'
import { validationMessages } from './validation'
import { getStepTransitionClassName, StepContentFrame } from './components/StepContentFrame'
import { StepContextPanel } from './components/StepContextPanel'
import { SplitStepShell } from './components/SplitStepShell'

export function ClinicRegistrationFunnel({
  className,
  initialSelectedTreatmentCategoryIds = defaultSelectedTreatmentCategoryIds,
  initialStep = 1,
  initialValues,
  reviewSummary = defaultReviewSummary,
  treatmentCategories = defaultTreatmentCategories,
}: ClinicRegistrationFunnelProps) {
  const [step, setStep] = React.useState<ClinicRegistrationStep>(initialStep)
  const [stepTransitionDirection, setStepTransitionDirection] = React.useState<StepTransitionDirection>('none')
  const [formValues, setFormValues] = React.useState<ClinicRegistrationFormValues>({
    ...defaultFormValues,
    ...initialValues,
  })
  const [selectedTreatmentCategories, setSelectedTreatmentCategories] = React.useState<string[]>(
    initialSelectedTreatmentCategoryIds,
  )
  const [isHydrated, setIsHydrated] = React.useState(false)
  const publicFormValidation = usePublicFormValidation({ messages: validationMessages })
  const stepHeadingRef = React.useRef<HTMLHeadingElement>(null)
  const didMountRef = React.useRef(false)

  const resolvedTreatmentCategories = React.useMemo<ResolvedTreatmentCategory[]>(
    () =>
      treatmentCategories.map((category) => ({
        ...category,
        icon: categoryIconMap[category.iconKey],
      })),
    [treatmentCategories],
  )

  const selectedCategoryLabels = resolvedTreatmentCategories
    .filter((category) => selectedTreatmentCategories.includes(category.id))
    .map((category) => category.label)

  const resolvedReviewSummary = React.useMemo<ClinicRegistrationReviewSummary>(
    () => ({
      ...reviewSummary,
      clinicName: formValues.clinicName.trim() || reviewSummary.clinicName,
      clinicWebsite: formValues.clinicWebsite.trim() || reviewSummary.clinicWebsite || reviewSummary.clinicAddress,
      contactEmail: formValues.contactEmail.trim() || reviewSummary.contactEmail,
      contactName: formValues.contactName.trim() || reviewSummary.contactName,
      contactRole: formValues.contactRole || reviewSummary.contactRole,
    }),
    [formValues, reviewSummary],
  )

  const transitionClassName = getStepTransitionClassName(stepTransitionDirection)

  const goToNextStep = () => {
    publicFormValidation.clearAllFieldErrors()
    setStepTransitionDirection('forward')
    setStep((currentStep) => (currentStep === 4 ? 4 : ((currentStep + 1) as ClinicRegistrationStep)))
  }

  const goToPreviousStep = () => {
    publicFormValidation.clearAllFieldErrors()
    setStepTransitionDirection('backward')
    setStep((currentStep) => (currentStep === 1 ? 1 : ((currentStep - 1) as ClinicRegistrationStep)))
  }

  const updateFormValue = (fieldName: keyof ClinicRegistrationFormValues, value: string) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [fieldName]: value,
    }))
  }

  const toggleTreatmentCategory = (categoryId: string) => {
    publicFormValidation.clearFieldError('treatmentCategories')
    setSelectedTreatmentCategories((currentSelection) =>
      currentSelection.includes(categoryId)
        ? currentSelection.filter((selectedId) => selectedId !== categoryId)
        : [...currentSelection, categoryId],
    )
  }

  React.useEffect(() => {
    setIsHydrated(true)
  }, [])

  React.useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }

    stepHeadingRef.current?.focus()
  }, [step])

  return (
    <section
      aria-label="Klinikregistrierung"
      className={cn('w-full text-card-foreground', className)}
      data-clinic-registration-funnel-ready={isHydrated ? 'true' : undefined}
      lang="de"
    >
      <SplitStepShell
        contextPanel={
          <StepContextPanel
            key={step}
            reviewSummary={resolvedReviewSummary}
            selectedCategoryLabels={selectedCategoryLabels}
            step={step}
            transitionClassName={transitionClassName}
          />
        }
        progress={
          <StepIndicator
            ariaLabel={`Klinikregistrierung, Schritt ${step} von ${totalSteps}, ${stepStatusLabels[step]}`}
            currentStep={step}
            statusLabel={stepStatusLabels[step]}
            stepLabel={`Schritt ${step} von ${totalSteps}`}
            totalSteps={totalSteps}
          />
        }
      >
        <StepContentFrame className={transitionClassName} key={step}>
          {step === 1 ? (
            <ClinicDetailsStep
              formValues={formValues}
              headingRef={stepHeadingRef}
              onNext={goToNextStep}
              onValueChange={updateFormValue}
              validation={publicFormValidation}
            />
          ) : null}
          {step === 2 ? (
            <TreatmentCategoriesStep
              headingRef={stepHeadingRef}
              onBack={goToPreviousStep}
              onNext={goToNextStep}
              onToggleCategory={toggleTreatmentCategory}
              treatmentCategories={resolvedTreatmentCategories}
              selectedCategories={selectedTreatmentCategories}
              validation={publicFormValidation}
            />
          ) : null}
          {step === 3 ? (
            <ContactStep
              formValues={formValues}
              headingRef={stepHeadingRef}
              onBack={goToPreviousStep}
              onNext={goToNextStep}
              onValueChange={updateFormValue}
              validation={publicFormValidation}
            />
          ) : null}
          {step === 4 ? <ReviewConfirmationStep headingRef={stepHeadingRef} /> : null}
        </StepContentFrame>
      </SplitStepShell>
    </section>
  )
}
