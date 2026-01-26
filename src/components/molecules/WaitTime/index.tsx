import * as React from 'react'
import { Clock } from 'lucide-react'

import { cn } from '@/utilities/ui'

export function WaitTime({ value, className }: { value: string; className?: string }) {
  return (
    <div className={cn('inline-flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <Clock className="size-4" aria-hidden="true" />
      <span>{value}</span>
    </div>
  )
}
