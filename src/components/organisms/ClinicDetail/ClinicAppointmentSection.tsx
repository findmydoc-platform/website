import * as React from 'react'
import { Mail, Phone } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import { Button } from '@/components/atoms/button'
import { Media } from '@/components/molecules/Media'

import type { ClinicDetailDoctor, ClinicDetailTreatment } from '@/components/templates/ClinicDetailConcepts/types'

import type { ContactFormFields, ContactFormMessage } from './types'

type ClinicAppointmentSectionProps = {
  sectionId: string
  sectionRef: React.RefObject<HTMLElement | null>
  fields: ContactFormFields
  selectedDoctorId: string
  selectedTreatmentId: string
  selectedDoctorName?: string
  selectedTreatmentName?: string
  doctors: ClinicDetailDoctor[]
  treatments: ClinicDetailTreatment[]
  appointmentImage: { src: string; alt: string }
  isSubmitting?: boolean
  message: ContactFormMessage | null
  onFieldChange: (field: keyof ContactFormFields, value: string) => void
  onDoctorChange: (doctorId: string) => void
  onTreatmentChange: (treatmentId: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void> | void
  onResetFields: () => void
  onClearSelections: () => void
}

const inputClassName =
  'h-14 w-full rounded-[28px] border border-primary/45 bg-background px-4 text-sm text-secondary outline-hidden transition-colors placeholder:text-secondary/45 focus:border-primary focus:ring-2 focus:ring-primary/20'
const textAreaClassName =
  'min-h-32 w-full rounded-[24px] border border-primary/45 bg-background px-4 py-3 text-sm text-secondary outline-hidden transition-colors placeholder:text-secondary/45 focus:border-primary focus:ring-2 focus:ring-primary/20'

export function ClinicAppointmentSection({
  sectionId,
  sectionRef,
  fields,
  selectedDoctorId,
  selectedTreatmentId,
  selectedDoctorName,
  selectedTreatmentName,
  doctors,
  treatments,
  appointmentImage,
  isSubmitting = false,
  message,
  onFieldChange,
  onDoctorChange,
  onTreatmentChange,
  onSubmit,
  onResetFields,
  onClearSelections,
}: ClinicAppointmentSectionProps) {
  return (
    <section
      id={sectionId}
      ref={sectionRef}
      tabIndex={-1}
      aria-labelledby={`${sectionId}-heading`}
      className="grid gap-8 lg:grid-cols-12 lg:items-start"
    >
      <div className="space-y-6 lg:col-span-6 lg:space-y-8">
        <div className="space-y-1">
          <p className="text-2xl leading-[1.15] font-semibold text-primary sm:text-size-40">BOOK AN</p>
          <Heading
            id={`${sectionId}-heading`}
            as="h2"
            align="left"
            size="h2"
            className="text-5xl leading-tight text-secondary sm:text-size-72 sm:leading-[1.1389]"
          >
            Appointment
          </Heading>
        </div>

        <form
          className="space-y-5"
          onSubmit={onSubmit}
          aria-busy={isSubmitting}
          aria-label="Clinic appointment request"
        >
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
              disabled={isSubmitting}
              required
            />
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-sm font-medium text-secondary">Preferred Date</span>
              <input
                type="date"
                name="preferredDate"
                className={inputClassName}
                value={fields.preferredDate}
                onChange={(event) => onFieldChange('preferredDate', event.target.value)}
                disabled={isSubmitting}
              />
            </label>

            <label className="space-y-2">
              <span className="block text-sm font-medium text-secondary">Preferred Time</span>
              <input
                type="time"
                name="preferredTime"
                className={inputClassName}
                value={fields.preferredTime}
                onChange={(event) => onFieldChange('preferredTime', event.target.value)}
                disabled={isSubmitting}
              />
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-sm font-medium text-secondary">Doctor</span>
              <select
                name="doctor"
                className={inputClassName}
                value={selectedDoctorId}
                onChange={(event) => onDoctorChange(event.target.value)}
                disabled={isSubmitting}
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
                name="treatment"
                className={inputClassName}
                value={selectedTreatmentId}
                onChange={(event) => onTreatmentChange(event.target.value)}
                disabled={isSubmitting}
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
              disabled={isSubmitting}
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button type="submit" className="w-full rounded-full px-8 sm:w-auto" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Contact Request'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full rounded-full sm:w-auto"
              onClick={onResetFields}
              disabled={isSubmitting}
            >
              Reset Form Fields
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-full sm:w-auto"
              onClick={onClearSelections}
              disabled={isSubmitting}
            >
              Clear Doctor & Treatment
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-secondary/60">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-background px-3 py-1">
              <Phone className="size-3.5 text-primary" aria-hidden="true" />
              Contact target: {selectedDoctorName ?? 'No doctor selected'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-background px-3 py-1">
              <Mail className="size-3.5 text-primary" aria-hidden="true" />
              Treatment: {selectedTreatmentName ?? 'No treatment selected'}
            </span>
          </div>

          {message ? (
            <p
              role={message.variant === 'error' ? 'alert' : 'status'}
              className={
                message.variant === 'error'
                  ? 'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
                  : 'rounded-xl border border-primary/25 bg-primary/8 px-4 py-3 text-sm text-secondary'
              }
            >
              {message.text}
            </p>
          ) : null}
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
