import { Button } from '@/components/atoms/button'
import { UiLink } from '@/components/molecules/Link'
import type { PreparationReceipt } from '@/features/inquiryPreparations/contracts'
import { Fragment, type ReactNode } from 'react'

const actionLinkClassName = 'inline-flex min-h-11 items-center text-foreground underline'

export type InquiryPreparationNoticesProps = {
  items: PreparationReceipt[]
  loading: string[]
  unknown?: string[]
  error?: string
  errors?: Record<string, string>
  onRetry: (reference: string) => void
  onCheckStatus?: (reference: string) => void
  renderSubmitted?: (item: PreparationReceipt) => ReactNode
}

export function InquiryPreparationNotices({
  items,
  loading,
  unknown = [],
  error,
  errors,
  onRetry,
  onCheckStatus,
  renderSubmitted,
}: InquiryPreparationNoticesProps) {
  if (!items.length && !error) return null
  return (
    <section aria-label="Inquiry submissions" className="min-w-0">
      {error ? (
        <p role="alert" className="px-4 py-3 text-sm text-muted-foreground">
          {error}
        </p>
      ) : null}
      <ul>
        {items.map((item) => {
          const busy = loading.includes(item.reference)
          const unresolved = item.status === 'outcome-unknown' || unknown.includes(item.reference)
          const completed = item.status === 'submitted'
          const submittedRow = completed ? renderSubmitted?.(item) : null
          if (submittedRow) return <Fragment key={item.reference}>{submittedRow}</Fragment>
          const clinic = item.clinicName || 'the clinic'
          const label = busy
            ? 'Checking delivery…'
            : completed
              ? 'Sent'
              : unresolved
                ? 'Delivery not confirmed'
                : item.status === 'sign-in-required'
                  ? 'Sign in to send'
                  : 'Not sent'
          return (
            <li
              key={item.reference}
              className="grid min-h-48 grid-cols-[3.75rem_minmax(0,1fr)] gap-3 border-b border-border/70 px-4 py-5 sm:grid-cols-[4.25rem_minmax(0,1fr)] lg:min-h-40"
            >
              <span
                aria-hidden="true"
                className="flex size-15 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-bold text-secondary sm:size-17"
              >
                {clinic
                  .split(/\s+/u)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')
                  .toUpperCase()}
              </span>
              <div className="min-w-0 space-y-2">
                <p className="truncate font-semibold text-foreground">{clinic}</p>
                <p role={completed ? undefined : 'status'} aria-atomic="true" className="text-sm text-muted-foreground">
                  <span className="sr-only">Inquiry to {clinic}: </span>
                  {label}
                </p>
                {!completed ? (
                  <p className="text-xs text-muted-foreground">
                    Saved until{' '}
                    <time dateTime={item.expiresAt}>
                      {new Date(item.expiresAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'UTC',
                      })}
                    </time>
                  </p>
                ) : null}
                {errors?.[item.reference] && !unresolved ? (
                  <p role="alert" className="text-sm text-muted-foreground">
                    {errors[item.reference]}
                  </p>
                ) : null}
                {completed && item.inquiryId ? (
                  <UiLink
                    appearance="inline"
                    className={actionLinkClassName}
                    href={`/patient/inquiries/${encodeURIComponent(item.inquiryId)}`}
                  >
                    View inquiry
                  </UiLink>
                ) : unresolved ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    className="min-h-11 px-0 text-primary"
                    onClick={() => onCheckStatus?.(item.reference)}
                  >
                    {busy ? 'Checking…' : 'Check status'}
                  </Button>
                ) : item.status === 'sign-in-required' ? (
                  <UiLink
                    appearance="inline"
                    className={actionLinkClassName}
                    href="/login/patient?next=/patient/inquiries"
                  >
                    Sign in to send your inquiry
                  </UiLink>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    className="min-h-11 px-0 text-primary"
                    onClick={() => onRetry(item.reference)}
                  >
                    {busy ? 'Sending…' : 'Try again'}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
