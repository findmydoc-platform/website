import { cn } from '@/utilities/ui'
import React from 'react'

interface PreviewBadgeProps {
  className?: string
}

export const PreviewBadge: React.FC<PreviewBadgeProps> = ({ className }) => (
  <span
    className={cn(
      'pointer-events-none absolute right-0 -bottom-3.5 inline-flex items-center gap-1 rounded-full border border-[#FF2D2D] bg-[#5A000A] px-2 py-0.5 text-[9px] font-bold tracking-[0.08em] text-white uppercase',
      className,
    )}
    aria-hidden="true"
  >
    <span className="size-1.5 rounded-full bg-[#FF2D2D]" />
    PREVIEW
  </span>
)
