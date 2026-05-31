import { cn } from '@/utilities/ui'
import type { ClinicRegistrationFunnelVariant, IconComponent } from '../types'

export function SupportRow({
  icon: Icon,
  label,
  value,
  variant = 'default',
}: {
  icon: IconComponent
  label?: string
  value: string
  variant?: ClinicRegistrationFunnelVariant
}) {
  const isLanding = variant === 'landing'

  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 text-white">
      <Icon aria-hidden="true" className={cn('mt-0.5 size-4', isLanding ? 'text-accent' : 'text-primary')} />
      <div className="min-w-0">
        {label ? (
          <span
            className={cn(
              'block text-[13px] leading-4 font-medium tracking-[0.08em] uppercase',
              isLanding ? 'text-accent/75' : 'text-white/55',
            )}
          >
            {label}
          </span>
        ) : null}
        <span className={cn('block text-[15px] leading-5 font-normal break-words text-white/85')}>{value}</span>
      </div>
    </div>
  )
}
