import * as React from 'react'
import { Clock } from 'lucide-react'

import { cn } from '@/utilities/ui'

export function ClinicWaitTime({ value, className }: { value: string; className?: string }) {
  return (
    <div className={cn('inline-flex items-center gap-2 text-secondary-foreground', className)}>
      <Clock className="size-5" aria-hidden="true" />
      <span className="font-medium">{value}</span>
    </div>
  )
}
