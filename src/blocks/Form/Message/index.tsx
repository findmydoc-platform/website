import type { ReactNode } from 'react'

import { Width } from '../Width'

export function Message({ content }: { content?: ReactNode }) {
  return (
    <Width className="my-12" width="100">
      {content}
    </Width>
  )
}
