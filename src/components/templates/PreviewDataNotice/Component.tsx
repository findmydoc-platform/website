import React from 'react'

import { Container } from '@/components/molecules/Container'
import { cn } from '@/utilities/ui'

export const PREVIEW_DATA_NOTICE_COPY =
  'Preview test content: all visible data is seeded test content, not production data.'

type PreviewDataNoticeProps = {
  className?: string
  label?: string
  description?: string
  lang?: string
}

export function PreviewDataNotice({
  className,
  label = 'Preview data notice',
  description = PREVIEW_DATA_NOTICE_COPY,
  lang = 'en',
}: PreviewDataNoticeProps) {
  return (
    <aside
      aria-label={label}
      role="note"
      lang={lang}
      className={cn('border-y border-[#FF2D2D]/30 bg-[#5A000A] text-white', className)}
    >
      <Container className="py-2">
        <p className="text-center text-xs leading-5 font-semibold text-balance sm:text-sm">{description}</p>
      </Container>
    </aside>
  )
}
