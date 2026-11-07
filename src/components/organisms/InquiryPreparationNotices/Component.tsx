import { Alert } from '@/components/atoms/alert'
import { Button } from '@/components/atoms/button'
import { UiLink } from '@/components/molecules/Link'
import type { PreparationReceipt } from '@/features/inquiryPreparations/contracts'

export function InquiryPreparationNotices({
  items,
  loading,
  error,
  errors,
  onRetry,
}: {
  items: PreparationReceipt[]
  loading: string[]
  error?: string
  errors?: Record<string, string>
  onRetry: (reference: string) => void
}) {
  if (!items.length && !error) return null
  return (
    <section aria-label="Unsent inquiries" className="container mx-auto space-y-4 px-4 pt-6">
      {error ? (
        <Alert variant="error" role="alert">
          {error}
        </Alert>
      ) : null}
      {items.map((item) => (
        <Alert
          key={item.reference}
          variant="warning"
          role="status"
          className="flex flex-col items-start gap-3 break-words"
        >
          <p>
            Your inquiry to {item.clinicName || 'the clinic'} is saved but not sent.{' '}
            {item.status === 'sign-in-required'
              ? 'Sign in with your password to continue.'
              : 'Your patient account is ready.'}
          </p>
          {errors?.[item.reference] ? <p role="alert">{errors[item.reference]}</p> : null}
          <p>
            Expires on {new Date(item.expiresAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC. Its seven-day
            deadline does not change when you try again.
          </p>
          {item.status === 'sign-in-required' ? (
            <UiLink appearance="outline" className="min-h-11" href="/login/patient?next=/patient/inquiries">
              Sign in to send your inquiry
            </UiLink>
          ) : (
            <Button
              type="button"
              className="min-h-11"
              disabled={loading.includes(item.reference)}
              onClick={() => onRetry(item.reference)}
            >
              {loading.includes(item.reference) ? 'Sending...' : 'Try again'}
            </Button>
          )}
        </Alert>
      ))}
    </section>
  )
}
