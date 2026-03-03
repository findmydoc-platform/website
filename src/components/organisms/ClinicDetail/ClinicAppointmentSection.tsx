import * as React from 'react'
import { Mail, Phone } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import { Button } from '@/components/atoms/button'
import { Media } from '@/components/molecules/Media'

import type { ClinicDetailDoctor, ClinicDetailTreatment } from '@/components/templates/ClinicDetailConcepts/types'

import type { ContactFormFields } from './types'

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
  message: string | null
  onFieldChange: (field: keyof ContactFormFields, value: string) => void
  onDoctorChange: (doctorId: string) => void
  onTreatmentChange: (treatmentId: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
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
  message,
  onFieldChange,
  onDoctorChange,
  onTreatmentChange,
  onSubmit,
  onResetFields,
  onClearSelections,
}: ClinicAppointmentSectionProps) {
  return (
    <section id={sectionId} ref={sectionRef} className="grid gap-12 lg:grid-cols-12 lg:items-start">
      <div className="space-y-8 lg:col-span-6">
        <div className="space-y-1">
          <p className="text-size-40 leading-[1.2] font-semibold text-primary">BOOK AN</p>
          <Heading as="h2" align="left" size="h2" className="text-size-72 leading-[1.1389] text-secondary">
            Appointment
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
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" className="rounded-full px-8">
              Submit Contact Request
            </Button>
            <Button type="button" variant="secondary" className="rounded-full" onClick={onResetFields}>
              Reset Form Fields
            </Button>
            <Button type="button" variant="ghost" className="rounded-full" onClick={onClearSelections}>
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
              role="status"
              className="rounded-xl border border-primary/25 bg-primary/8 px-4 py-3 text-sm text-secondary"
            >
              {message}
            </p>
          ) : null}
        </form>
      </div>

      <div className="relative lg:col-span-6 lg:pt-24">
        <div className="absolute inset-x-0 top-10 h-[360px] rounded-[180px] bg-accent/20" aria-hidden="true" />
        <div className="absolute -right-6 bottom-[-48px] size-[260px] rounded-full bg-primary/20" aria-hidden="true" />

        <div className="relative mx-auto aspect-[599/745] w-full max-w-[599px] overflow-hidden rounded-[30px]">
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
