import * as React from 'react'
import { Media } from '@/components/molecules/Media'

import { Button } from '@/components/atoms/button'
import { Heading } from '@/components/atoms/Heading'
import { Rank } from '@/components/atoms/Rank'
import { VerificationBadge, type VerificationBadgeVariant } from '@/components/atoms/verification-badge'
import { PriceSummary } from '@/components/molecules/PriceSummary'
import { LocationLine } from '@/components/molecules/LocationLine'
import { RatingSummary } from '@/components/molecules/RatingSummary'
import { TagList } from '@/components/molecules/TagList'
import { WaitTime } from '@/components/molecules/WaitTime'
import { cn } from '@/utilities/ui'

type ListingCardMedia = {
  src: string
  alt: string
  priority?: boolean
}

export type ListingWaitTime = {
  label: string
  minWeeks: number
  maxWeeks?: number
}

export type ListingCardData = {
  rank: number
  name: string
  location: string
  media: ListingCardMedia
  verification: {
    variant: VerificationBadgeVariant
  }
  rating: {
    value: number
    count: number
  }
  waitTime?: ListingWaitTime
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

export function ListingCard({ data, className }: { data: ListingCardData; className?: string }) {
  return (
    <article
      className={cn(
        'w-full rounded-2xl border border-border bg-card p-4 shadow-xs md:flex md:items-stretch md:gap-6 md:p-6',
        className,
      )}
    >
      <div className="mb-4 md:mb-0 md:pt-1">
        <Rank value={data.rank} />
      </div>

      <div className="flex flex-1 flex-col gap-4 md:flex-row md:gap-6">
        <div className="max-w-32 flex-[1_0_0] self-stretch">
          <div className="relative aspect-square w-full overflow-hidden">
            <Media
              htmlElement={null}
              src={data.media.src}
              alt={data.media.alt}
              fill
              imgClassName="object-cover"
              size="(min-width: 768px) 128px, 100vw"
              priority={data.media.priority}
            />
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3 md:pt-1">
          {data.priceFrom ? <PriceSummary priceFrom={data.priceFrom} /> : null}

          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <Heading
                as="h3"
                align="left"
                size="h5"
                className="truncate text-2xl leading-tight font-semibold text-foreground"
              >
                {data.name}
              </Heading>
              <VerificationBadge variant={data.verification.variant} className="shrink-0" />
            </div>

            <div className="mt-1 flex items-center gap-2 text-sm text-foreground">
              <LocationLine value={data.location} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-foreground md:gap-6">
            <RatingSummary value={data.rating.value} count={data.rating.count} />

            {data.waitTime ? <WaitTime value={data.waitTime.label} /> : null}
          </div>

          <TagList tags={data.tags} />
        </div>

        <div className="flex shrink-0 flex-col gap-3 md:items-end md:pt-1">
          <Button asChild className="h-12 w-36 text-sm font-semibold">
            <a href={data.actions.details.href}>{data.actions.details.label}</a>
          </Button>
          {data.actions.compare ? (
            <Button asChild variant="secondary" className="h-12 w-36 text-sm font-semibold text-foreground">
              <a href={data.actions.compare.href}>{data.actions.compare.label}</a>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
