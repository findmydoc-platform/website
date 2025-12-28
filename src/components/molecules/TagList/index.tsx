import * as React from 'react'

import { cn } from '@/utilities/ui'

export function TagList({ tags, className }: { tags: string[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-lg border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground"
        >
          {tag}
        </span>
      ))}
    </div>
  )
}
