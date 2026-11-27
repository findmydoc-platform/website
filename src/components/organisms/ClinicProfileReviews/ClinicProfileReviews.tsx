'use client'

import * as React from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/atoms/button'
import { Heading } from '@/components/atoms/Heading'
import { Input } from '@/components/atoms/input'
import { RatingStars } from '@/components/molecules/RatingSummary'
import type { ClinicDetailReview, ClinicDetailReviews } from '@/features/clinicDetail/contracts'

const PAGE_SIZE = 6
const dateFormatter = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

function ReviewEntry({ review }: { review: ClinicDetailReview }) {
  const name = review.authorName?.trim() || 'Patient'
  return (
    <article className="space-y-4 border-t border-border py-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-secondary"
        >
          {name.charAt(0).toLocaleUpperCase()}
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold [overflow-wrap:anywhere]">{name}</p>
          <time dateTime={review.reviewDate} className="text-xs text-muted-foreground">
            {dateFormatter.format(new Date(review.reviewDate))}
          </time>
        </div>
        <RatingStars value={review.ratingValue} />
      </div>
      {review.kind === 'text' ? (
        <>
          <p className="text-sm leading-7 [overflow-wrap:anywhere] whitespace-pre-line text-muted-foreground">
            {review.comment}
          </p>
          {review.notice ? <ReviewNotice notice={review.notice} /> : null}
          {review.response ? (
            <details className="rounded-xl bg-primary/5 text-sm text-primary">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                Read the clinic's response <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
              </summary>
              <div className="space-y-2 px-4 pb-4 text-secondary">
                <p className="font-semibold [overflow-wrap:anywhere]">{review.response.clinicName}</p>
                <time className="text-xs text-muted-foreground" dateTime={review.response.approvedAt}>
                  {dateFormatter.format(new Date(review.response.approvedAt))}
                </time>
                <p className="leading-6 [overflow-wrap:anywhere] whitespace-pre-line">{review.response.body}</p>
              </div>
            </details>
          ) : null}
        </>
      ) : null}
      {review.kind === 'placeholder' ? <ReviewNotice notice={review.notice} unavailable /> : null}
    </article>
  )
}

function ReviewNotice({ notice, unavailable = false }: { notice: string; unavailable?: boolean }) {
  return (
    <div
      role="note"
      aria-label={unavailable ? 'Review text unavailable' : 'Review moderation notice'}
      className="rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm leading-6 [overflow-wrap:anywhere] text-secondary/75"
    >
      {notice}
    </div>
  )
}

export type ClinicProfileReviewsProps = { ratingValue: number | null; reviews: ClinicDetailReviews }

