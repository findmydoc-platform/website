import React from 'react'

import type { CallToActionBlock as CTABlockProps } from '@/payload-types'
import type { ContentLocaleContext } from '@/utilities/contentLocalization'

import { CallToAction } from '@/components/organisms/CallToAction'
import RichText from '@/blocks/_shared/RichText'
import type { UiLinkProps } from '@/components/molecules/Link'
import { isNotNull, resolveHrefFromCMSLink } from '@/blocks/_shared/utils'

type Props = CTABlockProps & {
  contentLocale?: ContentLocaleContext
}

export const CallToActionBlock: React.FC<Props> = ({ contentLocale, links, richText }) => {
  const normalizedLinks = (links ?? [])
    .map((item) => {
      const link = item?.link
      const href = link ? resolveHrefFromCMSLink(link, contentLocale) : undefined
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

  const richTextNode = richText ? <RichText contentLocale={contentLocale} data={richText} enableGutter={false} /> : null

  return <CallToAction links={normalizedLinks} richText={richTextNode} />
}
