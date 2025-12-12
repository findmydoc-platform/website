import React from 'react'

import type { CallToActionBlock as CTABlockProps } from '@/payload-types'

import { CallToAction } from '@/components/organisms/CallToAction'
import RichText from '@/components/organisms/RichText'
import type { UiLinkProps } from '@/components/molecules/Link'
import { isNotNull, resolveHrefFromCMSLink } from '@/blocks/_shared/utils'

export const CallToActionBlock: React.FC<CTABlockProps> = ({ links, richText }) => {
  const normalizedLinks = (links ?? [])
    .map((item) => {
      const link = item?.link
      const href = link ? resolveHrefFromCMSLink(link) : undefined
      if (!href) return null

      const appearance =
        link?.appearance === 'default' || link?.appearance === 'outline' ? link.appearance : ('inline' as const)

      return {
        href,
        label: link?.label ?? null,
        newTab: !!link?.newTab,
        appearance,
      } satisfies UiLinkProps
    })
    .filter(isNotNull)

  const richTextNode = richText ? <RichText data={richText} enableGutter={false} /> : null

  return <CallToAction links={normalizedLinks} richText={richTextNode} />
}
