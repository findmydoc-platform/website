'use client'

import * as React from 'react'

import { Alert, AlertDescription } from '@/components/atoms/alert'
import { usePublicFormValidation } from '@/components/molecules/PublicFormValidation/usePublicFormValidation'
import { StepIndicator } from '@/components/molecules/StepIndicator'
import { cn } from '@/utilities/ui'
import {
  defaultFormValues,
  defaultReviewSummary,
  defaultSelectedTreatmentCategoryIds,
  defaultTreatmentCategories,
} from './constants'
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
  StepTransitionDirection,
} from './types'
import { getStepTransitionClassName, StepContentFrame } from './components/StepContentFrame'
import { StepContextPanel } from './components/StepContextPanel'
import { SplitStepShell } from './components/SplitStepShell'

function focusFieldByName(fieldName: string) {
  const escapedName = globalThis.CSS?.escape?.(fieldName) ?? fieldName.replaceAll('"', '\\"')
  const control = document.querySelector<HTMLElement>(`[name="${escapedName}"], [data-field-name="${escapedName}"]`)
  control?.focus()
}

export function ClinicRegistrationFunnel({
  className,
  copy,
  locale,
  initialSelectedTreatmentCategoryIds,
  initialStep = 1,
  initialValues,
  onSubmit,
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
  const publicFormValidation = usePublicFormValidation({
    messages: copy.validation,
  })
  const stepHeadingRef = React.useRef<HTMLHeadingElement>(null)
  const previousStepRef = React.useRef(step)

  const selectedCategoryLabels = treatmentCategories
    .filter((category) => selectedTreatmentCategories.includes(category.id))
    .map((category) => category.label)

  const contactName = [formValues.contactFirstName, formValues.contactLastName]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ')
  const { roleLabels } = copy.contact
  const contactRole = roleLabels[formValues.contactRole as keyof typeof roleLabels] ?? formValues.contactRole
  const resolvedReviewSummary: ClinicRegistrationReviewSummary = {
    ...reviewSummary,
    clinicName: formValues.clinicName.trim() || reviewSummary.clinicName,
    clinicWebsite: formValues.clinicWebsite.trim() || reviewSummary.clinicWebsite || reviewSummary.clinicAddress,
    contactEmail: formValues.contactEmail.trim() || reviewSummary.contactEmail,
    contactName: contactName || reviewSummary.contactName,
    contactRole: contactRole || reviewSummary.contactRole,
  }

  const transitionClassName = getStepTransitionClassName(stepTransitionDirection)

  function moveToStepWithFieldError({
    fieldName,
    message,
    step: targetStep,
  }: (typeof copy.fieldErrors)[keyof typeof copy.fieldErrors]) {
    publicFormValidation.setCustomFieldErrors({ [fieldName]: message })
    setSubmitError(null)
    setStepTransitionDirection(targetStep < step ? 'backward' : targetStep > step ? 'forward' : 'none')
    setStep(targetStep)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => focusFieldByName(fieldName))
    })
  }

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
      publicFormValidation.setCustomFieldError('treatmentCategories', copy.specialties.required)
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
      const failure = await onSubmit(payload)
      if (failure === 'failed') {
        setSubmitError(copy.failure)
      } else if (failure) {
        moveToStepWithFieldError(copy.fieldErrors[failure])
      } else {
        goToNextStep()
      }
    } catch {
      setSubmitError(copy.failure)
    } finally {
      setIsSubmitting(false)
    }
  }

  React.useEffect(() => {
    setIsHydrated(true)
  }, [])

  React.useEffect(() => {
    if (previousStepRef.current === step) {
      return
    }

    previousStepRef.current = step
    stepHeadingRef.current?.focus()
  }, [step])

  if (treatmentCategories.length === 0) {
    return (
      <section
        aria-label={copy.title}
        className={cn('w-full text-card-foreground', className)}
        data-clinic-registration-funnel-ready={isHydrated ? 'true' : undefined}
        data-variant={variant}
        lang={locale}
      >
        <div className="mx-auto w-full max-w-[720px]">
          <Alert variant="warning">
            <AlertDescription>{copy.unavailable}</AlertDescription>
          </Alert>
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label={copy.title}
      className={cn('w-full text-card-foreground', className)}
      data-clinic-registration-funnel-ready={isHydrated ? 'true' : undefined}
      data-variant={variant}
      lang={locale}
    >
      <SplitStepShell
        contextPanel={
          <StepContextPanel
            copy={copy.context}
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
            ariaLabel={`${copy.title}, ${copy.stepLabels[step]}, ${copy.statusLabels[step]}`}
            className={cn(
              '[&>div:first-child_span]:whitespace-normal',
              variant === 'landing' &&
                '[&_[data-state=completed]]:bg-secondary [&_[data-state=current]]:bg-accent [&_[data-state=upcoming]]:bg-slate-200 [&>div:first-child]:text-secondary [&>div:first-child_span:last-child]:text-slate-600',
            )}
            currentStep={step}
            statusLabel={copy.statusLabels[step]}
            stepLabel={copy.stepLabels[step]}
            totalSteps={Object.keys(copy.stepLabels).length}
          />
        }
        variant={variant}
      >
        <StepContentFrame className={transitionClassName} key={step}>
          {step === 1 ? (
            <ClinicDetailsStep
              copy={copy.details}
              nextLabel={copy.continue}
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
              copy={copy.specialties}
              backLabel={copy.back}
              nextLabel={copy.continue}
              headingRef={stepHeadingRef}
              onBack={goToPreviousStep}
              onNext={goToNextStep}
              onToggleCategory={toggleTreatmentCategory}
              treatmentCategories={treatmentCategories}
              selectedCategories={selectedTreatmentCategories}
              validation={publicFormValidation}
              variant={variant}
            />
          ) : null}
          {step === 3 ? (
            <ContactStep
              copy={copy.contact}
              backLabel={copy.back}
              pendingStatus={copy.pendingStatus}
              submitLabel={isSubmitting ? copy.pending : copy.submit}
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
          {step === 4 ? (
            <ReviewConfirmationStep
              description={copy.confirmation}
              headingRef={stepHeadingRef}
              title={copy.statusLabels[4]}
              variant={variant}
            />
          ) : null}
        </StepContentFrame>
      </SplitStepShell>
    </section>
  )
}
