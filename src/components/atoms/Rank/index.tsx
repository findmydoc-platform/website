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
        'bg-secondary text-secondary-foreground flex items-center justify-center rounded-lg font-bold',
        sizeClasses,
        className,
      )}
    >
      {value}
    </div>
  )
}

export default Rank
