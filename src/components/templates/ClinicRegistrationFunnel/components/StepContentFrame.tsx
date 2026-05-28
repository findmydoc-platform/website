import type * as React from 'react'

import { cn } from '@/utilities/ui'
import type { StepTransitionDirection } from '../types'

export function getStepTransitionClassName(direction: StepTransitionDirection) {
  if (direction === 'forward') {
    return 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 motion-safe:duration-150 motion-reduce:animate-none motion-reduce:transform-none'
  }

  if (direction === 'backward') {
    return 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-2 motion-safe:duration-150 motion-reduce:animate-none motion-reduce:transform-none'
  }

  return ''
}

export function StepContentFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex min-w-0 flex-1 flex-col', className)}>{children}</div>
}
