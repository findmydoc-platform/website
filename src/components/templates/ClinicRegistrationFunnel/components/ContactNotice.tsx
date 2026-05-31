import { cn } from '@/utilities/ui'
import type { ClinicRegistrationFunnelVariant } from '../types'

export function ContactNotice({ id, variant = 'default' }: { id: string; variant?: ClinicRegistrationFunnelVariant }) {
  const isLanding = variant === 'landing'

  return (
    <p
      className={cn(
        'border px-4 py-3 text-xs leading-5 break-words',
        isLanding
          ? 'rounded-2xl border-accent/30 bg-accent/15 text-[#064c3f]'
          : 'rounded-[8px] border-primary/15 bg-primary/10 text-card-foreground/75',
      )}
      id={id}
    >
      We use your details to contact you about this clinic registration based on legitimate interest.
    </p>
  )
}
