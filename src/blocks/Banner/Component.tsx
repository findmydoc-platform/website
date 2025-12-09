import type { BannerBlock as BannerBlockProps } from 'src/payload-types'

import React from 'react'
import { Banner } from '@/components/organisms/Banner'

type Props = {
  className?: string
} & BannerBlockProps

export const BannerBlock: React.FC<Props> = ({ className, content, style }) => {
  return <Banner className={className} content={content} style={style} />
}
