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
    <div
      className={cn(
        'grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3',
        isLanding ? 'text-card-foreground' : 'text-white',
      )}
    >
      <Icon aria-hidden="true" className={cn('mt-0.5 size-4', isLanding ? 'text-secondary/75' : 'text-primary')} />
      <div className="min-w-0">
        {label ? (
          <span
            className={cn(
              'block text-[13px] leading-4 font-medium tracking-[0.08em] uppercase',
              isLanding ? 'text-slate-500' : 'text-white/55',
            )}
          >
            {label}
          </span>
        ) : null}
        <span
          className={cn(
            'block text-[15px] leading-5 font-normal break-words',
            isLanding ? 'text-slate-700' : 'text-white/85',
          )}
        >
          {value}
        </span>
      </div>
    </div>
  )
}
