'use client'

import * as React from 'react'
import { CheckCircle2, Info } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { Card, CardContent } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { RatingStars } from '@/components/molecules/RatingSummary'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover'
import { cn } from '@/utilities/ui'

import type { ClinicDetailReview, ClinicDetailReviews } from '@/components/templates/ClinicDetailConcepts/types'

type ClinicReviewsSectionProps = {
  ratingValue: number | null
  reviews: ClinicDetailReviews
}

const INITIAL_VISIBLE_REVIEW_COUNT = 4
const REVIEW_LOAD_INCREMENT = 4
const MAX_VISIBLE_REVIEW_COUNT = 16
const VERIFIED_REVIEW_DESCRIPTION =
  'Verified reviews come from patients or accompanying persons after a documented consultation or treatment through findmydoc. Reviews are checked before publication.'

const reviewDateFormatter = new Intl.DateTimeFormat('en', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
  year: 'numeric',
})

function formatReviewCount(count: number): string {
  return `${count} ${count === 1 ? 'review' : 'reviews'}`
}

function formatVerifiedReviewCount(count: number): string {
  return `${count} verified ${count === 1 ? 'review' : 'reviews'}`
}

function formatLoadedReviewProgress(
  visibleCount: number,
  totalCount: number,
  hasMoreReviewsThanLoaded: boolean,
): string {
  return hasMoreReviewsThanLoaded
    ? `Showing ${formatReviewCount(visibleCount)} loaded on this page of ${formatVerifiedReviewCount(totalCount)}.`
    : `Showing ${formatReviewCount(visibleCount)} of ${formatVerifiedReviewCount(totalCount)}.`
}

function formatReviewDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return reviewDateFormatter.format(date)
}

function getAuthorName(review: ClinicDetailReview): string {
  return typeof review.authorName === 'string' ? review.authorName.trim() : ''
}

function ReviewRatingStars({
  value,
  showValue = true,
  size = 'sm',
}: {
  value: number
  showValue?: boolean
  size?: 'sm' | 'lg'
}) {
  return (
    <RatingStars value={value} showValue={showValue} size={size} emptyStarClassName="fill-primary/15 text-primary/15" />
  )
}

function getReviewerLabel(review: ClinicDetailReview): string {
  const authorName = getAuthorName(review)
  return authorName.length > 0 ? authorName : 'Anonymous patient'
}

function getReviewerInitials(review: ClinicDetailReview): string {
  const authorName = getAuthorName(review)
  if (authorName.length === 0) return 'AP'

  const initials = authorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return initials.length > 0 ? initials : 'AP'
}

function VerifiedReviewsInfo({ count }: { count: number }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span>{formatVerifiedReviewCount(count)}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="min-h-11 min-w-11 rounded-full p-0 text-primary hover:bg-primary/8 sm:min-h-10 sm:min-w-10"
            aria-label="What verified reviews mean"
          >
            <Info className="size-4" aria-hidden={true} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] rounded-xl border-primary/15 text-sm leading-6 text-secondary/75 shadow-brand-soft">
          {VERIFIED_REVIEW_DESCRIPTION}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function ReviewMeta({ review }: { review: ClinicDetailReview }) {
  return (
    <div className="space-y-2">
      <ReviewRatingStars value={review.ratingValue} />
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600">
        <CheckCircle2 className="size-4" aria-hidden={true} />
        Verified review
      </span>
    </div>
  )
}

function ReviewerAvatar({ review }: { review: ClinicDetailReview }) {
  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary sm:size-14 sm:text-lg">
      {getReviewerInitials(review)}
    </div>
  )
}

function ReviewerIdentity({ review }: { review: ClinicDetailReview }) {
  const reviewerLabel = getReviewerLabel(review)
  const formattedDate = formatReviewDate(review.reviewDate)

  return (
    <div className="min-w-0 space-y-1">
      <p className="text-base font-semibold [overflow-wrap:anywhere] text-secondary">{reviewerLabel}</p>
      <p className="text-sm font-medium text-secondary/65">Patient</p>
      <time className="block text-sm font-medium text-secondary/55" dateTime={review.reviewDate}>
        {formattedDate}
      </time>
    </div>
  )
}

