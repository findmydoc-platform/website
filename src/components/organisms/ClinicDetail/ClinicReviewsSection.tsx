'use client'

import * as React from 'react'
import { CheckCircle2, Info } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { Card, CardContent } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { RatingStars } from '@/components/molecules/RatingSummary'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover'
import { cn } from '@/utilities/ui'

import type { ClinicDetailReview, ClinicDetailReviews } from '@/features/clinicDetail/contracts'
import type { ClinicReviewsCopy } from '@/features/clinicDetail/reviewsCopy'

type ReviewsCopyProps = { copy: ClinicReviewsCopy }

type ClinicReviewsSectionProps = ReviewsCopyProps & {
  ratingValue: number | null
  submission?: React.ReactNode
  reviews: ClinicDetailReviews
}

const INITIAL_VISIBLE_REVIEW_COUNT = 4
const REVIEW_LOAD_INCREMENT = 4
const MAX_VISIBLE_REVIEW_COUNT = 16
const COLLAPSIBLE_RESPONSE_MIN_LENGTH = 360
function getAuthorName(review: ClinicDetailReview): string {
  return typeof review.authorName === 'string' ? review.authorName.trim() : ''
}

function ReviewRatingStars({
  copy,
  value,
  showValue = true,
  size = 'sm',
}: ReviewsCopyProps & {
  value: number
  showValue?: boolean
  size?: 'sm' | 'lg'
}) {
  return (
    <RatingStars
      value={value}
      valueText={copy.formatRating(value)}
      label={copy.ratingLabel(value)}
      showValue={showValue}
      size={size}
      emptyStarClassName="fill-primary/15 text-primary/15"
    />
  )
}

