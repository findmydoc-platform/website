import * as React from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, MapPin } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import { Button } from '@/components/atoms/button'
import { Card, CardContent, CardHeader } from '@/components/atoms/card'
import { VerificationBadge } from '@/components/atoms/verification-badge'
import { Media } from '@/components/molecules/Media'
import { SocialLink } from '@/components/molecules/SocialLink'
import { buildOpenStreetMapViewHref } from '@/utilities/openStreetMap'
import { cn } from '@/utilities/ui'

import type {
  ClinicBeforeAfterEntry,
  ClinicDetailDoctor,
  ClinicDetailLocation,
  ClinicDetailTreatment,
  ClinicDetailTrust,
} from './types'

export const DOCTORS_PAGE_SIZE = 10

const NO_REVIEWS_TEXT = 'No reviews yet'

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatRatingSummary(ratingValue?: number, reviewCount?: number): string {
  if (typeof ratingValue === 'number' && typeof reviewCount === 'number' && reviewCount > 0) {
    return `${ratingValue.toFixed(1)} (${reviewCount} reviews)`
  }

  return NO_REVIEWS_TEXT
}

export function sortTreatmentsByPrice(treatments: ClinicDetailTreatment[]): ClinicDetailTreatment[] {
  return [...treatments].sort((left, right) => {
    const leftPrice = typeof left.priceFromUsd === 'number' ? left.priceFromUsd : Number.POSITIVE_INFINITY
    const rightPrice = typeof right.priceFromUsd === 'number' ? right.priceFromUsd : Number.POSITIVE_INFINITY

    if (leftPrice !== rightPrice) return leftPrice - rightPrice
    return left.name.localeCompare(right.name, 'en')
  })
}

export function buildOpenStreetMapHref(location: ClinicDetailLocation): string | undefined {
  return buildOpenStreetMapViewHref(location)
}

