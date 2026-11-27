import { AlertCircle, ChevronRight, Inbox, LoaderCircle, LockKeyhole } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { Button } from '@/components/atoms/button'
import {
  InquiryPreparationNotices,
  type InquiryPreparationNoticesProps,
} from '@/components/organisms/InquiryPreparationNotices/Component'
import type { InquiryListItemDTO, PatientInquiryQueueDTO } from '@/features/inquiryCommunication/contracts'
import type { PatientInquiryFilter } from '@/features/patientInquiries/model'
import { cn } from '@/utilities/ui'

type PatientInquiryQueueProps = {
  data?: PatientInquiryQueueDTO
  error?: string
  filter: PatientInquiryFilter
  onFilterChange: (filter: PatientInquiryFilter) => void
  onLoadMore: () => void
  onRetry: () => void
  onSelect: (inquiryId: string) => void
  loadMoreError?: string
  loadingMore: boolean
  now?: Date
  refreshError?: string
  selectedInquiryId?: string
  status: 'error' | 'idle' | 'loading' | 'ready'
  preparations?: InquiryPreparationNoticesProps & { announcement?: string }
}

const getInitials = (name: string): string =>
  name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CL'

const formatActivityTime = (value: string, now: Date): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const day = new Intl.DateTimeFormat('en-CA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
  const today = new Intl.DateTimeFormat('en-CA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(now)
  if (day === today) return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const previous = new Intl.DateTimeFormat('en-CA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    yesterday,
  )
  if (day === previous) return 'Yesterday'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date)
}

const StatusBadge = ({ lifecycle }: Pick<InquiryListItemDTO, 'lifecycle'>) => (
  <span
    className={cn(
      'inline-flex w-fit items-center gap-2 rounded-md px-2.5 py-1 text-xs font-semibold',
      lifecycle === 'open' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
    )}
  >
    <span className={cn('size-2 rounded-full', lifecycle === 'open' ? 'bg-success' : 'bg-muted-foreground')} />
    {lifecycle === 'open' ? 'Open' : 'Closed'}
  </span>
)

const InquiryRow = ({
  item,
  now,
  onSelect,
  selected,
}: {
  item: InquiryListItemDTO
  now: Date
  onSelect: (inquiryId: string) => void
  selected: boolean
}) => (
  <li>
    <Link
      href={`/patient/inquiries/${encodeURIComponent(item.id)}`}
      aria-current={selected ? 'page' : undefined}
      data-inquiry-id={item.id}
      className={cn(
        'grid w-full grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 px-4 py-4 text-left transition-colors hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden',
        selected && 'bg-primary/5 shadow-[inset_3px_0_0_hsl(var(--primary))]',
      )}
      onClick={(event) => {
        if (
          event.button === 0 &&
          !event.defaultPrevented &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          onSelect(item.id)
        }
      }}
    >
      <span
        className="row-span-2 flex size-10 items-center justify-center rounded-full border border-border bg-card text-xs font-bold text-secondary"
        aria-hidden="true"
      >
        {getInitials(item.clinic.displayName)}
      </span>
      <span className="col-start-2 min-w-0 space-y-1.5">
        <span className="block leading-5 font-semibold wrap-anywhere text-foreground">{item.clinic.displayName}</span>
        <span className="block text-sm leading-5 wrap-anywhere text-muted-foreground">{item.interest.label}</span>
        <span className="line-clamp-2 text-sm leading-6 text-foreground lg:hidden">{item.preview}</span>
      </span>
      <span className="col-start-2 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground sm:gap-2">
        <StatusBadge lifecycle={item.lifecycle} />
        {item.moderationBadge?.conversationRestricted ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-warning/15 px-2.5 py-1 text-xs font-semibold text-foreground">
            <LockKeyhole className="size-3.5" aria-hidden="true" /> Restricted
          </span>
        ) : null}
        <time dateTime={item.lastActivityAt}>{formatActivityTime(item.lastActivityAt, now)}</time>
        {item.unread.count > 0 ? (
          <span
            aria-label={`${item.unread.count} unread ${item.unread.count === 1 ? 'message' : 'messages'}`}
            className="inline-flex min-w-7 items-center justify-center rounded-full bg-primary px-2 py-1 text-xs font-bold text-primary-foreground"
          >
            {item.unread.count}
          </span>
        ) : null}
        <ChevronRight className="ml-auto size-5" aria-hidden="true" />
      </span>
    </Link>
  </li>
)

const queueStatusCard =
  'mt-4 flex min-h-64 flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-5 text-center shadow-xs'
const queueErrorTitle = 'We couldn’t load your inquiries'
const emptyQueueTitle = 'No inquiries here'

const QueueLoading = () => (
  <div aria-label="Loading inquiries" className={queueStatusCard} role="status">
    <p className="inline-flex items-center gap-3 text-sm text-secondary">
      <LoaderCircle className="size-5 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
      Loading inquiries…
    </p>
  </div>
)

