import * as React from 'react'

import { cn } from '@/utilities/ui'

export function TagList({ tags, className }: { tags: string[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="border-border bg-muted text-foreground rounded-lg border px-3 py-1 text-xs font-semibold"
        >
          {tag}
        </span>
      ))}
    </div>
  )
}
