import { AlertCircle, ChevronRight, Inbox } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/atoms/button'
import type { InquiryListItemDTO, PatientInquiryQueueDTO } from '@/features/inquiryCommunication/contracts'
import type { PatientInquiryFilter } from '@/features/patientInquiries/model'
import { cn } from '@/utilities/ui'

type PatientInquiryQueueProps = {
  data?: PatientInquiryQueueDTO
  error?: string
  filter: PatientInquiryFilter
  onFilterChange: (filter: PatientInquiryFilter) => void
  onRetry: () => void
  onSelect: (inquiryId: string) => void
  refreshError?: string
  selectedInquiryId?: string
  status: 'error' | 'idle' | 'loading' | 'ready'
}

const getInitials = (name: string): string =>
  name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CL'

const formatActivityTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
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
  onSelect,
  selected,
}: {
  item: InquiryListItemDTO
  onSelect: (inquiryId: string) => void
  selected: boolean
}) => (
  <li>
    <button
      type="button"
      aria-current={selected ? 'page' : undefined}
      data-inquiry-id={item.id}
      className={cn(
        'grid w-full grid-cols-[3.75rem_minmax(0,1fr)_auto] gap-3 border-b border-border/70 px-4 py-5 text-left transition-colors last:border-b-0 hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden sm:grid-cols-[4.25rem_minmax(0,1fr)_auto]',
        selected && 'bg-primary/5 shadow-[inset_3px_0_0_hsl(var(--primary))]',
      )}
      onClick={() => onSelect(item.id)}
    >
      <span
        className="flex size-15 items-center justify-center rounded-full border border-border bg-card text-sm font-bold text-secondary sm:size-17"
        aria-hidden="true"
      >
        {getInitials(item.clinic.displayName)}
      </span>
      <span className="min-w-0 space-y-2">
        <span className="block truncate font-semibold text-foreground">{item.clinic.displayName}</span>
        <span className="block truncate text-sm text-muted-foreground">{item.interest.label}</span>
        <span className="line-clamp-2 text-sm leading-6 text-foreground lg:hidden">{item.preview}</span>
        <StatusBadge lifecycle={item.lifecycle} />
      </span>
      <span className="flex min-h-full flex-col items-end justify-between gap-2 text-sm text-muted-foreground">
        <span>{formatActivityTime(item.lastActivityAt)}</span>
        {item.unread.count > 0 ? (
          <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
            {item.unread.count}
          </span>
        ) : null}
        <ChevronRight className="size-5" aria-hidden="true" />
      </span>
    </button>
  </li>
)

const QueueSkeleton = () => (
  <div aria-label="Loading inquiries" className="space-y-4 px-4 py-5" role="status">
    {[0, 1, 2].map((index) => (
      <div key={index} className="flex animate-pulse gap-4">
        <span className="size-15 shrink-0 rounded-full bg-muted" />
        <span className="flex-1 space-y-3 py-1">
          <span className="block h-4 w-3/5 rounded-[4px] bg-muted" />
          <span className="block h-3 w-2/5 rounded-[4px] bg-muted" />
          <span className="block h-5 w-16 rounded-[4px] bg-muted" />
        </span>
      </div>
    ))}
  </div>
)

export function PatientInquiryQueue({
  data,
  error,
  filter,
  onFilterChange,
  onRetry,
  onSelect,
  refreshError,
  selectedInquiryId,
  status,
}: PatientInquiryQueueProps) {
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const tabs: Array<{ count: number; label: string; value: PatientInquiryFilter }> = [
    { count: data?.counts.all ?? 0, label: 'All', value: 'all' },
    { count: data?.counts.open ?? 0, label: 'Open', value: 'open' },
    { count: data?.counts.closed ?? 0, label: 'Closed', value: 'closed' },
  ]

  const items = data?.items ?? []
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
      <div className="grid grid-cols-3 border-b border-border" role="tablist" aria-label="Filter inquiries">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={filter === tab.value}
            ref={(element) => {
              tabRefs.current[tabs.indexOf(tab)] = element
            }}
            className={cn(
              'relative flex min-h-12 items-center justify-center gap-2 px-2 text-sm font-semibold text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden',
              filter === tab.value &&
                'text-primary after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-primary',
            )}
            onClick={() => onFilterChange(tab.value)}
            onKeyDown={(event) => {
              const index = tabs.indexOf(tab)
              const nextIndex =
                event.key === 'ArrowRight'
                  ? (index + 1) % tabs.length
                  : event.key === 'ArrowLeft'
                    ? (index - 1 + tabs.length) % tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : null
              if (nextIndex === null) return
              event.preventDefault()
              const next = tabs[nextIndex]
              if (next) onFilterChange(next.value)
              tabRefs.current[nextIndex]?.focus()
            }}
          >
            {tab.label}
            <span
              className={cn(
                'rounded-full bg-muted px-2 py-0.5 text-xs',
                tab.value !== 'closed' && tab.count > 0 && 'bg-success/10 text-success',
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

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

      {status === 'loading' || status === 'idle' ? <QueueSkeleton /> : null}

      {status === 'error' ? (
        <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
          <AlertCircle className="mb-5 size-12 text-destructive" aria-hidden="true" />
          <h2 className="text-xl font-bold text-secondary">We couldn’t load your inquiries</h2>
          <p className="mt-2 text-muted-foreground">{error ?? 'Check your connection and try again.'}</p>
          <Button className="mt-6 min-w-52" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}

      {status === 'ready' && items.length === 0 ? (
        <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
          <span className="mb-5 flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Inbox className="size-9" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-bold text-secondary">No inquiries here</h2>
          <p className="mt-2 max-w-sm text-muted-foreground">
            {filter === 'all' ? 'Your clinic inquiries will appear here.' : `You have no ${filter} inquiries.`}
          </p>
        </div>
      ) : null}

      {status === 'ready' && items.length > 0 ? (
        <div className="lg:rounded-xl lg:border lg:border-border lg:bg-card lg:shadow-xs">
          {groups.map(([label, group]) =>
            group.length > 0 ? (
              <div key={label ?? 'filtered'}>
                {label ? <h2 className="px-1 pt-6 pb-3 text-lg font-semibold lg:hidden">{label}</h2> : null}
                <ul aria-label={label ? `${label} inquiries` : 'Inquiries'}>
                  {group.map((entry) => (
                    <InquiryRow
                      key={entry.id}
                      item={entry}
                      onSelect={onSelect}
                      selected={entry.id === selectedInquiryId}
                    />
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      ) : null}
    </section>
  )
}
