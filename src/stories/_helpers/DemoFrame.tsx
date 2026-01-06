import * as React from 'react'

import { cn } from '@/utilities/ui'

type DemoFrameMaxWidth = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'

export type DemoFrameProps = {
  children: React.ReactNode
  className?: string
  maxWidth?: DemoFrameMaxWidth
  padded?: boolean
}

const maxWidthClasses: Record<DemoFrameMaxWidth, string> = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: '',
}

export function DemoFrame({ children, className, maxWidth = 'md', padded = true }: DemoFrameProps) {
  return (
    <div className={cn('mx-auto w-full', maxWidthClasses[maxWidth], padded ? 'p-6' : '', className)}>{children}</div>
  )
}
