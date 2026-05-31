import type * as React from 'react'

import { cn } from '@/utilities/ui'
import type { ClinicRegistrationFunnelVariant } from '../types'

export function SplitStepShell({
  children,
  className,
  contextPanel,
  progress,
  variant = 'default',
}: {
  children: React.ReactNode
  className?: string
  contextPanel: React.ReactNode
  progress: React.ReactNode
  variant?: ClinicRegistrationFunnelVariant
}) {
  const isLanding = variant === 'landing'
  const contentColumn = (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-col lg:col-start-2 lg:row-start-1 lg:min-h-0',
        isLanding
          ? 'bg-white/95 px-5 py-7 sm:px-8 sm:py-9 md:min-h-[560px] lg:px-10 lg:py-10'
          : 'bg-card px-6 py-7 sm:px-10 sm:py-10 md:min-h-[610px] lg:px-12 lg:py-12',
      )}
    >
      {progress}
      {children}
    </div>
  )
  const contextColumn = <div className="flex min-w-0 lg:col-start-1 lg:row-start-1 lg:min-h-full">{contextPanel}</div>

  return (
    <div
      className={cn(
        isLanding
          ? 'mx-auto grid w-full max-w-[1184px] min-w-0 overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/95 shadow-[0_30px_90px_-58px_rgba(15,23,42,0.35)] sm:rounded-[32px] lg:min-h-[720px] lg:grid-cols-[420px_minmax(0,1fr)]'
          : 'mx-auto grid w-full max-w-[1184px] min-w-0 overflow-hidden rounded-[8px] border border-slate-300 bg-card shadow-[0_18px_44px_rgba(7,0,76,0.12)] lg:min-h-[828px] lg:grid-cols-[493px_minmax(0,1fr)]',
        className,
      )}
    >
      {isLanding ? (
        <>
          {contextColumn}
          {contentColumn}
        </>
      ) : (
        <>
          {contentColumn}
          {contextColumn}
        </>
      )}
    </div>
  )
}
