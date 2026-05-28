'use client'

import * as React from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  Eye,
  Globe2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { Field, FieldError } from '@/components/atoms/field'
import { Heading } from '@/components/atoms/Heading'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { usePublicFormValidation } from '@/components/molecules/PublicFormValidation/usePublicFormValidation'
import { StepIndicator } from '@/components/molecules/StepIndicator'
import { cn } from '@/utilities/ui'

type ClinicRegistrationStep = 1 | 2 | 3 | 4
type StepTransitionDirection = 'backward' | 'forward' | 'none'
type IconComponent = React.ElementType<React.SVGProps<SVGSVGElement>>

export type ClinicRegistrationFunnelProps = {
  className?: string
  initialSelectedTreatmentCategoryIds?: string[]
  initialStep?: ClinicRegistrationStep
  initialValues?: Partial<ClinicRegistrationFormValues>
  reviewSummary?: ClinicRegistrationReviewSummary
  treatmentCategories?: ClinicRegistrationTreatmentCategory[]
}

export type ClinicRegistrationFormValues = {
  clinicName: string
  clinicWebsite: string
  contactEmail: string
  contactName: string
  contactRole: string
}

export type ClinicRegistrationReviewSummary = {
  clinicAddress: string
  clinicWebsite?: string
  clinicName: string
  contactEmail: string
  contactName: string
  contactRole: string
}

export type ClinicRegistrationCategoryIconKey =
  | 'dental'
  | 'dermatology'
  | 'eye-care'
  | 'hair-restoration'
  | 'plastic-surgery'

export type ClinicRegistrationTreatmentCategory = {
  iconKey: ClinicRegistrationCategoryIconKey
  id: string
  label: string
}

type ResolvedTreatmentCategory = ClinicRegistrationTreatmentCategory & {
  icon: IconComponent
}

const totalSteps = 4

const defaultTreatmentCategories: ClinicRegistrationTreatmentCategory[] = [
  { id: 'dental', label: 'Dental', iconKey: 'dental' },
  { id: 'eye-care', label: 'Eye Care', iconKey: 'eye-care' },
  { id: 'hair-restoration', label: 'Hair Restoration', iconKey: 'hair-restoration' },
  { id: 'dermatology', label: 'Dermatology', iconKey: 'dermatology' },
  { id: 'plastic-surgery', label: 'Plastic Surgery', iconKey: 'plastic-surgery' },
]

const categoryIconMap: Record<ClinicRegistrationCategoryIconKey, IconComponent> = {
  dental: ToothIcon,
  dermatology: Sparkles,
  'eye-care': Eye,
  'hair-restoration': HairRestorationIcon,
  'plastic-surgery': PlasticSurgeryIcon,
}

const stepStatusLabels: Record<ClinicRegistrationStep, string> = {
  1: 'Initialisierung',
  2: '50% abgeschlossen',
  3: '75% abgeschlossen',
  4: 'Anfrage übermittelt',
}

const defaultSelectedTreatmentCategoryIds = ['dental']

const defaultReviewSummary: ClinicRegistrationReviewSummary = {
  clinicAddress: 'Hauptstraße 124, 10115 Berlin',
  clinicWebsite: 'https://marien-hospital.de',
  clinicName: 'St. Marien Hospital',
  contactEmail: 'm.musterfrau@marien-hospital.de',
  contactName: 'Dr. Martina Musterfrau',
  contactRole: 'Leitende Oberärztin',
}

const defaultFormValues: ClinicRegistrationFormValues = {
  clinicName: '',
  clinicWebsite: '',
  contactEmail: '',
  contactName: '',
  contactRole: '',
}

const contactRoleOptions = [
  { label: 'Ärztliche Leitung', value: 'Ärztliche Leitung' },
  { label: 'Klinikmanagement', value: 'Klinikmanagement' },
  { label: 'International Office', value: 'International Office' },
]

const validationMessages = {
  clinicName: {
    valueMissing: 'Bitte geben Sie den Kliniknamen ein.',
  },
  clinicWebsite: {
    typeMismatch: 'Bitte geben Sie eine gültige Website-URL ein.',
    valueMissing: 'Bitte geben Sie die Website ein.',
  },
  contactEmail: {
    typeMismatch: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    valueMissing: 'Bitte geben Sie die E-Mail-Adresse ein.',
  },
  contactName: {
    valueMissing: 'Bitte geben Sie den vollständigen Namen ein.',
  },
  contactRole: {
    valueMissing: 'Bitte wählen Sie eine Position aus.',
  },
}

