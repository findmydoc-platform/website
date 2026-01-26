import * as React from 'react'
import { MapPin } from 'lucide-react'

import { cn } from '@/utilities/ui'

export function LocationLine({ value, className }: { value: string; className?: string }) {
  return (
    <div className={cn('inline-flex items-center gap-2 text-sm', className)}>
      <MapPin className="text-muted-foreground size-4" aria-hidden="true" />
      <span>{value}</span>
    </div>
  )
}
