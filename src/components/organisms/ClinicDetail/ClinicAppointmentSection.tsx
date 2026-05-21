import * as React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { Alert } from '@/components/atoms/alert'
import { Button } from '@/components/atoms/button'
import { Media } from '@/components/molecules/Media'

import type { ClinicDetailDoctor, ClinicDetailTreatment } from '@/components/templates/ClinicDetailConcepts/types'

import type { ContactFormFields, ContactFormSelectionError } from './types'

type ClinicAppointmentSectionProps = {
  sectionId: string
  sectionRef: React.RefObject<HTMLElement | null>
  fields: ContactFormFields
  selectedDoctorId: string
  selectedTreatmentId: string
  doctors: ClinicDetailDoctor[]
  treatments: ClinicDetailTreatment[]
  appointmentImage: { src: string; alt: string }
  message: string | null
  messageTone: 'success' | 'error'
  selectionError: ContactFormSelectionError
  isSubmitting: boolean
  feedbackRef: React.RefObject<HTMLDivElement | null>
  onFieldChange: <K extends keyof ContactFormFields>(field: K, value: ContactFormFields[K]) => void
  onDoctorChange: (doctorId: string) => void
  onTreatmentChange: (treatmentId: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

const inputClassName =
  'h-14 w-full rounded-[28px] border border-primary/45 bg-background px-4 text-sm text-secondary outline-hidden transition-colors placeholder:text-secondary/45 focus:border-primary focus:ring-2 focus:ring-primary/20'
const textAreaClassName =
  'min-h-32 w-full rounded-[24px] border border-primary/45 bg-background px-4 py-3 text-sm text-secondary outline-hidden transition-colors placeholder:text-secondary/45 focus:border-primary focus:ring-2 focus:ring-primary/20'

const treatmentTimelineOptions = [
  { label: 'As soon as possible', value: 'as_soon_as_possible' },
  { label: 'Within two weeks', value: 'within_two_weeks' },
  { label: 'Within one month', value: 'within_one_month' },
  { label: 'Flexible', value: 'flexible' },
] as const

const preferredContactWindowOptions = [
  { label: 'As soon as possible', value: 'as_soon_as_possible' },
  { label: 'Morning', value: 'morning' },
  { label: 'Afternoon', value: 'afternoon' },
  { label: 'Evening', value: 'evening' },
  { label: 'No preference', value: 'no_preference' },
] as const

export function ClinicAppointmentSection({
  sectionId,
  sectionRef,
  fields,
  selectedDoctorId,
  selectedTreatmentId,
  doctors,
  treatments,
  appointmentImage,
  message,
  messageTone,
  selectionError,
  isSubmitting,
  feedbackRef,
  onFieldChange,
  onDoctorChange,
  onTreatmentChange,
  onSubmit,
}: ClinicAppointmentSectionProps) {
  const headingId = `${sectionId}-heading`
  const feedbackId = `${sectionId}-feedback`
  const selectionInstructionId = `${sectionId}-selection-instruction`
  const doctorHasError = selectionError === 'selection' || selectionError === 'doctor'
  const treatmentHasError = selectionError === 'selection' || selectionError === 'treatment'
  const doctorDescribedBy = doctorHasError ? `${selectionInstructionId} ${feedbackId}` : selectionInstructionId
  const treatmentDescribedBy = treatmentHasError ? `${selectionInstructionId} ${feedbackId}` : selectionInstructionId
  const doctorSelectRef = React.useRef<HTMLSelectElement | null>(null)
  const treatmentSelectRef = React.useRef<HTMLSelectElement | null>(null)

  React.useEffect(() => {
    if (!message) return

    window.requestAnimationFrame(() => {
      const target =
        messageTone === 'error' && (selectionError === 'selection' || selectionError === 'doctor')
          ? doctorSelectRef.current
          : messageTone === 'error' && selectionError === 'treatment'
            ? treatmentSelectRef.current
            : feedbackRef.current

      if (!target) return

      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target.focus({ preventScroll: true })
    })
  }, [feedbackRef, message, messageTone, selectionError])

  return (
    <section
      id={sectionId}
      ref={sectionRef}
      className="grid gap-8 lg:grid-cols-12 lg:items-start"
      tabIndex={-1}
      aria-labelledby={headingId}
    >
      <div className="space-y-6 lg:col-span-6 lg:space-y-8">
        <div className="space-y-1">
          <p className="text-2xl leading-[1.15] font-semibold text-primary sm:text-size-40">CONTACT THE</p>
          <Heading
            id={headingId}
            as="h2"
            align="left"
            size="h2"
            className="text-5xl leading-tight text-secondary sm:text-size-72 sm:leading-[1.1389]"
          >
            Clinic
          </Heading>
        </div>

        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-sm font-medium text-secondary">Full Name</span>
              <input
                type="text"
                name="fullName"
                autoComplete="name"
                className={inputClassName}
                value={fields.fullName}
                onChange={(event) => onFieldChange('fullName', event.target.value)}
                maxLength={200}
                required
              />
            </label>

            <label className="space-y-2">
              <span className="block text-sm font-medium text-secondary">Phone Number</span>
              <input
                type="tel"
                name="phoneNumber"
                autoComplete="tel"
                className={inputClassName}
                value={fields.phoneNumber}
                onChange={(event) => onFieldChange('phoneNumber', event.target.value)}
                maxLength={80}
                required
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-secondary">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              className={inputClassName}
              value={fields.email}
              onChange={(event) => onFieldChange('email', event.target.value)}
              maxLength={254}
              required
            />
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-sm font-medium text-secondary">How Soon Are You Considering Treatment?</span>
              <select
                name="treatmentTimeline"
                className={inputClassName}
                value={fields.treatmentTimeline}
                onChange={(event) => onFieldChange('treatmentTimeline', event.target.value)}
              >
                <option value="">Select timeline</option>
                {treatmentTimelineOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="block text-sm font-medium text-secondary">When Should We Contact You?</span>
              <select
                name="preferredContactWindow"
                className={inputClassName}
                value={fields.preferredContactWindow}
                onChange={(event) => onFieldChange('preferredContactWindow', event.target.value)}
              >
                <option value="">Select contact window</option>
                {preferredContactWindowOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <p id={selectionInstructionId} className="sr-only">
              Select at least one doctor or treatment before submitting the request.
            </p>
            <label className="space-y-2">
              <span className="block text-sm font-medium text-secondary">Doctor</span>
              <select
                ref={doctorSelectRef}
                name="doctor"
                className={inputClassName}
                value={selectedDoctorId}
                onChange={(event) => onDoctorChange(event.target.value)}
                aria-describedby={doctorDescribedBy}
                aria-errormessage={doctorHasError ? feedbackId : undefined}
                aria-invalid={doctorHasError || undefined}
              >
                <option value="">Select a doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="block text-sm font-medium text-secondary">Treatment</span>
              <select
                ref={treatmentSelectRef}
                name="treatment"
                className={inputClassName}
                value={selectedTreatmentId}
                onChange={(event) => onTreatmentChange(event.target.value)}
                aria-describedby={treatmentDescribedBy}
                aria-errormessage={treatmentHasError ? feedbackId : undefined}
                aria-invalid={treatmentHasError || undefined}
              >
                <option value="">Select a treatment</option>
                {treatments.map((treatment) => (
                  <option key={treatment.id} value={treatment.id}>
                    {treatment.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-secondary">Message</span>
            <textarea
              name="message"
              className={textAreaClassName}
              placeholder="Tell us about your request and what you want to clarify."
              value={fields.note}
              onChange={(event) => onFieldChange('note', event.target.value)}
              maxLength={5000}
              required
            />
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-background px-4 py-3 text-sm leading-6 text-secondary">
            <input
              type="checkbox"
              name="consent"
              className="mt-1 size-4 rounded border-primary/45 text-primary focus:ring-2 focus:ring-primary/20"
              checked={fields.consentAccepted}
              onChange={(event) => onFieldChange('consentAccepted', event.target.checked)}
              required
            />
            <span>
              I agree that findmydoc may process my contact details and request context to coordinate follow-up.
            </span>
          </label>

          <Alert
            id={feedbackId}
            ref={feedbackRef}
            variant={messageTone === 'error' ? 'error' : 'success'}
            role={messageTone === 'error' ? 'alert' : 'status'}
            tabIndex={message ? -1 : undefined}
            className={message ? 'text-left break-words' : 'sr-only'}
          >
            {message ?? ''}
          </Alert>

          <Button type="submit" className="w-full rounded-full px-8 sm:w-auto" disabled={isSubmitting}>
            {isSubmitting ? 'Sending Request...' : 'Submit Contact Request'}
          </Button>
        </form>
      </div>

      <div className="relative lg:col-span-6 lg:pt-24">
        <div
          className="absolute inset-x-0 top-6 h-[220px] rounded-[140px] bg-accent/20 sm:top-10 sm:h-[360px] sm:rounded-[180px]"
          aria-hidden="true"
        />
        <div
          className="absolute right-0 bottom-[-32px] size-[180px] rounded-full bg-primary/20 sm:-right-6 sm:bottom-[-48px] sm:size-[260px]"
          aria-hidden="true"
        />

        <div className="relative mx-auto aspect-[16/11] w-full max-w-[599px] overflow-hidden rounded-[30px] sm:aspect-[599/745]">
          <Media
            htmlElement={null}
            src={appointmentImage.src}
            alt={appointmentImage.alt}
            fill
            imgClassName="object-cover"
            size="(min-width: 1024px) 599px, 100vw"
          />
        </div>
      </div>
    </section>
  )
}