const formContentClassName = 'mx-auto mt-12 w-full max-w-[490px] min-w-0 text-left lg:mt-13'

function ToothIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path
        d="M7.3 3.4c1.1 0 2.1.5 3 1.1.9.6 1.5.6 2.4 0 .9-.6 1.9-1.1 3-1.1 2.4 0 4 1.9 4 4.4 0 1.8-.7 3.6-1.4 5.1-.7 1.7-1.1 3.4-1.4 5.1-.2 1.2-.9 2.6-2.1 2.6-1.1 0-1.4-1.4-1.7-2.9-.3-1.3-.6-2.7-1.1-2.7s-.8 1.4-1.1 2.7c-.3 1.5-.6 2.9-1.7 2.9-1.2 0-1.9-1.4-2.1-2.6-.3-1.7-.7-3.4-1.4-5.1-.7-1.5-1.4-3.3-1.4-5.1 0-2.5 1.6-4.4 4-4.4Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function HairRestorationIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path d="M6 14.4c.3-4.8 2.7-7.2 6-7.2s5.7 2.4 6 7.2" strokeLinecap="round" />
      <path d="M8.3 13.1c.8-1.8 2-2.8 3.7-2.8s2.9 1 3.7 2.8" strokeLinecap="round" />
      <path d="M5.2 15.7c1.5 2.5 3.8 3.8 6.8 3.8s5.3-1.3 6.8-3.8" strokeLinecap="round" />
      <path d="M8.4 5.2c.5 1 .6 1.9.3 2.9" strokeLinecap="round" />
      <path d="M12 4.5c.4 1.1.4 2.1 0 3.2" strokeLinecap="round" />
      <path d="M15.6 5.2c-.5 1-.6 1.9-.3 2.9" strokeLinecap="round" />
    </svg>
  )
}

function PlasticSurgeryIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path d="M8.6 4.5c.9 1.2 2 1.8 3.4 1.8s2.5-.6 3.4-1.8" strokeLinecap="round" />
      <path d="M7 8.6c1.3 1.2 3 1.8 5 1.8s3.7-.6 5-1.8" strokeLinecap="round" />
      <path d="M8.1 19.5c1.2-1.4 1.8-3.3 1.8-5.8" strokeLinecap="round" />
      <path d="M15.9 19.5c-1.2-1.4-1.8-3.3-1.8-5.8" strokeLinecap="round" />
      <path d="M5.5 12.2c1.5.9 3.7 1.4 6.5 1.4s5-.5 6.5-1.4" strokeLinecap="round" />
    </svg>
  )
}

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
      <div className="mx-auto grid w-full max-w-[1184px] min-w-0 overflow-hidden rounded-[8px] border border-slate-300 bg-card shadow-[0_18px_44px_rgba(7,0,76,0.12)] lg:min-h-[828px] lg:grid-cols-[493px_minmax(0,1fr)]">
        <div className="flex min-h-[610px] min-w-0 flex-col bg-card px-6 py-7 sm:px-10 sm:py-10 lg:col-start-2 lg:row-start-1 lg:min-h-0 lg:px-12 lg:py-12">
          <StepIndicator
            ariaLabel={`Klinikregistrierung, Schritt ${step} von ${totalSteps}, ${stepStatusLabels[step]}`}
            currentStep={step}
            statusLabel={stepStatusLabels[step]}
            stepLabel={`Schritt ${step} von ${totalSteps}`}
            totalSteps={totalSteps}
          />
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
        </div>
        <StepContextPanel
          className="lg:col-start-1 lg:row-start-1"
          key={step}
          reviewSummary={resolvedReviewSummary}
          selectedCategoryLabels={selectedCategoryLabels}
          step={step}
          transitionClassName={transitionClassName}
        />
      </div>
    </section>
  )
}

function getStepTransitionClassName(direction: StepTransitionDirection) {
  if (direction === 'forward') {
    return 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 motion-safe:duration-150 motion-reduce:animate-none motion-reduce:transform-none'
  }

  if (direction === 'backward') {
    return 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-2 motion-safe:duration-150 motion-reduce:animate-none motion-reduce:transform-none'
  }

  return ''
}

function StepContentFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex min-w-0 flex-1 flex-col', className)}>{children}</div>
}

function StepForm({
  ariaLabelledBy,
  children,
  onSubmit,
  validation,
}: {
  ariaLabelledBy: string
  children: React.ReactNode
  onSubmit: (form: HTMLFormElement) => void
  validation: ReturnType<typeof usePublicFormValidation>
}) {
  return (
    <form
      aria-labelledby={ariaLabelledBy}
      className="flex min-w-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        if (!validation.validateForm(event.currentTarget)) return

        onSubmit(event.currentTarget)
      }}
      onInvalid={validation.handleInvalid}
      noValidate
    >
      {children}
    </form>
  )
}

function StepContextPanel({
  className,
  reviewSummary,
  selectedCategoryLabels,
  step,
  transitionClassName,
}: {
  className?: string
  reviewSummary: ClinicRegistrationReviewSummary
  selectedCategoryLabels: string[]
  step: ClinicRegistrationStep
  transitionClassName?: string
}) {
  if (step === 4) {
    return (
      <aside
        className={cn(
          'flex min-h-[300px] min-w-0 flex-col bg-secondary px-7 py-8 text-secondary-foreground sm:px-10 sm:py-11 lg:min-h-full lg:px-12 lg:py-12',
          transitionClassName,
          className,
        )}
        key={step}
      >
        <Heading
          align="left"
          as="h2"
          className="text-[22px] leading-tight break-words text-white sm:text-[26px]"
          size="h4"
        >
          Überprüfung
        </Heading>
        <p className="mt-4 max-w-[330px] text-[17px] leading-relaxed text-white/85">
          Zusammenfassung Ihrer Angaben vor dem Abschluss.
        </p>
        <ReviewSummary reviewSummary={reviewSummary} selectedCategoryLabels={selectedCategoryLabels} />
      </aside>
    )
  }

  if (step === 3) {
    return (
      <aside
        className={cn(
          'flex min-h-[320px] min-w-0 flex-col justify-center bg-secondary px-7 py-8 text-secondary-foreground sm:px-10 sm:py-11 lg:min-h-full lg:px-12 lg:py-12',
          transitionClassName,
          className,
        )}
        key={step}
      >
        <Heading
          align="left"
          as="h2"
          className="text-[22px] leading-tight break-words text-white sm:text-[26px]"
          size="h4"
        >
          Kontaktinformationen
        </Heading>
        <p className="mt-4 max-w-[360px] text-base leading-relaxed text-white/85">
          Wir melden uns bei der richtigen Kontaktperson, sobald die Registrierung geprüft wurde.
        </p>
        <div className="mt-10 grid gap-7 border-t border-white/15 pt-8 lg:mt-auto">
          <SupportRow icon={Phone} label="Telefon" value="+49 (0) 30 1234 5678" />
          <SupportRow icon={Mail} label="E-Mail" value="support@findmydoc.de" />
          <SupportRow icon={MapPin} label="Zentrale" value="Friedrichstraße 100 10117 Berlin, Deutschland" />
        </div>
      </aside>
    )
  }

  if (step === 2) {
    return (
      <aside
        className={cn(
          'flex min-h-[300px] min-w-0 flex-col justify-center bg-secondary px-7 py-8 text-secondary-foreground sm:px-10 sm:py-11 lg:min-h-full lg:px-12 lg:py-12',
          transitionClassName,
          className,
        )}
        key={step}
      >
        <Heading
          align="left"
          as="h2"
          className="text-[22px] leading-tight break-words text-white sm:text-[26px]"
          size="h4"
        >
          Schwerpunkte der Klinik
        </Heading>
        <p className="mt-4 max-w-[360px] text-base leading-relaxed text-white/90">
          Wählen Sie die Behandlungskategorien, mit denen internationale Patientinnen und Patienten Ihre Klinik finden
          sollen.
        </p>
      </aside>
    )
  }

  return (
    <aside
      className={cn(
        'flex min-h-[310px] min-w-0 flex-col justify-center bg-secondary px-7 py-8 text-secondary-foreground sm:px-10 sm:py-11 lg:min-h-full lg:px-12 lg:py-12',
        transitionClassName,
        className,
      )}
      key={step}
    >
      <Heading
        align="left"
        as="h2"
        className="max-w-[385px] text-[22px] leading-tight break-words text-white sm:text-[26px]"
        size="h4"
      >
        Klinik international sichtbar machen
      </Heading>
      <p className="mt-7 max-w-[388px] text-lg leading-relaxed text-white/90">
        Registrieren Sie Ihre Klinik für die Prüfung und den Aufbau Ihrer Präsenz auf findmydoc.
      </p>
    </aside>
  )
}

