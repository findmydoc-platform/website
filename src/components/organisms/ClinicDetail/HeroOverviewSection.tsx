import * as React from 'react'
import { Stethoscope } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import { Card, CardContent } from '@/components/atoms/card'
import { Breadcrumb, type BreadcrumbItem } from '@/components/molecules/Breadcrumb'
import { DoctorPreviewListItem, HeroQualitySummary } from '@/components/molecules/ClinicDetail'
import { formatRatingSummary } from '@/components/templates/ClinicDetailConcepts/shared'
import { ClinicGallery } from './ClinicGallery'

import type {
  ClinicDetailDoctor,
  ClinicDetailGalleryImage,
  ClinicDetailTrust,
} from '@/components/templates/ClinicDetailConcepts/types'

type HeroOverviewSectionProps = {
  clinicName: string
  description: string
  galleryImages: ClinicDetailGalleryImage[]
  heroImage: { src: string; alt: string }
  trust: ClinicDetailTrust
  breadcrumbs?: BreadcrumbItem[]
  doctors: ClinicDetailDoctor[]
  activeDoctorId: string
  onDoctorSelect: (doctorId: string) => void
  favoriteAction?: React.ReactNode
}

export function HeroOverviewSection({
  clinicName,
  description,
  galleryImages,
  heroImage,
  trust,
  breadcrumbs,
  doctors,
  activeDoctorId,
  onDoctorSelect,
  favoriteAction,
}: HeroOverviewSectionProps) {
  const hasDoctors = doctors.length > 0
  const specialistLabel = doctors.length === 1 ? 'listed specialist' : 'listed specialists'

  return (
    <section className="mx-auto max-w-[1080px] space-y-4 sm:space-y-5">
      <div className="space-y-3 sm:space-y-4">
        <div className="space-y-2">
          {breadcrumbs?.length ? (
            <Breadcrumb items={breadcrumbs} className="text-xs sm:text-sm [&_li]:gap-2 [&_ol]:gap-2" />
          ) : null}
          <p className="text-xl leading-[1.15] font-semibold text-primary sm:text-2xl">CLINIC OVERVIEW</p>
          <Heading
            as="h1"
            align="left"
            size="h1"
            className="max-w-[18ch] text-4xl leading-tight [overflow-wrap:anywhere] break-words text-secondary md:text-[44px] lg:text-5xl"
          >
            {clinicName}
          </Heading>
        </div>

        <p className="max-w-[594px] text-base leading-7 text-secondary/70">{description}</p>

        {favoriteAction ? <div className="max-w-[594px]">{favoriteAction}</div> : null}
      </div>

      <ClinicGallery clinicName={clinicName} galleryImages={galleryImages} heroImage={heroImage} />

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <HeroQualitySummary trust={trust} className="h-full" />

        <Card className="h-full w-full rounded-[24px] border-0 shadow-brand-soft">
          <CardContent className="space-y-4 p-6">
            <div>
              <Heading as="h2" align="left" size="h5" className="text-secondary">
                Available Doctors
              </Heading>
              <p className="text-sm text-secondary/60">
                {doctors.length} {specialistLabel}
              </p>
            </div>

            {hasDoctors ? (
              <div className="space-y-1 lg:max-h-[232px] lg:overflow-y-auto lg:pr-1">
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
