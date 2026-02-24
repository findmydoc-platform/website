import * as React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { Button } from '@/components/atoms/button'
import { VerificationBadge } from '@/components/atoms/verification-badge'
import { Card, CardContent } from '@/components/atoms/card'
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

export function ClinicDetailConceptC({ data, className }: ClinicDetailConceptProps) {
  return (
    <main className={cn('bg-background text-foreground', className)}>
      <Container className="space-y-12 py-12 md:space-y-14">
        <section className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-8">
            <CardContent className="space-y-5 p-6 md:p-8">
              <p className="text-xs tracking-[0.2em] text-primary uppercase">Doctor Directory Focus</p>
              <Heading as="h1" align="left" size="h2" className="text-secondary">
                {data.clinicName}
              </Heading>
              <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">{data.description}</p>

              <div className="flex flex-wrap items-center gap-3">
                <VerificationBadge variant={data.trust.verification} />
                <p className="text-sm font-medium text-foreground">
                  {formatRatingSummary(data.trust.ratingValue, data.trust.reviewCount)}
                </p>
              </div>

              <Button asChild>
                <a href={data.contactHref}>Contact Clinic</a>
              </Button>
            </CardContent>
          </Card>

          <div className="relative overflow-hidden rounded-2xl shadow-brand-soft lg:col-span-4">
            <div className="relative h-full min-h-56">
              <Media
                htmlElement={null}
                src={data.heroImage.src}
                alt={data.heroImage.alt}
                fill
                imgClassName="object-cover"
                size="(min-width: 1024px) 30vw, 100vw"
              />
            </div>
          </div>
        </section>

        <DoctorsDirectorySection doctors={data.doctors} />

        <section className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
          <TreatmentsPricePanel treatments={data.treatments} />
          <ClinicTrustMetrics trust={data.trust} />
        </section>

        <BeforeAfterCarouselSection entries={data.beforeAfterEntries} />
        <LocationContactSection location={data.location} clinicName={data.clinicName} contactHref={data.contactHref} />
      </Container>
    </main>
  )
}
