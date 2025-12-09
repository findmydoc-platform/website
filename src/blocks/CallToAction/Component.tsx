import React from 'react'

import type { CallToActionBlock as CTABlockProps } from '@/payload-types'

import { CallToAction } from '@/components/organisms/CallToAction'

export const CallToActionBlock: React.FC<CTABlockProps> = ({ links, richText }) => {
  return <CallToAction links={links} richText={richText} />
}
