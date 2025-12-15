import * as React from 'react'

import { cn } from '@/utilities/ui'

type RankProps = {
  value: number | string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Rank({ value, size = 'md', className }: RankProps) {
  const sizeClasses = size === 'sm' ? 'size-10 text-sm' : size === 'lg' ? 'size-16 text-2xl' : 'size-14 text-xl'

  return (
    <div
      className={cn(
        'flex items-center justify-center bg-secondary font-bold text-secondary-foreground rounded-lg',
        sizeClasses,
        className,
      )}
    >
      {value}
    </div>
  )
}

export default Rank