export function PatientInquiryQueue({
  data,
  error,
  filter,
  loadMoreError,
  loadingMore,
  now = new Date(),
  onFilterChange,
  onLoadMore,
  onRetry,
  onSelect,
  refreshError,
  selectedInquiryId,
  status,
  preparations,
}: PatientInquiryQueueProps) {
  const selectedFilterRef = React.useRef<HTMLButtonElement>(null)
  const preparedItems = preparations?.items ?? []
  const preparedInquiryIds = new Set(preparedItems.flatMap((item) => (item.inquiryId ? [item.inquiryId] : [])))
  const unsubmittedCount = preparedItems.filter((item) => item.status !== 'submitted').length
  const submittedCount = preparedItems.length - unsubmittedCount
  const tabs: Array<{ count: number; label: string; value: PatientInquiryFilter }> = [
    { count: Math.max(data?.counts.all ?? 0, submittedCount) + unsubmittedCount, label: 'All', value: 'all' },
    { count: data?.counts.open ?? 0, label: 'Open', value: 'open' },
    { count: data?.counts.closed ?? 0, label: 'Closed', value: 'closed' },
  ]

  const items = (data?.items ?? []).filter((item) => filter !== 'all' || !preparedInquiryIds.has(item.id))
  const showEmptyState = status === 'ready' && items.length === 0 && !(filter === 'all' && preparedItems.length)
  const emptyMessage = filter === 'all' ? 'Your clinic inquiries will appear here.' : `You have no ${filter} inquiries.`
  const errorMessage = error ?? 'Check your connection and try again.'
  const openItems = items.filter((item) => item.lifecycle === 'open')
  const closedItems = items.filter((item) => item.lifecycle === 'closed')
  const groups =
    filter === 'all'
      ? ([
          ['Open', openItems],
          ['Closed', closedItems],
        ] as const)
      : ([[undefined, items]] as const)

  return (
    <section aria-label="Patient inquiry list" className="min-w-0">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {status === 'error' ? `${queueErrorTitle}. ${errorMessage}` : showEmptyState ? emptyMessage : ''}
      </p>
      <div className="grid grid-cols-3 border-b border-border" aria-label="Filter inquiries">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            ref={filter === tab.value ? selectedFilterRef : undefined}
            type="button"
            aria-pressed={filter === tab.value}
            className={cn(
              'relative flex min-h-12 items-center justify-center gap-2 px-2 text-sm font-semibold text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden',
              filter === tab.value &&
                'text-primary after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-primary',
            )}
            onClick={() => onFilterChange(tab.value)}
          >
            {tab.label}
            {data && status === 'ready' ? (
              <span
                className={cn(
                  'rounded-full bg-muted px-2 py-0.5 text-xs',
                  tab.value !== 'closed' && tab.count > 0 && 'bg-success/10 text-success',
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {preparations ? (
        <p className="sr-only" role="status" aria-atomic="true">
          {preparations.announcement}
        </p>
      ) : null}
      {filter === 'all' && preparations ? (
        <InquiryPreparationNotices
          {...preparations}
          items={preparedItems}
          renderSubmitted={(prepared) => {
            const item = data?.items.find((entry) => entry.id === prepared.inquiryId)
            return item ? (
              <InquiryRow item={item} now={now} onSelect={onSelect} selected={item.id === selectedInquiryId} />
            ) : null
          }}
        />
      ) : null}

      {refreshError ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 border-b border-border bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <span>{refreshError}</span>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}

      {(status === 'loading' || status === 'idle') && !preparedItems.length ? <QueueLoading /> : null}

      {status === 'error' ? (
        <div className={queueStatusCard}>
          <AlertCircle className="mb-3 size-8 text-destructive" aria-hidden="true" />
          <Heading as="h2" align="center" size="h5" className="text-xl text-secondary" tabIndex={-1}>
            {queueErrorTitle}
          </Heading>
          <p className="mt-2 text-muted-foreground">{errorMessage}</p>
          <Button
            className="mt-3 min-h-11 w-full max-w-52"
            onClick={(event) => {
              if (event.detail === 0) selectedFilterRef.current?.focus()
              onRetry()
            }}
          >
            Try again
          </Button>
        </div>
      ) : null}

      {showEmptyState ? (
        <div className={queueStatusCard}>
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Inbox className="size-6" aria-hidden="true" />
          </span>
          <Heading as="h2" align="center" size="h5" className="text-xl text-secondary">
            {emptyQueueTitle}
          </Heading>
          <p className="mt-2 max-w-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : null}

      {status === 'ready' && (items.length > 0 || Boolean(data?.nextCursor)) ? (
        <div className="lg:rounded-xl lg:border lg:border-border lg:bg-card lg:shadow-xs">
          {groups.map(([label, group]) =>
            group.length > 0 ? (
              <div key={label ?? 'filtered'}>
                {label ? (
                  <Heading as="h2" align="left" size="h6" className="px-1 pt-6 pb-3 text-lg lg:hidden">
                    {label}
                  </Heading>
                ) : null}
                <ul aria-label={label ? `${label} inquiries` : 'Inquiries'}>
                  {group.map((entry) => (
                    <InquiryRow
                      key={entry.id}
                      item={entry}
                      now={now}
                      onSelect={onSelect}
                      selected={entry.id === selectedInquiryId}
                    />
                  ))}
                </ul>
              </div>
            ) : null,
          )}
          {data?.nextCursor ? (
            <div className="space-y-2 border-t border-border p-4 text-center">
              {loadMoreError ? (
                <p role="alert" className="text-sm text-destructive">
                  {loadMoreError}
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="min-h-11 min-w-52"
                disabled={loadingMore}
                onClick={onLoadMore}
              >
                {loadingMore ? 'Loading more…' : 'Load more inquiries'}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
