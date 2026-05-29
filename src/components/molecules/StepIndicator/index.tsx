import * as React from 'react'

import { cn } from '@/utilities/ui'

export type StepIndicatorProps = {
  ariaLabel?: string
  className?: string
  currentStep: number
  statusLabel: string
  stepLabel: string
  totalSteps: number
}

export function StepIndicator({
  ariaLabel,
  className,
  currentStep,
  statusLabel,
  stepLabel,
  totalSteps,
}: StepIndicatorProps) {
  const safeTotalSteps = Math.max(totalSteps, 1)
  const safeCurrentStep = Math.min(Math.max(currentStep, 1), safeTotalSteps)
  const segments = Array.from({ length: safeTotalSteps }, (_, index) => index + 1)
  const getSegmentState = (segment: number) => {
    if (segment < safeCurrentStep) return 'completed'
    if (segment === safeCurrentStep) return 'current'
    return 'upcoming'
  }

  return (
    <div className={cn('w-full min-w-0', className)}>
      <div className="flex min-h-6 items-center justify-between gap-4 text-sm font-semibold text-secondary sm:text-base">
        <span className="leading-6 whitespace-nowrap">{stepLabel}</span>
        <span className="text-right text-xs leading-5 font-medium whitespace-nowrap text-card-foreground/75 sm:text-sm">
          {statusLabel}
        </span>
      </div>
      <div
        aria-label={ariaLabel ?? `${stepLabel}, ${statusLabel}`}
        aria-valuemax={safeTotalSteps}
        aria-valuemin={1}
        aria-valuenow={safeCurrentStep}
        aria-valuetext={stepLabel}
        className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full"
        role="progressbar"
      >
        {segments.map((segment) => (
          <span
            aria-hidden="true"
            className={cn(
              'h-full flex-1 bg-[#e8eefb]',
              getSegmentState(segment) === 'completed' && 'bg-primary',
              getSegmentState(segment) === 'current' && 'bg-primary/45',
            )}
            data-state={getSegmentState(segment)}
            key={segment}
          />
        ))}
      </div>
    </div>
  )
}