export function ClinicTrustMetrics({
  trust,
  className,
  title = 'Trust & Transparency',
}: {
  trust: ClinicDetailTrust
  className?: string
  title?: string
}) {
  return (
    <section className={cn('space-y-4', className)} aria-label={title}>
      <Heading as="h2" align="left" size="h4" className="text-secondary">
        {title}
      </Heading>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Rating</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold text-foreground">
              {formatRatingSummary(trust.ratingValue, trust.reviewCount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Verification</p>
          </CardHeader>
          <CardContent>
            <VerificationBadge variant={trust.verification} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Accreditations</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-lg font-semibold text-foreground">{trust.accreditations.length}</p>
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {trust.accreditations.length > 0 ? trust.accreditations.join(', ') : 'No accreditations listed'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Languages</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-lg font-semibold text-foreground">{trust.languages.length}</p>
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {trust.languages.length > 0 ? trust.languages.join(', ') : 'No languages listed'}
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

export function TreatmentsPricePanel({
  treatments,
  className,
  title = 'Treatments & Pricing',
}: {
  treatments: ClinicDetailTreatment[]
  className?: string
  title?: string
}) {
  const sortedTreatments = React.useMemo(() => sortTreatmentsByPrice(treatments), [treatments])

  return (
    <section className={cn('space-y-4', className)} aria-label={title}>
      <Heading as="h2" align="left" size="h4" className="text-secondary">
        {title}
      </Heading>
      <Card>
        <CardContent className="space-y-3 p-4 md:p-6">
          {sortedTreatments.length > 0 ? (
            sortedTreatments.map((treatment) => (
              <div
                key={treatment.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-border/70 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{treatment.name}</p>
                  {treatment.category ? <p className="text-sm text-muted-foreground">{treatment.category}</p> : null}
                </div>
                <p className="text-sm font-medium text-primary">
                  {typeof treatment.priceFromUsd === 'number'
                    ? `From ${formatUsd(treatment.priceFromUsd)}`
                    : 'Price on request'}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No treatments available yet.</p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

export function DoctorsDirectorySection({
  doctors,
  className,
  title = 'Our Doctors',
}: {
  doctors: ClinicDetailDoctor[]
  className?: string
  title?: string
}) {
  const titleId = React.useId()
  const [selectedDoctorId, setSelectedDoctorId] = React.useState(doctors[0]?.id ?? '')
  const [visibleCount, setVisibleCount] = React.useState(DOCTORS_PAGE_SIZE)

  React.useEffect(() => {
    setVisibleCount(DOCTORS_PAGE_SIZE)
  }, [doctors])

  React.useEffect(() => {
    if (!doctors.some((doctor) => doctor.id === selectedDoctorId)) {
      setSelectedDoctorId(doctors[0]?.id ?? '')
    }
  }, [doctors, selectedDoctorId])

  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId) ?? doctors[0]
  const visibleDoctors = doctors.slice(0, visibleCount)
  const canShowMore = visibleCount < doctors.length

  return (
    <section className={cn('space-y-4', className)} aria-labelledby={titleId}>
      <div className="flex items-end justify-between gap-4">
        <Heading id={titleId} as="h2" align="left" size="h4" className="text-secondary">
          {title}
        </Heading>
        <p className="text-sm text-muted-foreground">{doctors.length} listed specialists</p>
      </div>

      {selectedDoctor ? (
        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-4">
            <CardContent className="space-y-3 p-4">
              <ul className="space-y-2" aria-label="Doctor directory list">
                {visibleDoctors.map((doctor) => {
                  const isSelected = doctor.id === selectedDoctor.id
                  return (
                    <li key={doctor.id}>
                      <button
                        type="button"
                        aria-label={`Select ${doctor.name}`}
                        className={cn(
                          'w-full rounded-lg border px-3 py-3 text-left transition-colors',
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-card hover:border-primary/40 hover:bg-primary/5',
                        )}
                        onClick={() => setSelectedDoctorId(doctor.id)}
                      >
                        <p className="truncate font-semibold text-foreground">{doctor.name}</p>
                        <p className="truncate text-sm text-muted-foreground">{doctor.specialty}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatRatingSummary(doctor.ratingValue, doctor.reviewCount)}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {canShowMore ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => setVisibleCount((current) => current + DOCTORS_PAGE_SIZE)}
                >
                  Show more doctors
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card className="lg:col-span-8">
            <CardContent className="space-y-5 p-4 md:p-6">
              <div className="grid gap-5 md:grid-cols-[220px_1fr]">
                <div className="relative aspect-square overflow-hidden rounded-xl">
                  <Media
                    htmlElement={null}
                    src={selectedDoctor.image.src}
                    alt={selectedDoctor.image.alt}
                    fill
                    imgClassName="object-cover"
                    size="(min-width: 768px) 220px, 100vw"
                  />
                </div>

                <div className="space-y-3">
                  <Heading as="h3" align="left" size="h4" className="text-secondary">
                    {selectedDoctor.name}
                  </Heading>
                  <p className="text-base text-muted-foreground">{selectedDoctor.specialty}</p>
                  <p className="text-sm font-medium text-foreground">
                    {formatRatingSummary(selectedDoctor.ratingValue, selectedDoctor.reviewCount)}
                  </p>

                  {selectedDoctor.yearsExperience ? (
                    <p className="text-sm text-muted-foreground">
                      {selectedDoctor.yearsExperience}+ years of experience
                    </p>
                  ) : null}

                  {selectedDoctor.languages?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedDoctor.languages.map((language) => (
                        <span
                          key={`${selectedDoctor.id}-${language}`}
                          className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                        >
                          {language}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {selectedDoctor.description ? (
                    <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                      {selectedDoctor.description}
                    </p>
                  ) : null}

                  {selectedDoctor.socialLinks?.length ? (
                    <div className="flex items-center gap-2">
                      {selectedDoctor.socialLinks.map((link) => (
                        <SocialLink
                          key={`${selectedDoctor.id}-${link.kind}-${link.href}`}
                          href={link.href}
                          platform={link.kind}
                          aria-label={link.label}
                          variant="outline"
                        />
                      ))}
                    </div>
                  ) : null}

                  <Button asChild className="mt-2">
                    <a href={selectedDoctor.contactHref}>
                      Contact Clinic
                      <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">No doctors available yet.</p>
          </CardContent>
        </Card>
      )}
    </section>
  )
}

export function BeforeAfterCarouselSection({
  entries,
  className,
  title = 'Before & After Gallery',
}: {
  entries: ClinicBeforeAfterEntry[]
  className?: string
  title?: string
}) {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const total = entries.length

  React.useEffect(() => {
    if (total <= 0) {
      setActiveIndex(0)
      return
    }

    setActiveIndex((prev) => (prev >= total ? 0 : prev))
  }, [total])

  const active = entries[activeIndex]
  const canNavigate = total > 1

  const goPrev = () => {
    if (!canNavigate) return
    setActiveIndex((prev) => (prev === 0 ? total - 1 : prev - 1))
  }

  const goNext = () => {
    if (!canNavigate) return
    setActiveIndex((prev) => (prev + 1) % total)
  }

  return (
    <section className={cn('space-y-4', className)} aria-label={title}>
      <div className="flex items-end justify-between gap-4">
        <Heading as="h2" align="left" size="h4" className="text-secondary">
          {title}
        </Heading>
        {canNavigate ? <p className="text-sm text-muted-foreground">{total} stories</p> : null}
      </div>

      {active ? (
        <Card>
          <CardContent className="space-y-5 p-4 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <Heading as="h3" align="left" size="h5" className="text-secondary">
                {active.title}
              </Heading>
              {canNavigate ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="brandOutlineThick"
                    size="icon"
                    aria-label="Previous story"
                    onClick={goPrev}
                  >
                    <ChevronLeft className="size-5" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="brandOutlineThick"
                    size="icon"
                    aria-label="Next story"
                    onClick={goNext}
                  >
                    <ChevronRight className="size-5" aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Before</p>
                <div className="relative aspect-video overflow-hidden rounded-xl">
                  <Media
                    htmlElement={null}
                    src={active.before.src}
                    alt={active.before.alt}
                    fill
                    imgClassName="object-cover"
                    size="(min-width: 768px) 45vw, 100vw"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">After</p>
                <div className="relative aspect-video overflow-hidden rounded-xl">
                  <Media
                    htmlElement={null}
                    src={active.after.src}
                    alt={active.after.alt}
                    fill
                    imgClassName="object-cover"
                    size="(min-width: 768px) 45vw, 100vw"
                  />
                </div>
              </div>
            </div>

            {active.description ? <p className="text-sm text-muted-foreground">{active.description}</p> : null}

            {canNavigate ? (
              <div className="flex items-center gap-2" aria-label="Before and after stories">
                {entries.map((entry, index) => {
                  const isActive = index === activeIndex
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      aria-label={`Show story ${index + 1}: ${entry.title}`}
                      aria-current={isActive ? 'true' : undefined}
                      className={cn(
                        'rounded-full transition-[background-color,width,height] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden',
                        isActive ? 'size-3.5 bg-primary' : 'size-2.5 bg-primary/35 hover:bg-primary/55',
                      )}
                      onClick={() => setActiveIndex(index)}
                    />
                  )
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">No before and after stories published yet.</p>
          </CardContent>
        </Card>
      )}
    </section>
  )
}

export function LocationContactSection({
  location,
  clinicName,
  contactHref,
  className,
  title = 'Location & Contact',
}: {
  location: ClinicDetailLocation
  clinicName: string
  contactHref: string
  className?: string
  title?: string
}) {
  const mapHref = buildOpenStreetMapHref(location)
  const address = location.fullAddress?.trim()
  const canRenderMap = Boolean(mapHref || address)

  if (!canRenderMap) return null

  return (
    <section className={cn('space-y-4', className)} aria-label={title}>
      <Heading as="h2" align="left" size="h4" className="text-secondary">
        {title}
      </Heading>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardContent className="space-y-4 p-4 md:p-6">
            <p className="text-sm tracking-wide text-muted-foreground uppercase">Address</p>
            <p className="text-base text-foreground">{address ?? 'Address available on request'}</p>

            <div className="space-y-2 rounded-lg border border-border/70 p-3">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Map source</p>
              <p className="text-sm text-foreground">OpenStreetMap</p>
              <p className="text-xs text-muted-foreground">Map data © OpenStreetMap contributors</p>
            </div>

            <div className="flex flex-wrap gap-3">
              {mapHref ? (
                <Button asChild variant="secondary">
                  <a href={mapHref} target="_blank" rel="noopener noreferrer">
                    Open in OpenStreetMap
                  </a>
                </Button>
              ) : null}

              <Button asChild>
                <a href={contactHref}>
                  Contact Clinic
                  <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-7">
          <Card className="h-full overflow-hidden">
            <CardContent className="relative h-72 p-0 md:h-full md:min-h-[340px]">
              <div className="absolute inset-0 bg-linear-to-br from-primary/12 via-background to-primary/20" />
              <div className="absolute inset-x-0 top-1/4 border-t border-primary/20" />
              <div className="absolute inset-x-0 top-2/4 border-t border-primary/20" />
              <div className="absolute inset-x-0 top-3/4 border-t border-primary/20" />
              <div className="absolute inset-y-0 left-1/4 border-l border-primary/20" />
              <div className="absolute inset-y-0 left-2/4 border-l border-primary/20" />
              <div className="absolute inset-y-0 left-3/4 border-l border-primary/20" />

              <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
                <div className="rounded-full border border-primary/35 bg-card p-3 text-primary shadow-brand-soft">
                  <MapPin className="size-6" aria-hidden="true" />
                </div>
                <p className="rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-secondary">
                  {clinicName}
                </p>
              </div>

              <p className="absolute right-3 bottom-3 rounded-full bg-background/90 px-3 py-1 text-[11px] text-muted-foreground">
                Map data © OpenStreetMap contributors
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
