import * as React from 'react'
import { Clock } from 'lucide-react'

import { cn } from '@/utilities/ui'

export function WaitTime({ value, className }: { value: string; className?: string }) {
  return (
    <div className={cn('text-muted-foreground inline-flex items-center gap-2 text-sm', className)}>
      <Clock className="size-4" aria-hidden="true" />
      <span>{value}</span>
    </div>
  )
}
