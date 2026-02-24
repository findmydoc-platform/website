import * as React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { Button } from '@/components/atoms/button'
import { VerificationBadge } from '@/components/atoms/verification-badge'
import { Container } from '@/components/molecules/Container'
import { Media } from '@/components/molecules/Media'
import { cn } from '@/utilities/ui'

import {
  BeforeAfterCarouselSection,
  ClinicTrustMetrics,
  DoctorsDirectorySection,
  LocationContactSection,
  TreatmentsPricePanel,
  formatRatingSummary,
} from './shared'
import type { ClinicDetailConceptProps } from './types'

export function ClinicDetailConceptA({ data, className }: ClinicDetailConceptProps) {
  return (
    <main className={cn('bg-background text-foreground', className)}>
      <Container className="space-y-14 py-12 md:space-y-16">
        <section className="grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="space-y-5 lg:col-span-6">
            <p className="text-xs tracking-[0.2em] text-primary uppercase">Clinic Detail</p>
            <Heading as="h1" align="left" size="h1" className="text-secondary">
              {data.clinicName}
            </Heading>
            <p className="max-w-prose text-base leading-relaxed text-muted-foreground">{data.description}</p>

            <div className="flex flex-wrap items-center gap-3">
              <VerificationBadge variant={data.trust.verification} />
              <p className="text-sm font-medium text-foreground">
                {formatRatingSummary(data.trust.ratingValue, data.trust.reviewCount)}
              </p>
            </div>

            <Button asChild>
              <a href={data.contactHref}>Contact Clinic</a>
            </Button>
          </div>

          <div className="lg:col-span-6">
            <div className="relative aspect-video overflow-hidden rounded-2xl shadow-brand-soft">
              <Media
                htmlElement={null}
                src={data.heroImage.src}
                alt={data.heroImage.alt}
                fill
                imgClassName="object-cover"
                size="(min-width: 1024px) 48vw, 100vw"
              />
            </div>
          </div>
        </section>

        <ClinicTrustMetrics trust={data.trust} />
        <TreatmentsPricePanel treatments={data.treatments} />
        <DoctorsDirectorySection doctors={data.doctors} />
        <BeforeAfterCarouselSection entries={data.beforeAfterEntries} />
        <LocationContactSection location={data.location} clinicName={data.clinicName} contactHref={data.contactHref} />
      </Container>
    </main>
  )
}
