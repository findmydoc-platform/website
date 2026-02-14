import * as React from 'react'
import { MapPin } from 'lucide-react'

import { cn } from '@/utilities/ui'

export function LocationLine({ value, href, className }: { value: string; href?: string; className?: string }) {
  const content = (
    <React.Fragment>
      <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
      <span>{value}</span>
    </React.Fragment>
  )

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`View ${value} on Google Maps (opens in a new tab)`}
        className={cn(
          'inline-flex items-center gap-2 text-sm text-foreground transition-colors hover:text-primary',
          className,
        )}
      >
        {content}
      </a>
    )
  }

  return <div className={cn('inline-flex items-center gap-2 text-sm', className)}>{content}</div>
}