function ReviewListItem({
  review,
  focusRef,
  isFirst = false,
  isLast = false,
}: {
  review: ClinicDetailReview
  focusRef?: React.Ref<HTMLElement>
  isFirst?: boolean
  isLast?: boolean
}) {
  const formattedDate = formatReviewDate(review.reviewDate)
  const reviewerLabel = getReviewerLabel(review)
  const articleLabel = `${reviewerLabel} verified review from ${formattedDate}`

  return (
    <article
      aria-label={articleLabel}
      ref={focusRef}
      tabIndex={-1}
      className={cn(
        'grid gap-6 px-0 py-8 outline-none focus-visible:ring-2 focus-visible:ring-primary sm:py-9 lg:grid-cols-[minmax(17rem,0.4fr)_minmax(0,1fr)] lg:gap-12',
        isFirst && 'pt-0',
        isLast && 'pb-0',
      )}
    >
      <div className="flex min-w-0 gap-4">
        <ReviewerAvatar review={review} />
        <div className="min-w-0 space-y-4">
          <ReviewerIdentity review={review} />
          <ReviewMeta review={review} />
        </div>
      </div>
      <p className="max-w-3xl text-base leading-7 [overflow-wrap:anywhere] whitespace-pre-line text-secondary/80">
        {review.comment}
      </p>
    </article>
  )
}

function LatestReview({ review }: { review: ClinicDetailReview }) {
  return (
    <article className="space-y-5 rounded-2xl border border-primary/20 bg-background p-5 shadow-none sm:p-6 lg:p-8">
      <div className="space-y-4">
        <p className="text-base font-semibold text-primary">Latest review</p>
        <ReviewRatingStars value={review.ratingValue} size="lg" />
        <blockquote className="max-w-3xl text-lg leading-8 font-normal [overflow-wrap:anywhere] text-secondary sm:text-xl sm:leading-9">
          “{review.comment}”
        </blockquote>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-primary/10 pt-4">
        <ReviewerAvatar review={review} />
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm text-secondary/60">
          <p className="font-semibold [overflow-wrap:anywhere] text-secondary">{getReviewerLabel(review)}</p>
          <span className="hidden h-5 w-px bg-primary/15 sm:block" aria-hidden={true} />
          <span className="inline-flex items-center gap-1.5 font-semibold text-teal-600">
            <CheckCircle2 className="size-4" aria-hidden={true} />
            Verified review
          </span>
          <span className="hidden h-5 w-px bg-primary/15 sm:block" aria-hidden={true} />
          <time dateTime={review.reviewDate}>{formatReviewDate(review.reviewDate)}</time>
        </div>
      </div>
    </article>
  )
}

function ReviewsSummary({ ratingValue, count }: { ratingValue: number | null; count: number }) {
  const hasRating = ratingValue !== null && count > 0

  return (
    <div className="space-y-4">
      {hasRating ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-6xl leading-none font-semibold tracking-normal text-primary sm:text-7xl">
              {ratingValue.toFixed(1)}
            </span>
            <span className="text-3xl font-semibold text-secondary/55">/ 5</span>
          </div>
          <ReviewRatingStars value={ratingValue} showValue={false} size="lg" />
        </>
      ) : (
        <p className="text-2xl font-semibold text-secondary">No patient reviews yet</p>
      )}
      <div className="text-base font-semibold text-secondary">
        <VerifiedReviewsInfo count={count} />
      </div>
      <p className="max-w-sm text-sm leading-6 text-secondary/60">Only verified patient reviews are shown.</p>
    </div>
  )
}

function EmptyReviewsPanel({ totalCount }: { totalCount: number }) {
  const hasApprovedCount = totalCount > 0

  return (
    <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5 sm:p-6">
      <Heading as="h3" align="left" size="h5" className="text-secondary">
        {hasApprovedCount ? 'Approved review text is being connected' : 'No patient reviews yet'}
      </Heading>
      <p className="mt-2 text-base leading-7 text-secondary/65">
        {hasApprovedCount
          ? 'Approved review records exist, but text content is not ready for public display yet.'
          : 'Verified reviews will appear here after moderation.'}
      </p>
    </div>
  )
}

