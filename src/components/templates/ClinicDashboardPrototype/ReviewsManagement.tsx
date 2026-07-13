'use client'

import { Alert, AlertDescription } from '@/components/atoms/alert'
import { Avatar, AvatarFallback } from '@/components/atoms/avatar'
import { Button } from '@/components/atoms/button'
import { Card, CardContent } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from '@/components/atoms/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/select'
import { RatingStars } from '@/components/molecules/RatingSummary'
import { cn } from '@/utilities/ui'
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Flag,
  History,
  Info,
  MessageSquareReply,
  NotebookPen,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react'

import { ClinicDashboardShell } from './ClinicDashboardShell'
import type { ClinicDashboardAction, ClinicDashboardShellData, ReviewItem, ReviewsManagementData } from './types'

type ClinicReviewsManagementProps = {
  data: ReviewsManagementData
  mobileNavigationOpen?: boolean
  onAction?: (action: ClinicDashboardAction) => void
  onMobileNavigationOpenChange?: (open: boolean) => void
  shell: ClinicDashboardShellData
}

const statusStyles: Record<ReviewItem['status'], string> = {
  answered: 'bg-accent/25 text-accent-foreground',
  open: 'bg-warning/70 text-secondary',
  'under-review': 'border border-destructive/40 bg-error/35 text-secondary',
}

const statusLabels: Record<ReviewItem['status'], string> = {
  answered: 'Beantwortet',
  open: 'Offen',
  'under-review': 'In Prüfung',
}

