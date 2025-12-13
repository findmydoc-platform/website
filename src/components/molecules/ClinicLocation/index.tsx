import * as React from 'react'
import { MapPin } from 'lucide-react'

import { cn } from '@/utilities/ui'

export function ClinicLocation({ value, className }: { value: string; className?: string }) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <MapPin className="size-5 text-secondary-foreground" aria-hidden="true" />
      <span>{value}</span>
    </div>
  )
}
