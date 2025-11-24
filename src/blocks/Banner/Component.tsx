import type { BannerBlock as BannerBlockProps } from 'src/payload-types'

import { cn } from '@/utilities/ui'
import { cva } from 'class-variance-authority'
import React from 'react'
import RichText from '@/components/RichText'

type Props = {
  className?: string
} & BannerBlockProps

const bannerVariants = cva('flex items-center rounded-sm border px-6 py-4', {
  variants: {
    style: {
      info: 'border-primary bg-primary/15 text-primary',
      error: 'border-error bg-error/30 text-error',
      success: 'border-success bg-success/30 text-success',
      warning: 'border-warning bg-warning/30 text-warning',
    },
  },
  defaultVariants: {
    style: 'info',
  },
})

export const BannerBlock: React.FC<Props> = ({ className, content, style }) => {
  return (
    <div className={cn('mx-auto my-8 w-full', className)}>
      <div className={bannerVariants({ style })}>
        <RichText data={content} enableGutter={false} enableProse={false} />
      </div>
    </div>
  )
}
