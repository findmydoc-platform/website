import type * as React from 'react'

import { cn } from '@/utilities/ui'

export function SplitStepShell({
  children,
  className,
  contextPanel,
  progress,
}: {
  children: React.ReactNode
  className?: string
  contextPanel: React.ReactNode
  progress: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'mx-auto grid w-full max-w-[1184px] min-w-0 overflow-hidden rounded-[8px] border border-slate-300 bg-card shadow-[0_18px_44px_rgba(7,0,76,0.12)] lg:min-h-[828px] lg:grid-cols-[493px_minmax(0,1fr)]',
        className,
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-col bg-card px-6 py-7 sm:px-10 sm:py-10 md:min-h-[610px] lg:col-start-2 lg:row-start-1 lg:min-h-0 lg:px-12 lg:py-12">
        {progress}
        {children}
      </div>
      <div className="flex min-w-0 lg:col-start-1 lg:row-start-1 lg:min-h-full">{contextPanel}</div>
    </div>
  )
}
