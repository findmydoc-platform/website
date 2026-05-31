import type * as React from 'react'

import { cn } from '@/utilities/ui'
import type { ClinicRegistrationFunnelVariant, IconComponent } from '../types'

export function SummaryGroup({
  children,
  icon: Icon,
  label,
  variant = 'default',
}: {
  children: React.ReactNode
  icon: IconComponent
  label: string
  variant?: ClinicRegistrationFunnelVariant
}) {
  const isLanding = variant === 'landing'

  return (
    <div className="grid min-w-0 grid-cols-[20px_minmax(0,1fr)] items-start gap-3">
      <Icon aria-hidden="true" className={cn('mt-[3px] size-4', isLanding ? 'text-accent' : 'text-primary')} />
      <div className="min-w-0">
        <span
          className={cn(
            'block text-[13px] leading-5 font-bold tracking-[0.04em] uppercase',
            isLanding ? 'text-accent' : 'text-primary',
          )}
        >
          {label}
        </span>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  )
}
