'use client'

import * as React from 'react'

import { submitClinicRegistration } from '@/auth/utilities/clinicRegistrationSubmission'
import { Alert, AlertDescription } from '@/components/atoms/alert'
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
  ClinicRegistrationSubmitData,
  ResolvedTreatmentCategory,
  StepTransitionDirection,
} from './types'
import { treatmentCategoriesRequiredMessage, validationMessages } from './validation'
import { getStepTransitionClassName, StepContentFrame } from './components/StepContentFrame'
import { StepContextPanel } from './components/StepContextPanel'
import { SplitStepShell } from './components/SplitStepShell'

const serverFieldErrorMap: Record<
  string,
  {
    fieldName: string
    message: string
    step: ClinicRegistrationStep
  }
> = {
  'Clinic name is required': {
    fieldName: 'clinicName',
    message: validationMessages.clinicName.valueMissing,
    step: 1,
  },
  'Invalid clinicWebsite': {
    fieldName: 'clinicWebsite',
    message: validationMessages.clinicWebsite.typeMismatch,
    step: 1,
  },
  'Contact name is required': {
    fieldName: 'contactName',
    message: validationMessages.contactName.valueMissing,
    step: 3,
  },
  'Invalid contactEmail': {
    fieldName: 'contactEmail',
    message: validationMessages.contactEmail.typeMismatch,
    step: 3,
  },
  'Invalid contactRole': {
    fieldName: 'contactRole',
    message: validationMessages.contactRole.valueMissing,
    step: 3,
  },
  'Invalid medicalSpecialties': {
    fieldName: 'treatmentCategories',
    message: 'Please select a valid focus area.',
    step: 2,
  },
}

function focusFieldByName(fieldName: string) {
  const escapedName = globalThis.CSS?.escape?.(fieldName) ?? fieldName.replaceAll('"', '\\"')
  const control = document.querySelector<HTMLElement>(`[name="${escapedName}"], [data-field-name="${escapedName}"]`)
  control?.focus()
}

