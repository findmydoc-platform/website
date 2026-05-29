import type * as React from 'react'

import type { IconComponent } from '../types'

export function SummaryGroup({
  children,
  icon: Icon,
  label,
}: {
  children: React.ReactNode
  icon: IconComponent
  label: string
}) {
  return (
    <div className="grid min-w-0 grid-cols-[20px_minmax(0,1fr)] items-start gap-3">
      <Icon aria-hidden="true" className="mt-[3px] size-4 text-primary" />
      <div className="min-w-0">
        <span className="block text-[13px] leading-5 font-bold tracking-[0.04em] text-primary uppercase">{label}</span>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  )
}
