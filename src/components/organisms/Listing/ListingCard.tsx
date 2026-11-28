import * as React from 'react'
import { Media } from '@/components/molecules/Media'

import { Button } from '@/components/atoms/button'
import { Heading } from '@/components/atoms/Heading'
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
  id: string | number
  name: string
  location: string
  locationHref?: string
  media: ListingCardMedia
  verification: {
    variant: VerificationBadgeVariant
    label?: string
  }
  rating: {
    value: number
    count: number
    ariaLabel?: string
  }
  waitTime?: ListingWaitTime
  tags: string[]
  priceFrom?: {
    value: number
    currency: string
    label: string
  }
  actions: {
    details: { href: string; label: string; ariaLabel?: string }
    compare?: { href: string; label: string; ariaLabel?: string }
  }
}

export function ListingCard({
  data,
  className,
  cornerAction,
  articleRef,
  locale,
}: {
  data: ListingCardData
  className?: string
  cornerAction?: React.ReactNode
  articleRef?: React.Ref<HTMLElement>
  locale?: string
}) {
  return (
    <article
      ref={articleRef}
      className={cn(
        '@container relative w-full overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-xs md:p-6',
        className,
      )}
    >
      {cornerAction ? <div className="absolute top-4 right-4 z-10 md:top-5 md:right-5">{cornerAction}</div> : null}

      <div className="grid gap-4 @min-[28rem]:grid-cols-[7rem_minmax(0,1fr)] @min-[40rem]:grid-cols-[8rem_minmax(0,1fr)_9rem] @min-[40rem]:gap-6">
        <div className="min-w-0">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl @min-[28rem]:aspect-square">
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

        <div className={cn('min-w-0 space-y-3', cornerAction && '@min-[28rem]:pr-12 @min-[40rem]:pr-0')}>
          <div className="grid items-start gap-3 @min-[40rem]:grid-cols-[minmax(0,1fr)_auto]">
            {data.priceFrom ? (
              <PriceSummary
                priceFrom={data.priceFrom}
                locale={locale}
                className="@min-[40rem]:col-start-2 @min-[40rem]:row-start-1 @min-[40rem]:text-right"
              />
            ) : null}
            <div className="min-w-0 space-y-2 @min-[40rem]:col-start-1 @min-[40rem]:row-start-1">
              <Heading
                as="h3"
                align="left"
                size="h5"
                className="text-xl leading-tight font-semibold break-words text-foreground sm:text-2xl"
              >
                {data.name}
              </Heading>
              <VerificationBadge variant={data.verification.variant} label={data.verification.label} />
              <div className="text-sm text-foreground">
                <LocationLine value={data.location} href={data.locationHref} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-foreground md:gap-6">
            <RatingSummary
              value={data.rating.value}
              count={data.rating.count}
              ratingLabel={data.rating.ariaLabel}
              locale={locale}
            />

            {data.waitTime ? <WaitTime value={data.waitTime.label} /> : null}
          </div>

          <TagList tags={data.tags} />
        </div>

        <div
          className={cn(
            'flex min-w-0 flex-col gap-3 @min-[28rem]:col-start-2 @min-[40rem]:col-start-3 @min-[40rem]:row-start-1',
            cornerAction && '@min-[40rem]:pt-14',
          )}
        >
          <Button asChild shape="pill" className="h-12 w-full text-sm font-semibold">
            <a href={data.actions.details.href} aria-label={data.actions.details.ariaLabel}>
              {data.actions.details.label}
            </a>
          </Button>
          {data.actions.compare ? (
            <Button asChild variant="secondary" className="h-12 w-full text-sm font-semibold text-foreground">
              <a href={data.actions.compare.href} aria-label={data.actions.compare.ariaLabel}>
                {data.actions.compare.label}
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
