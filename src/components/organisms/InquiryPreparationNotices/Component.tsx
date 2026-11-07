import { Alert } from '@/components/atoms/alert'
import { Button } from '@/components/atoms/button'
import { UiLink } from '@/components/molecules/Link'
import { cn } from '@/utilities/ui'
import type { PreparationReceipt } from '@/features/inquiryPreparations/contracts'

export function InquiryPreparationNotices({
  items,
  loading,
  unknown = [],
  error,
  errors,
  onRetry,
  onCheckStatus,
}: {
  items: PreparationReceipt[]
  loading: string[]
  unknown?: string[]
  error?: string
  errors?: Record<string, string>
  onRetry: (reference: string) => void
  onCheckStatus?: (reference: string) => void
}) {
  if (!items.length && !error) return null
  return (
    <section
      aria-label={items.some((item) => item.status !== 'submitted') || error ? 'Unsent inquiries' : 'Inquiry status'}
      className="container mx-auto space-y-4 px-4 pt-6"
    >
      {error ? (
        <Alert variant="error" role="alert">
          {error}
        </Alert>
      ) : null}
      {items.map((item) => {
        const completed = item.status === 'submitted'
        const unresolved = unknown.includes(item.reference)
        const busy = loading.includes(item.reference)
        return (
          <Alert
            key={item.reference}
            variant={completed ? 'success' : 'warning'}
            role="status"
            aria-atomic="true"
            className="grid break-words"
          >
            {/* The original card retains its geometry after completion; only the success text stays accessible. */}
            <div
              className={cn('col-start-1 row-start-1 flex flex-col items-start gap-3', completed && 'invisible')}
              aria-hidden={completed || undefined}
              inert={completed || undefined}
            >
              <p>
                {unresolved ? (
                  `The submission result is not yet known for your inquiry to ${item.clinicName || 'the clinic'}. Check its stored status before trying to send again.`
                ) : (
                  <>
                    Your inquiry to {item.clinicName || 'the clinic'} is saved but not sent.{' '}
                    {item.status === 'sign-in-required'
                      ? 'Sign in with your password to continue.'
                      : 'Your patient account is ready.'}
                  </>
                )}
              </p>
              {errors?.[item.reference] && !unresolved ? <p role="alert">{errors[item.reference]}</p> : null}
              <p>
                Expires on {new Date(item.expiresAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC. Its seven-day
                deadline does not change when you try again.
              </p>
              {unresolved ? (
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={busy}
                  onClick={() => onCheckStatus?.(item.reference)}
                >
                  {busy ? 'Checking...' : 'Check status'}
                </Button>
              ) : item.status === 'sign-in-required' ? (
                <UiLink
                  appearance="outline"
                  className="min-h-11 text-foreground underline"
                  href="/login/patient?next=/patient/inquiries"
                >
                  Sign in to send your inquiry
                </UiLink>
              ) : (
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={busy || completed}
                  onClick={() => onRetry(item.reference)}
                >
                  {busy ? 'Sending...' : 'Try again'}
                </Button>
              )}
            </div>
            {completed ? (
              <p className="col-start-1 row-start-1">
                Your inquiry to {item.clinicName || 'the clinic'} has been sent. You can find it in your inquiries
                below.
              </p>
            ) : null}
          </Alert>
        )
      })}
    </section>
  )
}
