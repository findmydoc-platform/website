import { Alert } from '@/components/atoms/alert'
import { Button } from '@/components/atoms/button'
import type { PreparationReceipt } from '@/features/inquiryPreparations/contracts'

export function InquiryPreparationNotices({
  items,
  loading,
  error,
  onRetry,
}: {
  items: PreparationReceipt[]
  loading: string[]
  error?: string
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
          <p>Your inquiry to {item.clinicName || 'the clinic'} is saved but not sent. Your patient account is ready.</p>
          <p>
            Expires on {new Date(item.expiresAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC. Its seven-day
            deadline does not change when you try again.
          </p>
          <Button
            type="button"
            className="min-h-11"
            disabled={loading.includes(item.reference)}
            onClick={() => onRetry(item.reference)}
          >
            {loading.includes(item.reference) ? 'Sending...' : 'Try again'}
          </Button>
        </Alert>
      ))}
    </section>
  )
}