function ClinicDetailsStep({
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
  validation: ReturnType<typeof usePublicFormValidation>
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

function TreatmentCategoriesStep({
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
  validation: ReturnType<typeof usePublicFormValidation>
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
          validation.setCustomFieldError('treatmentCategories', 'Bitte wählen Sie mindestens einen Schwerpunkt aus.')
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

function ContactStep({
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
  validation: ReturnType<typeof usePublicFormValidation>
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

function StepActions({
  onBack,
  onNext,
  primaryLabel,
  primaryType = 'button',
}: {
  onBack?: () => void
  onNext?: () => void
  primaryLabel: string
  primaryType?: 'button' | 'submit'
}) {
  if (!onBack) {
    return (
      <div className="mx-auto mt-auto w-full max-w-[490px] pt-12">
        <Button
          className="h-[60px] w-full rounded-[8px] text-[19px] leading-none font-semibold shadow-[0_9px_20px_rgba(0,118,255,0.22)]"
          onClick={primaryType === 'button' ? onNext : undefined}
          type={primaryType}
        >
          {primaryLabel}
          <ArrowRight aria-hidden="true" className="size-5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-auto grid w-full max-w-[490px] gap-4 pt-12 sm:grid-cols-2 sm:items-center">
      <Button
        className="min-h-11 justify-self-start px-0 text-card-foreground/80"
        onClick={onBack}
        type="button"
        variant="ghost"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Zurück
      </Button>
      <Button
        className="h-[60px] w-full min-w-0 rounded-[8px] text-base leading-none font-semibold whitespace-normal shadow-[0_9px_20px_rgba(0,118,255,0.22)] sm:text-[19px]"
        onClick={primaryType === 'button' ? onNext : undefined}
        type={primaryType}
      >
        {primaryLabel}
        <ArrowRight aria-hidden="true" className="size-5" />
      </Button>
    </div>
  )
}

function ReviewConfirmationStep({ headingRef }: { headingRef: React.Ref<HTMLHeadingElement> }) {
  return (
    <div className="mx-auto flex w-full max-w-[490px] flex-1 flex-col items-center justify-center py-12 text-center">
      <div className="grid size-[88px] place-items-center rounded-full bg-accent text-secondary">
        <ShieldCheck aria-hidden="true" className="size-10" />
      </div>
      <Heading
        align="center"
        as="h2"
        className="mt-5 text-[34px] leading-tight text-[#172033]"
        ref={headingRef}
        size="h3"
        tabIndex={-1}
      >
        Anfrage übermittelt
      </Heading>
      <p className="mt-4 max-w-[430px] text-lg leading-relaxed text-card-foreground/70">
        Ihre Anfrage wurde übermittelt. Wir kontaktieren Sie, sobald die Prüfung abgeschlossen ist.
      </p>
    </div>
  )
}

function RegistrationField({
  descriptionId,
  icon: Icon,
  id,
  label,
  name,
  onValueChange,
  placeholder,
  required,
  type = 'text',
  validation,
  value,
}: {
  descriptionId?: string
  icon?: IconComponent
  id: string
  label: string
  name: keyof ClinicRegistrationFormValues
  onValueChange: (value: string) => void
  placeholder: string
  required?: boolean
  type?: React.HTMLInputTypeAttribute
  validation: ReturnType<typeof usePublicFormValidation>
  value: string
}) {
  const error = validation.getFieldError(name)
  const errorId = validation.getFieldErrorId(name)

  return (
    <Field className="min-w-0 gap-2 text-left" data-invalid={error ? true : undefined}>
      <Label className="mb-2 block text-left text-sm font-semibold text-[#172033]" htmlFor={id}>
        {label}
      </Label>
      <div className="relative">
        <Input
          {...validation.getFieldProps(name, descriptionId)}
          className="h-[60px] min-w-0 rounded-[8px] border-slate-300 bg-[#fbfcff] px-3 pr-10 text-base text-slate-500 sm:px-4 sm:pr-12 md:text-base"
          id={id}
          name={name}
          onChange={(event) => {
            validation.handleFieldChange(event)
            onValueChange(event.currentTarget.value)
          }}
          placeholder={placeholder}
          required={required}
          type={type}
          value={value}
        />
        {Icon ? (
          <Icon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400 sm:right-4 sm:size-5"
          />
        ) : null}
      </div>
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  )
}

function TreatmentCategoryOptionCard({
  category,
  isSelected,
  onToggle,
}: {
  category: ResolvedTreatmentCategory
  isSelected: boolean
  onToggle: (categoryId: string) => void
}) {
  const Icon = category.icon

  return (
    <button
      aria-pressed={isSelected}
      className={cn(
        'relative flex h-[100px] min-w-0 flex-col items-center justify-center gap-2 rounded-[8px] border border-slate-300 bg-card px-2 text-sm font-semibold text-[#172033] transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-hidden',
        isSelected && 'border-primary bg-primary/5',
      )}
      onClick={() => onToggle(category.id)}
      type="button"
    >
      {isSelected ? (
        <span className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check aria-hidden="true" className="size-3.5" />
        </span>
      ) : null}
      <Icon aria-hidden="true" className="size-8 text-primary" />
      <span className="max-w-full text-center leading-4 break-words">{category.label}</span>
    </button>
  )
}

function ContactNotice({ id }: { id: string }) {
  return (
    <p
      className="rounded-[8px] border border-primary/15 bg-primary/10 px-4 py-3 text-xs leading-5 break-words text-card-foreground/75"
      id={id}
    >
      Wir nutzen Ihre Angaben, um Sie im berechtigten Interesse zur Klinikregistrierung zu kontaktieren.
    </p>
  )
}

function ReviewSummary({
  reviewSummary,
  selectedCategoryLabels,
}: {
  reviewSummary: ClinicRegistrationReviewSummary
  selectedCategoryLabels: string[]
}) {
  return (
    <div className="mt-12 grid gap-10">
      <SummaryGroup icon={Building2} label="Klinik-Details">
        <strong className="block text-base font-medium [overflow-wrap:anywhere] break-words text-white">
          {reviewSummary.clinicName}
        </strong>
        <span className="block text-xs leading-5 [overflow-wrap:anywhere] break-words text-white/70">
          {reviewSummary.clinicWebsite ?? reviewSummary.clinicAddress}
        </span>
      </SummaryGroup>
      <SummaryGroup icon={BriefcaseBusiness} label="Schwerpunkte">
        <div className="mt-2 flex flex-wrap gap-2">
          {(selectedCategoryLabels.length > 0 ? selectedCategoryLabels : ['Noch nicht ausgewählt']).map((label) => (
            <span className="rounded-full bg-primary/30 px-2.5 py-0.5 text-xs break-words text-white" key={label}>
              {label}
            </span>
          ))}
        </div>
      </SummaryGroup>
      <SummaryGroup icon={UserRound} label="Kontaktperson">
        <strong className="block text-base font-medium [overflow-wrap:anywhere] break-words text-white">
          {reviewSummary.contactName}
        </strong>
        <span className="block text-xs leading-5 [overflow-wrap:anywhere] break-words text-white/70">
          {reviewSummary.contactRole}
          <br />
          {reviewSummary.contactEmail}
        </span>
      </SummaryGroup>
    </div>
  )
}

function SupportRow({ icon: Icon, label, value }: { icon: IconComponent; label?: string; value: string }) {
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 text-white">
      <Icon aria-hidden="true" className="mt-0.5 size-4 text-primary" />
      <div className="min-w-0">
        {label ? (
          <span className="block text-[13px] leading-4 font-medium tracking-[0.08em] text-white/55 uppercase">
            {label}
          </span>
        ) : null}
        <span className="block text-[15px] leading-5 font-normal break-words text-white/85">{value}</span>
      </div>
    </div>
  )
}

function SummaryGroup({
  children,
  icon: Icon,
  label,
}: {
  children: React.ReactNode
  icon: IconComponent
  label: string
}) {
  return (
    <div className="grid min-w-0 grid-cols-[20px_minmax(0,1fr)] items-start gap-3">
      <Icon aria-hidden="true" className="mt-[3px] size-4 text-primary" />
      <div className="min-w-0">
        <span className="block text-[13px] leading-5 font-bold tracking-[0.04em] text-primary uppercase">{label}</span>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  )
}
