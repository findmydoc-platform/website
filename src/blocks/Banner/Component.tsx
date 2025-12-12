import type { BannerBlock as BannerBlockProps } from 'src/payload-types'

import React from 'react'
import { Banner } from '@/components/organisms/Banner'
import RichText from '@/blocks/_shared/RichText'

type Props = {
  className?: string
} & BannerBlockProps

export const BannerBlock: React.FC<Props> = ({ className, content, style }) => {
  return (
    <Banner
      className={className}
      content={<RichText data={content} enableGutter={false} enableProse={false} />}
      style={style}
    />
  )
}
