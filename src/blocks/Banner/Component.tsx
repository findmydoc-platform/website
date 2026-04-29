import type { BannerBlock as BannerBlockProps } from 'src/payload-types'

import React from 'react'
import { Banner } from '@/components/organisms/Banner'
import RichText from '@/blocks/_shared/RichText'
import type { ContentLocaleContext } from '@/utilities/contentLocalization'

type Props = {
  className?: string
  contentLocale?: ContentLocaleContext
} & BannerBlockProps

export const BannerBlock: React.FC<Props> = ({ className, content, contentLocale, style }) => {
  return (
    <Banner
      className={className}
      content={<RichText contentLocale={contentLocale} data={content} enableGutter={false} enableProse={false} />}
      style={style}
    />
  )
}