export function ClinicRegistrationFunnel({
  className,
  initialSelectedTreatmentCategoryIds,
  initialStep = 1,
  initialValues,
  onSubmit = submitClinicRegistration,
  reviewSummary = defaultReviewSummary,
  treatmentCategories = defaultTreatmentCategories,
  variant = 'default',
}: ClinicRegistrationFunnelProps) {
  const [step, setStep] = React.useState<ClinicRegistrationStep>(initialStep)
  const [stepTransitionDirection, setStepTransitionDirection] = React.useState<StepTransitionDirection>('none')
  const [formValues, setFormValues] = React.useState<ClinicRegistrationFormValues>({
    ...defaultFormValues,
    ...initialValues,
  })
  const [selectedTreatmentCategories, setSelectedTreatmentCategories] = React.useState<string[]>(() => {
    const availableCategoryIds = new Set(treatmentCategories.map((category) => category.id))
    const requestedIds =
      initialSelectedTreatmentCategoryIds === undefined
        ? defaultSelectedTreatmentCategoryIds
        : initialSelectedTreatmentCategoryIds
    const validRequestedIds = requestedIds.filter((categoryId) => availableCategoryIds.has(categoryId))

    if (initialSelectedTreatmentCategoryIds !== undefined) return validRequestedIds
    if (validRequestedIds.length > 0) return validRequestedIds
    return treatmentCategories[0]?.id ? [treatmentCategories[0].id] : []
  })
  const [isHydrated, setIsHydrated] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const visibleStepStatusLabels = stepStatusLabels
  const publicFormValidation = usePublicFormValidation({
    messages: validationMessages,
  })
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

  const moveToStepWithFieldError = React.useCallback(
    ({ fieldName, message, step: targetStep }: (typeof serverFieldErrorMap)[string]) => {
      publicFormValidation.setCustomFieldErrors({ [fieldName]: message })
      setSubmitError(null)
      setStepTransitionDirection(targetStep < step ? 'backward' : targetStep > step ? 'forward' : 'none')
      setStep(targetStep)
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => focusFieldByName(fieldName))
      })
    },
    [publicFormValidation, step],
  )

  const goToNextStep = () => {
    publicFormValidation.clearAllFieldErrors()
    setSubmitError(null)
    setStepTransitionDirection('forward')
    setStep((currentStep) => (currentStep === 4 ? 4 : ((currentStep + 1) as ClinicRegistrationStep)))
  }

  const goToPreviousStep = () => {
    publicFormValidation.clearAllFieldErrors()
    setSubmitError(null)
    setStepTransitionDirection('backward')
    setStep((currentStep) => (currentStep === 1 ? 1 : ((currentStep - 1) as ClinicRegistrationStep)))
  }

  const updateFormValue = (fieldName: keyof ClinicRegistrationFormValues, value: string) => {
    setSubmitError(null)
    setFormValues((currentValues) => ({
      ...currentValues,
      [fieldName]: value,
    }))
  }

  const toggleTreatmentCategory = (categoryId: string) => {
    publicFormValidation.clearFieldError('treatmentCategories')
    setSubmitError(null)
    setSelectedTreatmentCategories((currentSelection) =>
      currentSelection.includes(categoryId)
        ? currentSelection.filter((selectedId) => selectedId !== categoryId)
        : [...currentSelection, categoryId],
    )
  }

  const submitRegistration = async () => {
    if (selectedTreatmentCategories.length === 0) {
      publicFormValidation.setCustomFieldError('treatmentCategories', treatmentCategoriesRequiredMessage)
      setStepTransitionDirection('backward')
      setStep(2)
      return
    }

    const payload: ClinicRegistrationSubmitData = {
      ...formValues,
      medicalSpecialties: selectedTreatmentCategories,
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await onSubmit(payload)
      goToNextStep()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Clinic registration failed'
      const serverFieldError = serverFieldErrorMap[message]

      if (serverFieldError) {
        moveToStepWithFieldError(serverFieldError)
      } else {
        setSubmitError(message)
      }
    } finally {
      setIsSubmitting(false)
    }
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

  if (resolvedTreatmentCategories.length === 0) {
    return (
      <section
        aria-label="Clinic registration"
        className={cn('w-full text-card-foreground', className)}
        data-clinic-registration-funnel-ready={isHydrated ? 'true' : undefined}
        data-variant={variant}
        lang="en"
      >
        <div className="mx-auto w-full max-w-[720px]">
          <Alert variant="warning">
            <AlertDescription>
              Clinic registration is temporarily unavailable because focus areas are not configured.
            </AlertDescription>
          </Alert>
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label="Clinic registration"
      className={cn('w-full text-card-foreground', className)}
      data-clinic-registration-funnel-ready={isHydrated ? 'true' : undefined}
      data-variant={variant}
      lang="en"
    >
      <SplitStepShell
        contextPanel={
          <StepContextPanel
            key={step}
            reviewSummary={resolvedReviewSummary}
            selectedCategoryLabels={selectedCategoryLabels}
            step={step}
            transitionClassName={transitionClassName}
            variant={variant}
          />
        }
        progress={
          <StepIndicator
            ariaLabel={`Clinic registration, Step ${step} of ${totalSteps}, ${visibleStepStatusLabels[step]}`}
            className={
              variant === 'landing'
                ? '[&_[data-state=completed]]:bg-[#0d6b59] [&_[data-state=current]]:bg-accent [&_[data-state=upcoming]]:bg-slate-200 [&>div:first-child]:text-[#0d6b59] [&>div:first-child_span:last-child]:text-[#37665d]'
                : undefined
            }
            currentStep={step}
            statusLabel={visibleStepStatusLabels[step]}
            stepLabel={`Step ${step} of ${totalSteps}`}
            totalSteps={totalSteps}
          />
        }
        variant={variant}
      >
        <StepContentFrame className={transitionClassName} key={step}>
          {step === 1 ? (
            <ClinicDetailsStep
              formValues={formValues}
              headingRef={stepHeadingRef}
              onNext={goToNextStep}
              onValueChange={updateFormValue}
              validation={publicFormValidation}
              variant={variant}
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
              variant={variant}
            />
          ) : null}
          {step === 3 ? (
            <ContactStep
              formValues={formValues}
              headingRef={stepHeadingRef}
              isSubmitting={isSubmitting}
              onBack={goToPreviousStep}
              onSubmit={submitRegistration}
              onValueChange={updateFormValue}
              submitError={submitError}
              validation={publicFormValidation}
              variant={variant}
            />
          ) : null}
          {step === 4 ? <ReviewConfirmationStep headingRef={stepHeadingRef} variant={variant} /> : null}
        </StepContentFrame>
      </SplitStepShell>
    </section>
  )
}