export function ClinicReviewsSection({ ratingValue, reviews }: ClinicReviewsSectionProps) {
  const sectionId = React.useId()
  const headingId = `${sectionId}-heading`
  const progressId = `${sectionId}-progress`
  const [visibleCount, setVisibleCount] = React.useState(INITIAL_VISIBLE_REVIEW_COUNT)
  const [statusMessage, setStatusMessage] = React.useState('')
  const reviewRefs = React.useRef(new Map<string, HTMLElement>())
  const pendingFocusReviewId = React.useRef<string | null>(null)
  const visibleLimit = Math.min(reviews.items.length, MAX_VISIBLE_REVIEW_COUNT)
  const resolvedVisibleCount = Math.min(visibleCount, visibleLimit)
  const visibleReviews = reviews.items.slice(0, resolvedVisibleCount)
  const hasVisibleReviews = visibleReviews.length > 0
  const featuredReview = visibleReviews[0]
  const listedReviews = visibleReviews.slice(1)
  const canShowMore = visibleLimit > visibleReviews.length
  const nextVisibleReviewCount = Math.min(REVIEW_LOAD_INCREMENT, visibleLimit - visibleReviews.length)
  const hasApprovedReviewsWithoutDisplayableText = !hasVisibleReviews && reviews.totalCount > 0
  const hasMoreReviewsThanLoaded = Boolean(
    !hasApprovedReviewsWithoutDisplayableText && reviews.hasMore && reviews.totalCount > reviews.items.length,
  )
  const progressText = hasVisibleReviews
    ? formatLoadedReviewProgress(visibleReviews.length, reviews.totalCount, hasMoreReviewsThanLoaded)
    : hasApprovedReviewsWithoutDisplayableText
      ? `${formatVerifiedReviewCount(reviews.totalCount)} are being prepared for display.`
      : null
  const setReviewRef = React.useCallback(
    (reviewId: string) => (element: HTMLElement | null) => {
      if (element) {
        reviewRefs.current.set(reviewId, element)
      } else {
        reviewRefs.current.delete(reviewId)
      }
    },
    [],
  )

  React.useEffect(() => {
    const reviewId = pendingFocusReviewId.current
    if (!reviewId) return

    pendingFocusReviewId.current = null
    reviewRefs.current.get(reviewId)?.focus({ preventScroll: false })
  }, [visibleCount])

  const showMoreReviews = React.useCallback(() => {
    setVisibleCount((current) => {
      const next = Math.min(current + REVIEW_LOAD_INCREMENT, visibleLimit)
      const firstNewReview = reviews.items[current]

      pendingFocusReviewId.current = firstNewReview?.id ?? null
      setStatusMessage(formatLoadedReviewProgress(next, reviews.totalCount, reviews.totalCount > reviews.items.length))

      return next
    })
  }, [reviews.items, reviews.totalCount, visibleLimit])

  return (
    <section aria-labelledby={headingId} data-testid="clinic-reviews-section">
      <Card className="rounded-3xl border-primary/15 bg-background shadow-brand-soft">
        <CardContent className="space-y-6 p-5 sm:p-8 lg:p-10">
          <div className="space-y-2">
            <Heading id={headingId} as="h2" align="left" size="h4" className="text-secondary">
              Patient Reviews
            </Heading>
            <p id={progressId} className="max-w-3xl text-sm text-secondary/60">
              {progressText ?? `Showing ${formatVerifiedReviewCount(reviews.totalCount)}.`}
            </p>
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {statusMessage}
            </p>
          </div>

          {featuredReview ? (
            <div className="grid gap-6 border-y border-primary/10 py-6 lg:grid-cols-[minmax(16rem,0.33fr)_minmax(0,1fr)] lg:gap-12 lg:py-8">
              <ReviewsSummary ratingValue={ratingValue} count={reviews.totalCount} />
              <div className="lg:border-l lg:border-primary/10 lg:pl-12">
                <LatestReview review={featuredReview} />
              </div>
            </div>
          ) : (
            <EmptyReviewsPanel totalCount={reviews.totalCount} />
          )}

          {listedReviews.length ? (
            <div className="space-y-4">
              <p className="text-sm font-semibold tracking-[0.12em] text-secondary/50 uppercase">
                Latest patient feedback
              </p>
              <div
                className="divide-y divide-primary/10 rounded-2xl border border-primary/15 px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6"
                role="list"
              >
                {listedReviews.map((review, index) => (
                  <div key={review.id} role="listitem">
                    <ReviewListItem
                      review={review}
                      focusRef={setReviewRef(review.id)}
                      isFirst={index === 0}
                      isLast={index === listedReviews.length - 1}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {canShowMore ? (
            <div className="flex flex-wrap items-center gap-3 border-t border-primary/10 pt-5">
              <Button
                type="button"
                variant="primary"
                className="min-h-11 w-full gap-2 md:w-auto"
                aria-describedby={progressId}
                onClick={showMoreReviews}
              >
                Show more reviews
              </Button>
              <p className="text-sm text-secondary/55">
                Loads the next {formatReviewCount(nextVisibleReviewCount)} inline.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}
