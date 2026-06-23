import React from 'react'

import { Container } from '@/components/molecules/Container'
import { cn } from '@/utilities/ui'

export const PREVIEW_DATA_NOTICE_COPY =
  'Preview test content: all visible data is seeded test content, not production data.'

type PreviewDataNoticeProps = {
  className?: string
}

export function PreviewDataNotice({ className }: PreviewDataNoticeProps) {
  return (
    <aside
      aria-label="Preview data notice"
      role="note"
      className={cn('border-y border-[#FF2D2D]/30 bg-[#5A000A] text-white', className)}
    >
      <Container className="py-2">
        <p className="text-center text-xs leading-5 font-semibold text-balance sm:text-sm">
          {PREVIEW_DATA_NOTICE_COPY}
        </p>
      </Container>
    </aside>
  )
}