export function ClinicProfileReviews({ ratingValue, reviews }: ClinicProfileReviewsProps) {
  const [query, setQuery] = React.useState('')
  const [rating, setRating] = React.useState('all')
  const [sort, setSort] = React.useState('newest')
  const [page, setPage] = React.useState(1)
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const ratingRef = React.useRef<HTMLSelectElement>(null)
  const resultsRef = React.useRef<HTMLParagraphElement>(null)
  const filterId = React.useId()
  React.useEffect(() => {
    const mobile = window.matchMedia('(max-width: 639px)')
    const keepFocusedFilterVisible = () => {
      if (mobile.matches && document.activeElement === ratingRef.current) setFiltersOpen(true)
    }
    mobile.addEventListener('change', keepFocusedFilterVisible)
    return () => mobile.removeEventListener('change', keepFocusedFilterVisible)
  }, [])
  const results = React.useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    return reviews.items
      .filter((review) => {
        const publicText = [review.authorName, review.kind === 'text' ? review.comment : '', review.notice]
          .filter(Boolean)
          .join(' ')
        return (
          (rating === 'all' || review.ratingValue === Number(rating)) && publicText.toLocaleLowerCase().includes(term)
        )
      })
      .sort((a, b) =>
        sort === 'highest'
          ? b.ratingValue - a.ratingValue
          : sort === 'lowest'
            ? a.ratingValue - b.ratingValue
            : b.reviewDate.localeCompare(a.reviewDate),
      )
  }, [query, rating, reviews.items, sort])
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * PAGE_SIZE
  const visible = results.slice(start, start + PAGE_SIZE)
  const partial = reviews.totalCount > reviews.items.length || reviews.hasMore === true
  const changePage = (next: number) => {
    setPage(next)
    requestAnimationFrame(() => resultsRef.current?.focus())
  }
  const reset = () => {
    setQuery('')
    setRating('all')
    setSort('newest')
    setPage(1)
    requestAnimationFrame(() => searchRef.current?.focus())
  }

  return (
    <section aria-labelledby={`${filterId}-heading`}>
      <Heading id={`${filterId}-heading`} as="h2" size="h4" align="left" className="text-secondary">
        Reviews
      </Heading>
      {reviews.totalCount === 0 ? (
        <p className="mt-6 text-sm leading-6 text-muted-foreground">No reviews have been published yet.</p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-5">
            {ratingValue !== null ? (
              <strong className="text-5xl tracking-tight">
                {ratingValue.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">/ 5</span>
              </strong>
            ) : null}
            <div className="space-y-2">
              {ratingValue !== null ? <RatingStars value={ratingValue} /> : null}
              <p className="text-xs text-muted-foreground">
                {reviews.totalCount} patient {reviews.totalCount === 1 ? 'review' : 'reviews'}
              </p>
            </div>
          </div>
          {!reviews.items.length ? (
            <p className="mt-8 text-sm leading-6 text-muted-foreground">
              Published reviews are not available to display on this page.
            </p>
          ) : (
            <div className="mt-8">
              {partial ? (
                <p className="mb-2 text-sm text-muted-foreground">
                  Browsing {reviews.items.length} loaded {reviews.items.length === 1 ? 'review' : 'reviews'} of{' '}
                  {reviews.totalCount} published reviews. Additional reviews are not available here.
                </p>
              ) : null}
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  ref={searchRef}
                  type="search"
                  aria-label="Search reviews"
                  placeholder="Search reviews"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setPage(1)
                  }}
                  className="h-12 rounded-full pl-11"
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="col-start-1 row-start-1 min-h-12 rounded-full sm:hidden"
                  aria-expanded={filtersOpen}
                  aria-controls={`${filterId}-rating`}
                  onClick={() => setFiltersOpen((open) => !open)}
                >
                  Filters{rating !== 'all' ? ' (1)' : ''}
                </Button>
                <label
                  id={`${filterId}-rating`}
                  className={`${filtersOpen ? 'block' : 'hidden'} col-span-2 text-left text-xs font-normal text-muted-foreground sm:col-span-1 sm:block`}
                >
                  Rating
                  <select
                    ref={ratingRef}
                    aria-label="Filter reviews by rating"
                    className="mt-2 h-12 w-full rounded-full border border-input bg-background px-3 text-sm font-normal text-secondary focus-visible:ring-2 focus-visible:ring-ring"
                    value={rating}
                    onChange={(event) => {
                      setRating(event.target.value)
                      setPage(1)
                    }}
                  >
                    <option value="all">All ratings</option>
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option key={value} value={value}>
                        {value} stars
                      </option>
                    ))}
                  </select>
                </label>
                <label className="col-start-2 row-start-1 text-left text-xs font-normal text-muted-foreground sm:col-auto sm:row-auto">
                  <span className="sr-only sm:not-sr-only">Sort by</span>
                  <select
                    aria-label="Sort reviews"
                    className="h-12 w-full rounded-full border border-input bg-background px-3 text-xs font-normal text-secondary focus-visible:ring-2 focus-visible:ring-ring sm:mt-2 sm:text-sm"
                    value={sort}
                    onChange={(event) => {
                      setSort(event.target.value)
                      setPage(1)
                    }}
                  >
                    <option value="newest">Most recent</option>
                    <option value="highest">Highest rated</option>
                    <option value="lowest">Lowest rated</option>
                  </select>
                </label>
              </div>
              <p
                ref={resultsRef}
                tabIndex={-1}
                role="status"
                aria-live="polite"
                className="mt-4 mb-4 text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {results.length
                  ? `${start + 1}–${start + visible.length} of ${results.length} loaded reviews`
                  : 'No loaded reviews match these filters.'}
              </p>
              {visible.length ? (
                visible.map((review) => <ReviewEntry key={review.id} review={review} />)
              ) : (
                <Button type="button" variant="outline" onClick={reset}>
                  Clear filters
                </Button>
              )}
              {pageCount > 1 ? (
                <nav
                  aria-label="Review pages"
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5"
                >
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Previous page"
                    className="px-3 sm:px-4"
                    disabled={currentPage === 1}
                    onClick={() => changePage(currentPage - 1)}
                  >
                    <ChevronLeft aria-hidden="true" className="size-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>
                  <div className="flex flex-wrap items-center gap-1">
                    {Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, pageCount]))
                      .filter((number) => number > 0 && number <= pageCount)
                      .sort((a, b) => a - b)
                      .map((number, index, numbers) => (
                        <React.Fragment key={number}>
                          {index > 0 && number - numbers[index - 1]! > 1 ? <span aria-hidden="true">…</span> : null}
                          <Button
                            type="button"
                            variant={number === currentPage ? 'secondary' : 'ghost'}
                            size="icon"
                            aria-label={`Page ${number}`}
                            aria-current={number === currentPage ? 'page' : undefined}
                            onClick={() => changePage(number)}
                          >
                            {number}
                          </Button>
                        </React.Fragment>
                      ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Next page"
                    className="px-3 sm:px-4"
                    disabled={currentPage === pageCount}
                    onClick={() => changePage(currentPage + 1)}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </Button>
                </nav>
              ) : null}
            </div>
          )}
        </>
      )}
    </section>
  )
}
