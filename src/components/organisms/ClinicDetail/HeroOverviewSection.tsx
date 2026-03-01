import * as React from 'react'
import { Stethoscope } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import { Card, CardContent } from '@/components/atoms/card'
import { DoctorPreviewListItem, HeroQualitySummary } from '@/components/molecules/ClinicDetail'
import { Media } from '@/components/molecules/Media'
import { formatRatingSummary } from '@/components/templates/ClinicDetailConcepts/shared'
import { cn } from '@/utilities/ui'

import type { ClinicDetailDoctor, ClinicDetailTrust } from '@/components/templates/ClinicDetailConcepts/types'

type HeroOverviewSectionProps = {
  clinicName: string
  description: string
  heroImage: { src: string; alt: string }
  trust: ClinicDetailTrust
  doctors: ClinicDetailDoctor[]
  activeDoctorId: string
  onDoctorSelect: (doctorId: string) => void
}

export function HeroOverviewSection({
  clinicName,
  description,
  heroImage,
  trust,
  doctors,
  activeDoctorId,
  onDoctorSelect,
}: HeroOverviewSectionProps) {
  const hasDoctors = doctors.length > 0
  const isSparseDoctorsList = doctors.length <= 1
  const specialistLabel = doctors.length === 1 ? 'listed specialist' : 'listed specialists'

  return (
    <section className="grid gap-12 lg:grid-cols-12 lg:items-start">
      <div className="space-y-8 lg:col-span-5 lg:pt-14">
        <div className="space-y-2">
          <p className="text-size-40 leading-[1.2] font-semibold text-primary">CLINIC OVERVIEW</p>
          <Heading as="h1" align="left" size="h1" className="max-w-[9ch] text-size-72 leading-[1.1389] text-secondary">
            {clinicName}
          </Heading>
        </div>

        <p className="max-w-[492px] text-base leading-[26px] text-secondary/70">{description}</p>

        <HeroQualitySummary trust={trust} />
      </div>

      <div className="relative lg:col-span-7 lg:pl-8">
        <div className="relative ml-auto aspect-[667/649] w-full max-w-[667px] overflow-hidden rounded-[30px]">
          <Media
            htmlElement={null}
            src={heroImage.src}
            alt={heroImage.alt}
            fill
            imgClassName="object-cover"
            size="(min-width: 1024px) 667px, 100vw"
          />
        </div>

        <Card
          className={cn(
            'relative mt-10 ml-5 w-full max-w-[530px] rounded-[25px] border-0 shadow-brand-soft lg:absolute lg:left-0 lg:mt-0',
            isSparseDoctorsList ? 'lg:bottom-[-72px]' : 'lg:bottom-[-220px]',
          )}
        >
          <CardContent className="space-y-4 p-6">
            <div>
              <Heading as="h2" align="left" size="h5" className="text-[32px] leading-[1.3] text-secondary">
                Available Doctors
              </Heading>
              <p className="text-sm text-secondary/60">
                {doctors.length} {specialistLabel}
              </p>
            </div>

            {hasDoctors ? (
              <div className={isSparseDoctorsList ? 'space-y-1' : 'space-y-1 overflow-y-auto pr-1 lg:h-[272px]'}>
                {doctors.map((doctor) => (
                  <DoctorPreviewListItem
                    key={doctor.id}
                    doctor={doctor}
                    selected={activeDoctorId === doctor.id}
                    ratingText={formatRatingSummary(doctor.ratingValue, doctor.reviewCount)}
                    onSelect={() => onDoctorSelect(doctor.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/12">
                    <Stethoscope className="size-4 text-primary" aria-hidden={true} />
                  </span>
                  <p className="text-sm leading-6 text-secondary/70">
                    No doctors are currently listed for this clinic. Use the contact form below to request guidance and
                    we will connect you with a suitable specialist.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