function getReviewerLabel(review: ClinicDetailReview, copy: ClinicReviewsCopy): string {
  return getAuthorName(review) || copy.anonymous
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function VerifiedReviewsInfo({ copy, count }: ReviewsCopyProps & { count: number }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span>{copy.verifiedCount(count)}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="min-h-11 min-w-11 rounded-full p-0 text-primary hover:bg-primary/8 sm:min-h-10 sm:min-w-10"
            aria-label={copy.verifiedInfoLabel}
          >
            <Info className="size-4" aria-hidden={true} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] rounded-xl border-primary/15 text-sm leading-6 text-secondary/75 shadow-brand-soft">
          {copy.verifiedInfo}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function ReviewMeta({ copy, review }: ReviewsCopyProps & { review: ClinicDetailReview }) {
  return (
    <div className="space-y-2">
      <ReviewRatingStars copy={copy} value={review.ratingValue} />
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600">
        <CheckCircle2 className="size-4" aria-hidden={true} />
        {copy.verifiedReview}
      </span>
    </div>
  )
}

function ReviewerAvatar({ copy, review }: ReviewsCopyProps & { review: ClinicDetailReview }) {
  return (
    <div
      aria-hidden={true}
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary sm:size-14 sm:text-lg"
    >
      {getInitials(getReviewerLabel(review, copy))}
    </div>
  )
}

function ReviewerIdentity({ copy, review }: ReviewsCopyProps & { review: ClinicDetailReview }) {
  const reviewerLabel = getReviewerLabel(review, copy)
  const formattedDate = copy.formatDate(review.reviewDate)

  return (
    <div className="min-w-0 space-y-1">
      <p className="text-base font-semibold [overflow-wrap:anywhere] text-secondary">{reviewerLabel}</p>
      <p className="text-sm font-medium text-secondary/65">{copy.patient}</p>
      <time className="block text-sm font-medium text-secondary/55" dateTime={review.reviewDate}>
        {formattedDate}
      </time>
    </div>
  )
}

function ClinicResponse({ copy, review }: ReviewsCopyProps & { review: ClinicDetailReview }) {
  const responseBodyId = `${React.useId()}-body`
  const [isExpanded, setIsExpanded] = React.useState(false)
  const response = review.kind === 'text' ? review.response : undefined
  if (!response) return null

  const canCollapse = response.body.length > COLLAPSIBLE_RESPONSE_MIN_LENGTH

  return (
    <div role="group" aria-label={copy.clinicResponse} className="border-t border-primary/10 pt-5 sm:pt-6">
      <div className="min-w-0 space-y-3">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-semibold text-teal-600"
            aria-hidden={true}
          >
            {getInitials(response.clinicName)}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-medium text-primary">{copy.clinicResponse}</span>
              <span className="h-4 w-px bg-primary/15" aria-hidden={true} />
              <time className="text-secondary/55" dateTime={response.approvedAt}>
                {copy.formatDate(response.approvedAt)}
              </time>
            </div>
          </div>
        </div>
        <p
          id={responseBodyId}
          className={cn(
            'max-w-3xl text-base leading-7 [overflow-wrap:anywhere] whitespace-pre-wrap text-secondary/75 sm:ml-16',
            canCollapse && !isExpanded && 'max-h-[10.5rem] overflow-hidden sm:max-h-none sm:overflow-visible',
          )}
        >
          {response.body}
        </p>
        {canCollapse ? (
          <Button
            type="button"
            variant="link"
            size="clear"
            className="min-h-11 px-0 text-sm font-semibold underline decoration-1 underline-offset-4 hover:decoration-2 focus-visible:decoration-2 focus-visible:ring-0 focus-visible:ring-offset-0 sm:hidden"
            aria-controls={responseBodyId}
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? copy.collapseResponse : copy.expandResponse}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function ReviewModerationNotice({ copy, review }: ReviewsCopyProps & { review: ClinicDetailReview }) {
  const placeholder = review.kind === 'placeholder'
  const notice = placeholder ? undefined : review.notice
  if (!placeholder && !notice) return null

  const context = notice?.kind === 'context' ? notice : undefined
  return (
    <div
      role="note"
      aria-label={placeholder ? copy.unavailableLabel : copy.moderationLabel}
      className={cn(
        'flex max-w-3xl items-start gap-3 rounded-xl border p-4 text-sm leading-6 [overflow-wrap:anywhere]',
        placeholder
          ? 'border-primary/15 bg-primary/5 text-secondary/70'
          : 'border-amber-200/80 bg-amber-50/70 text-secondary/75',
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0 text-primary/70" aria-hidden={true} />
      <div>
        {context && <p className="font-semibold">{copy.contextWording}</p>}
        <p className="whitespace-pre-wrap">
          {context?.text ?? (placeholder ? copy.moderationPlaceholder : copy.moderationRedaction)}
        </p>
      </div>
    </div>
  )
}

function ReviewListItem({
  copy,
  review,
  focusRef,
  isFirst = false,
  isLast = false,
}: ReviewsCopyProps & {
  review: ClinicDetailReview
  focusRef?: React.Ref<HTMLElement>
  isFirst?: boolean
  isLast?: boolean
}) {
  const formattedDate = copy.formatDate(review.reviewDate)
  const reviewerLabel = getReviewerLabel(review, copy)
  const articleLabel = copy.itemLabel(reviewerLabel, formattedDate, review.kind === 'placeholder')

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
        <ReviewerAvatar copy={copy} review={review} />
        <div className="min-w-0 space-y-4">
          <ReviewerIdentity copy={copy} review={review} />
          <ReviewMeta copy={copy} review={review} />
        </div>
      </div>
      <div className="min-w-0 space-y-6">
        {review.kind === 'text' ? (
          <p className="max-w-3xl text-base leading-7 [overflow-wrap:anywhere] whitespace-pre-wrap text-secondary/80">
            {review.comment}
          </p>
        ) : null}
        <ReviewModerationNotice copy={copy} review={review} />
        <ClinicResponse copy={copy} review={review} />
      </div>
    </article>
  )
}

function LatestReview({ copy, review }: ReviewsCopyProps & { review: ClinicDetailReview }) {
  return (
    <article className="space-y-5 rounded-2xl border border-primary/20 bg-background p-5 shadow-none sm:p-6 lg:p-8">
      <div className="space-y-4">
        <p className="text-base font-semibold text-primary">{copy.latest}</p>
        <ReviewRatingStars copy={copy} value={review.ratingValue} size="lg" />
        {review.kind === 'text' ? (
          <blockquote className="max-w-3xl text-lg leading-8 font-normal [overflow-wrap:anywhere] whitespace-pre-wrap text-secondary sm:text-xl sm:leading-9">
            {review.comment}
          </blockquote>
        ) : null}
        <ReviewModerationNotice copy={copy} review={review} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-primary/10 pt-4">
        <ReviewerAvatar copy={copy} review={review} />
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm text-secondary/60">
          <p className="font-semibold [overflow-wrap:anywhere] text-secondary">{getReviewerLabel(review, copy)}</p>
          <span className="hidden h-5 w-px bg-primary/15 sm:block" aria-hidden={true} />
          <span className="inline-flex items-center gap-1.5 font-semibold text-teal-600">
            <CheckCircle2 className="size-4" aria-hidden={true} />
            {copy.verifiedReview}
          </span>
          <span className="hidden h-5 w-px bg-primary/15 sm:block" aria-hidden={true} />
          <time dateTime={review.reviewDate}>{copy.formatDate(review.reviewDate)}</time>
        </div>
      </div>
      <ClinicResponse copy={copy} review={review} />
    </article>
  )
}

function ReviewsSummary({
  copy,
  ratingValue,
  count,
}: ReviewsCopyProps & { ratingValue: number | null; count: number }) {
  const hasRating = ratingValue !== null && count > 0

  return (
    <div className="space-y-4">
      {hasRating ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-6xl leading-none font-semibold tracking-normal text-primary sm:text-7xl">
              {copy.formatRating(ratingValue)}
            </span>
            <span className="text-3xl font-semibold text-secondary/55">/ 5</span>
          </div>
          <ReviewRatingStars copy={copy} value={ratingValue} showValue={false} size="lg" />
        </>
      ) : (
        <p className="text-2xl font-semibold text-secondary">{copy.empty}</p>
      )}
      <div className="text-base font-semibold text-secondary">
        <VerifiedReviewsInfo copy={copy} count={count} />
      </div>
      <p className="max-w-sm text-sm leading-6 text-secondary/60">{copy.onlyVerified}</p>
    </div>
  )
}

function EmptyReviewsPanel({ copy, totalCount }: ReviewsCopyProps & { totalCount: number }) {
  const hasApprovedCount = totalCount > 0

  return (
    <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5 sm:p-6">
      <Heading as="h3" align="left" size="h5" className="text-secondary">
        {hasApprovedCount ? copy.preparing : copy.empty}
      </Heading>
      <p className="mt-2 text-base leading-7 text-secondary/65">
        {hasApprovedCount ? copy.preparingDescription : copy.emptyDescription}
      </p>
    </div>
  )
}

export function ClinicReviewsSection({ copy, ratingValue, reviews, submission }: ClinicReviewsSectionProps) {
  const sectionId = React.useId()
  const headingId = `${sectionId}-heading`
  const progressId = `${sectionId}-progress`
  const [visibleCount, setVisibleCount] = React.useState(INITIAL_VISIBLE_REVIEW_COUNT)
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
    ? copy.progress(visibleReviews.length, reviews.totalCount, hasMoreReviewsThanLoaded)
    : hasApprovedReviewsWithoutDisplayableText
      ? copy.preparingCount(reviews.totalCount)
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

  function showMoreReviews() {
    pendingFocusReviewId.current = reviews.items[visibleCount]?.id ?? null
    setVisibleCount(Math.min(visibleCount + REVIEW_LOAD_INCREMENT, visibleLimit))
  }

  return (
    <section aria-labelledby={headingId} data-testid="clinic-reviews-section">
      <Card className="rounded-3xl border-primary/15 bg-background shadow-brand-soft">
        <CardContent className="space-y-6 p-5 sm:p-8 lg:p-10">
          <div className="space-y-2">
            <Heading id={headingId} as="h2" align="left" size="content-section" variant="navy">
              {copy.heading}
            </Heading>
            <p id={progressId} className="max-w-3xl text-sm text-supporting-foreground">
              {progressText ?? copy.emptyCount(reviews.totalCount)}
            </p>
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {visibleCount > INITIAL_VISIBLE_REVIEW_COUNT ? progressText : null}
            </p>
            {visibleReviews.some(({ kind }) => kind === 'text') ? (
              <p className="text-sm text-supporting-foreground">{copy.originalWording}</p>
            ) : null}
          </div>

          {featuredReview ? (
            <div className="grid gap-6 border-y border-primary/10 py-6 lg:grid-cols-[minmax(16rem,0.33fr)_minmax(0,1fr)] lg:gap-12 lg:py-8">
              <ReviewsSummary copy={copy} ratingValue={ratingValue} count={reviews.totalCount} />
              <div className="lg:border-l lg:border-primary/10 lg:pl-12">
                <LatestReview copy={copy} review={featuredReview} />
              </div>
            </div>
          ) : (
            <EmptyReviewsPanel copy={copy} totalCount={reviews.totalCount} />
          )}

          {listedReviews.length ? (
            <div className="space-y-4">
              <p className="text-sm font-semibold tracking-[0.12em] text-secondary/50 uppercase">{copy.listHeading}</p>
              <div
                className="divide-y divide-primary/10 rounded-2xl border border-primary/15 px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6"
                role="list"
              >
                {listedReviews.map((review, index) => (
                  <div key={review.id} role="listitem">
                    <ReviewListItem
                      copy={copy}
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
                {copy.showMore}
              </Button>
              <p className="text-sm text-secondary/55">{copy.showMoreHint(nextVisibleReviewCount)}</p>
            </div>
          ) : null}
          {submission}
        </CardContent>
      </Card>
    </section>
  )
}
