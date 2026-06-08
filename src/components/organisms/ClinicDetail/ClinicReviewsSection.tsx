'use client'

import * as React from 'react'
import { Star } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { Card, CardContent } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { cn } from '@/utilities/ui'

import type { ClinicDetailReview, ClinicDetailReviews } from '@/components/templates/ClinicDetailConcepts/types'

type ClinicReviewsSectionProps = {
  reviews: ClinicDetailReviews
}

const INITIAL_VISIBLE_REVIEW_COUNT = 3

const reviewDateFormatter = new Intl.DateTimeFormat('en', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
  year: 'numeric',
})

function formatReviewCount(count: number): string {
  return `${count} ${count === 1 ? 'review' : 'reviews'}`
}

function formatReviewDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return reviewDateFormatter.format(date)
}

function RatingStars({ value }: { value: number }) {
  const clamped = Math.max(1, Math.min(5, value))
  const filled = Math.round(clamped)

  return (
    <div className="inline-flex items-center gap-1" aria-label={`Rating ${clamped.toFixed(1)} out of 5`} role="img">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={cn('size-4', index < filled ? 'fill-primary text-primary' : 'fill-primary/15 text-primary/15')}
          aria-hidden={true}
        />
      ))}
      <span className="ml-1 text-xs font-semibold text-primary">{clamped.toFixed(1)}</span>
    </div>
  )
}

function ReviewCard({ review, focusRef }: { review: ClinicDetailReview; focusRef?: React.Ref<HTMLElement> }) {
  const formattedDate = formatReviewDate(review.reviewDate)
  const hasAuthorName = typeof review.authorName === 'string' && review.authorName.trim().length > 0
  const reviewerLabel = hasAuthorName ? `${review.authorName}, verified patient` : 'Verified patient'
  const articleLabel = `${reviewerLabel} review from ${formattedDate}`

  return (
    <article
      aria-label={articleLabel}
      ref={focusRef}
      tabIndex={-1}
      className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Card className="h-full rounded-2xl border border-primary/15 bg-background shadow-none">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            {typeof review.ratingValue === 'number' ? (
              <RatingStars value={review.ratingValue} />
            ) : (
              <span className="text-xs font-semibold tracking-[0.12em] text-secondary/50 uppercase">Approved</span>
            )}
            <time className="shrink-0 text-sm font-semibold text-secondary/60" dateTime={review.reviewDate}>
              {formattedDate}
            </time>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              {hasAuthorName ? (
                <>
                  <p className="text-base font-semibold [overflow-wrap:anywhere] text-secondary">{review.authorName}</p>
                  <p className="text-xs font-semibold tracking-[0.08em] text-secondary/55 uppercase">
                    Verified patient
                  </p>
                </>
              ) : (
                <p className="text-sm font-semibold tracking-[0.08em] text-secondary/55 uppercase">Verified patient</p>
              )}
            </div>
            <p className="text-base leading-7 [overflow-wrap:anywhere] whitespace-pre-line text-secondary/75">
              {review.comment}
            </p>
          </div>
        </CardContent>
      </Card>
    </article>
  )
}

function EmptyReviewsPanel({ totalCount }: { totalCount: number }) {
  const hasApprovedCount = totalCount > 0

  return (
    <Card className="rounded-2xl border border-primary/15 bg-background shadow-none">
      <CardContent className="space-y-2 p-5 sm:p-6">
        <Heading as="h3" align="left" size="h5" className="text-secondary">
          {hasApprovedCount ? 'Approved review text is being connected' : 'No patient reviews yet'}
        </Heading>
        <p className="text-base leading-7 text-secondary/65">
          {hasApprovedCount
            ? 'Approved review records exist, but text content is not ready for public display yet.'
            : 'Approved reviews will appear here after moderation.'}
        </p>
      </CardContent>
    </Card>
  )
}

export function ClinicReviewsSection({ reviews }: ClinicReviewsSectionProps) {
  const sectionId = React.useId()
  const headingId = `${sectionId}-heading`
  const progressId = `${sectionId}-progress`
  const [visibleCount, setVisibleCount] = React.useState(INITIAL_VISIBLE_REVIEW_COUNT)
  const [statusMessage, setStatusMessage] = React.useState('')
  const reviewRefs = React.useRef(new Map<string, HTMLElement>())
  const pendingFocusReviewId = React.useRef<string | null>(null)
  const visibleReviews = reviews.items.slice(0, visibleCount)
  const hasVisibleReviews = visibleReviews.length > 0
  const canShowMore = reviews.items.length > visibleReviews.length
  const hasApprovedReviewsWithoutDisplayableText = !hasVisibleReviews && reviews.totalCount > 0
  const hasMoreReviewsThanLoaded = Boolean(
    !hasApprovedReviewsWithoutDisplayableText && reviews.hasMore && reviews.totalCount > reviews.items.length,
  )
  const reviewCountText = hasMoreReviewsThanLoaded
    ? `${formatReviewCount(reviews.items.length)} loaded`
    : formatReviewCount(reviews.totalCount)
  const progressText = hasVisibleReviews
    ? hasMoreReviewsThanLoaded
      ? `Showing ${formatReviewCount(visibleReviews.length)} loaded on this page of ${formatReviewCount(reviews.totalCount)}.`
      : `Showing ${formatReviewCount(visibleReviews.length)} of ${formatReviewCount(reviews.totalCount)}.`
    : hasApprovedReviewsWithoutDisplayableText
      ? 'Review text is not ready for public display yet.'
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
      const next = Math.min(current + INITIAL_VISIBLE_REVIEW_COUNT, reviews.items.length)
      const firstNewReview = reviews.items[current]

      pendingFocusReviewId.current = firstNewReview?.id ?? null
      setStatusMessage(
        reviews.totalCount > reviews.items.length
          ? `Showing ${formatReviewCount(next)} loaded on this page of ${formatReviewCount(reviews.totalCount)}.`
          : `Showing ${formatReviewCount(next)} of ${formatReviewCount(reviews.totalCount)}.`,
      )

      return next
    })
  }, [reviews.items, reviews.totalCount])

  return (
    <section className="space-y-5" aria-labelledby={headingId}>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Heading id={headingId} as="h2" align="left" size="h4" className="text-secondary">
            Patient Reviews
          </Heading>
          <span className="inline-flex items-center rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-sm leading-none font-semibold text-primary">
            {reviewCountText}
          </span>
        </div>

        <p className="max-w-3xl text-sm text-secondary/65">Only moderated patient reviews are shown.</p>
        {progressText ? (
          <p id={progressId} className="max-w-3xl text-sm text-secondary/55">
            {progressText}
          </p>
        ) : null}
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {statusMessage}
        </p>
      </div>

      {hasVisibleReviews ? (
        <ul className="grid list-none gap-4 p-0 lg:grid-cols-2">
          {visibleReviews.map((review) => (
            <li key={review.id} className="min-w-0">
              <ReviewCard review={review} focusRef={setReviewRef(review.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyReviewsPanel totalCount={reviews.totalCount} />
      )}

      {canShowMore ? (
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 w-full md:w-auto"
            aria-describedby={progressText ? progressId : undefined}
            onClick={showMoreReviews}
          >
            Show more reviews
          </Button>
        </div>
      ) : null}
    </section>
  )
}