function ReviewsSummary({ data }: { data: ReviewsManagementData }) {
  return (
    <section aria-label="Bewertungsübersicht" className="grid gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-4">
        <CardContent className="flex h-full flex-col items-center justify-center p-8 text-center">
          <strong className="text-5xl tracking-tight text-secondary">{data.rating.toFixed(1)}</strong>
          <RatingStars className="mt-3" size="lg" value={data.rating} />
          <p className="mt-3 text-sm text-foreground/70">
            Basiert auf {new Intl.NumberFormat('en-US').format(data.totalReviews)} Bewertungen
          </p>
        </CardContent>
      </Card>
      <Card className="lg:col-span-8">
        <CardContent className="p-6">
          <Heading align="left" as="h2" className="mb-5 text-lg" size="h5">
            Bewertungsverteilung
          </Heading>
          <dl className="space-y-3">
            {data.distribution.map((entry) => (
              <div className="grid grid-cols-[2rem_1fr_4rem] items-center gap-3" key={entry.stars}>
                <dt className="text-sm font-bold">{entry.stars} ★</dt>
                <dd>
                  <div
                    aria-label={`${entry.stars} Sterne: ${entry.percent}%`}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={entry.percent}
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                  >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${entry.percent}%` }} />
                  </div>
                </dd>
                <dd className="text-right text-sm text-foreground/70">
                  {new Intl.NumberFormat('en-US').format(entry.count)}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </section>
  )
}

function ReviewsFilters({ data, onAction }: Pick<ClinicReviewsManagementProps, 'data' | 'onAction'>) {
  return (
    <section
      aria-label="Bewertungen filtern"
      className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
    >
      {data.filters.map((filter) => (
        <div className="min-w-0" key={filter.id}>
          <div className="mb-2 text-[11px] font-bold tracking-wide text-foreground/70 uppercase">{filter.label}</div>
          <Select onValueChange={() => onAction?.('filter-reviews')} value={filter.value}>
            <SelectTrigger aria-label={filter.label} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-1">
        <Button aria-label="Filter anwenden" onClick={() => onAction?.('filter-reviews')} size="icon" variant="outline">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
        </Button>
        <Button
          aria-label="Bewertungen aktualisieren"
          onClick={() => onAction?.('refresh-reviews')}
          size="icon"
          variant="outline"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </section>
  )
}

function ReviewCard({ review, onAction }: { onAction?: (action: ClinicDashboardAction) => void; review: ReviewItem }) {
  const underReview = review.status === 'under-review'
  return (
    <article
      className={cn(
        'rounded-lg border bg-card p-5 shadow-xs sm:p-6',
        underReview && 'border-destructive/30 bg-error/5',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarFallback className={cn(underReview && 'bg-error/30 text-secondary')}>
              {review.initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <Heading align="left" as="h2" className="text-base" size="h6">
              {review.author}
            </Heading>
            <div className="mt-1 flex items-center gap-2">
              <RatingStars value={review.rating} />
              <span className="text-xs text-foreground/70">{review.relativeDate}</span>
            </div>
          </div>
        </div>
        <span className={cn('rounded-full px-3 py-1 text-xs font-bold', statusStyles[review.status])}>
          {statusLabels[review.status]}
        </span>
      </div>
      <div className="mt-5">
        <span className="rounded bg-muted px-2 py-1 text-[11px] font-bold tracking-wide text-foreground/70 uppercase">
          {review.treatment}
        </span>
      </div>
      <p className={cn('mt-4 text-sm leading-6 sm:text-base', underReview && 'text-foreground/70 italic line-through')}>
        {review.body}
      </p>
      {review.response ? (
        <div className="mt-5 rounded-lg border-l-4 border-primary bg-muted/70 p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-bold text-foreground/70">
            <MessageSquareReply aria-hidden="true" className="size-4 text-primary" /> {review.response.label}
          </div>
          <p className="text-sm italic">{review.response.body}</p>
        </div>
      ) : null}
      {review.notice ? (
        <Alert className="mt-5" variant="error">
          <Info aria-hidden="true" className="size-4" />
          <AlertDescription>{review.notice}</AlertDescription>
        </Alert>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div className="flex flex-wrap gap-2">
          {review.status === 'answered' ? (
            <Button className="gap-2" onClick={() => onAction?.('edit-review-response')} size="sm" variant="link">
              <Edit3 aria-hidden="true" className="size-4" /> Antwort bearbeiten
            </Button>
          ) : review.status === 'open' ? (
            <Button className="gap-2" onClick={() => onAction?.('respond-to-review')} size="sm" variant="primary">
              <MessageSquareReply aria-hidden="true" className="size-4" /> Antworten
            </Button>
          ) : (
            <Button className="gap-2" disabled size="sm" variant="ghost">
              <MessageSquareReply aria-hidden="true" className="size-4" /> Antworten gesperrt
            </Button>
          )}
          {review.status !== 'under-review' ? (
            <Button className="gap-2" onClick={() => onAction?.('add-review-note')} size="sm" variant="ghost">
              <NotebookPen aria-hidden="true" className="size-4" /> Interne Notiz
            </Button>
          ) : (
            <Button className="gap-2" onClick={() => onAction?.('show-review-history')} size="sm" variant="ghost">
              <History aria-hidden="true" className="size-4" /> Verlauf anzeigen
            </Button>
          )}
        </div>
        {review.status === 'open' ? (
          <Button className="gap-2" onClick={() => onAction?.('appeal-review')} size="sm" variant="outline">
            <Flag aria-hidden="true" className="size-4" /> Einspruch einlegen
          </Button>
        ) : review.reference ? (
          <span className="text-xs font-bold text-foreground/70">Referenz: {review.reference}</span>
        ) : (
          <Button aria-label="Bewertung melden" onClick={() => onAction?.('flag-review')} size="icon" variant="ghost">
            <Flag aria-hidden="true" className="size-4" />
          </Button>
        )}
      </div>
    </article>
  )
}

function ReviewsPagination({ data, onAction }: Pick<ClinicReviewsManagementProps, 'data' | 'onAction'>) {
  const pages = Array.from({ length: data.pagination.totalPages }, (_, index) => index + 1)
  return (
    <div className="flex flex-col items-center justify-between gap-4 py-2 sm:flex-row">
      <span className="text-sm text-foreground/70">{data.pagination.label}</span>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationLink aria-label="Vorherige Seite" onClick={() => onAction?.('change-review-page')} type="button">
              <ChevronLeft aria-hidden="true" className="size-4" />
            </PaginationLink>
          </PaginationItem>
          {pages.map((page) => (
            <PaginationItem key={page}>
              <PaginationLink
                isActive={page === data.pagination.currentPage}
                onClick={() => onAction?.('change-review-page')}
                type="button"
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationLink aria-label="Nächste Seite" onClick={() => onAction?.('change-review-page')} type="button">
              <ChevronRight aria-hidden="true" className="size-4" />
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}

export function ClinicReviewsManagement({
  data,
  mobileNavigationOpen,
  onAction,
  onMobileNavigationOpenChange,
  shell,
}: ClinicReviewsManagementProps) {
  const headerActions = (
    <>
      <Button className="gap-2" onClick={() => onAction?.('export-reviews')} size="sm" variant="secondary">
        <Download aria-hidden="true" className="size-4" /> Exportieren
      </Button>
      <Button className="gap-2" onClick={() => onAction?.('create-appointment')} size="sm" variant="primary">
        <CalendarPlus aria-hidden="true" className="size-4" /> Neuer Termin
      </Button>
    </>
  )

  return (
    <ClinicDashboardShell
      activeSection="reviews"
      data={shell}
      headerActions={headerActions}
      mobileNavigationOpen={mobileNavigationOpen}
      onAction={onAction}
      onMobileNavigationOpenChange={onMobileNavigationOpenChange}
    >
      <div className="space-y-6">
        <header>
          <Heading align="left" as="h1" className="text-3xl sm:text-4xl" size="h2">
            Bewertungen
          </Heading>
          <p className="mt-2 text-foreground/70">
            Verwalten Sie das Feedback Ihrer Patienten und antworten Sie auf Rezensionen.
          </p>
        </header>
        <ReviewsSummary data={data} />
        <ReviewsFilters data={data} onAction={onAction} />
        <section aria-label="Rezensionen" className="space-y-4">
          {data.reviews.map((review) => (
            <ReviewCard key={review.id} onAction={onAction} review={review} />
          ))}
        </section>
        <ReviewsPagination data={data} onAction={onAction} />
      </div>
      <Button
        aria-label="Neuen Termin erstellen"
        className="fixed right-5 bottom-5 z-20 shadow-lg"
        onClick={() => onAction?.('create-appointment')}
        size="icon"
        variant="primary"
      >
        <Plus aria-hidden="true" className="size-5" />
      </Button>
    </ClinicDashboardShell>
  )
}
