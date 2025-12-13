import * as React from 'react'
import Image from 'next/image'

import { Button } from '@/components/atoms/button'
import { VerificationBadge, type VerificationBadgeVariant } from '@/components/atoms/verification-badge'
import { ClinicLocation } from '@/components/molecules/ClinicLocation'
import { ClinicRating } from '@/components/molecules/ClinicRating'
import { ClinicTags } from '@/components/molecules/ClinicTags'
import { ClinicWaitTime } from '@/components/molecules/ClinicWaitTime'
import { cn } from '@/utilities/ui'

type ClinicResultCardMedia = {
  src: string
  alt: string
}

export type ClinicResultCardData = {
  rank: number
  name: string
  location: string
  media: ClinicResultCardMedia
  verification: {
    variant: VerificationBadgeVariant
    label: string
  }
  rating: {
    value: number
    count: number
  }
  waitTime?: string
  tags: string[]
  priceFrom?: {
    value: number
    currency: string
    label: string
  }
  actions: {
    details: { href: string; label: string }
    compare?: { href: string; label: string }
  }
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function ClinicResultCard({ data, className }: { data: ClinicResultCardData; className?: string }) {
  return (
    <article
      className={cn(
        'w-full rounded-3xl border border-border bg-card p-4 shadow-xs md:flex md:items-stretch md:gap-6 md:p-6',
        className,
      )}
    >
      <div className="mb-4 md:mb-0 md:pt-1">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary-foreground text-xl font-bold text-primary-foreground">
          {data.rank}
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:gap-6">
        <div className="shrink-0">
          <div className="relative h-32 w-full overflow-hidden rounded-2xl md:w-56">
            <Image
              src={data.media.src}
              alt={data.media.alt}
              fill
              sizes="(min-width: 768px) 224px, 100vw"
              className="object-cover"
            />
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3 md:pt-1">
          <div className="flex flex-wrap items-start gap-3">
            <h3 className="text-2xl font-semibold leading-tight text-foreground">{data.name}</h3>
            <VerificationBadge variant={data.verification.variant}>{data.verification.label}</VerificationBadge>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-lg text-foreground md:gap-6">
            <ClinicLocation value={data.location} />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-lg text-foreground md:gap-6">
            <ClinicRating value={data.rating.value} count={data.rating.count} />

            {data.waitTime ? <ClinicWaitTime value={data.waitTime} /> : null}
          </div>

          <ClinicTags tags={data.tags} />
        </div>

        <div className="flex shrink-0 flex-col justify-between gap-4 md:items-end md:pt-1">
          {data.priceFrom ? (
            <div className="text-left md:text-right">
              <div className="text-base font-semibold text-secondary-foreground">{data.priceFrom.label}</div>
              <div className="text-5xl font-bold tracking-tight text-primary">
                {formatMoney(data.priceFrom.value, data.priceFrom.currency)}
              </div>
            </div>
          ) : (
            <div />
          )}

          <div className="flex flex-col gap-3 md:items-end">
            <Button asChild className="h-12 w-36 rounded-2xl text-base font-semibold">
              <a href={data.actions.details.href}>{data.actions.details.label}</a>
            </Button>
            {data.actions.compare ? (
              <Button
                asChild
                variant="secondary"
                className="h-12 w-36 rounded-2xl text-base font-semibold text-foreground"
              >
                <a href={data.actions.compare.href}>{data.actions.compare.label}</a>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
