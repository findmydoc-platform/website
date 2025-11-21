import type { BannerBlock as BannerBlockProps } from 'src/payload-types'

import { cn } from '@/utilities/ui'
import React from 'react'
import RichText from '@/components/RichText'

type Props = {
  className?: string
} & BannerBlockProps

const intentMap: Record<NonNullable<BannerBlockProps['style']>, string> = {
  info: 'intent-info',
  error: 'intent-error',
  success: 'intent-success',
  warning: 'intent-warning',
}

export const BannerBlock: React.FC<Props> = ({ className, content, style }) => {
  const intentClass = intentMap[style ?? 'info'] ?? intentMap.info

  return (
    <div className={cn('mx-auto my-8 w-full', className)}>
      <div className={cn('flex items-center rounded-sm border px-6 py-3', intentClass)}>
        <RichText data={content} enableGutter={false} enableProse={false} />
      </div>
    </div>
  )
}
