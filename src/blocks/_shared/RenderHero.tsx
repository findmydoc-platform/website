import React from 'react'

import type { Page } from '@/payload-types'

import { HighImpactHero } from '@/components/organisms/Heroes/HighImpact'
import { LowImpactHero } from '@/components/organisms/Heroes/LowImpact'
import { MediumImpactHero } from '@/components/organisms/Heroes/MediumImpact'
import RichText from '@/blocks/_shared/RichText'
import { resolveHrefFromCMSLink } from '@/blocks/_shared/utils'
import type { UiLinkProps } from '@/components/molecules/Link'

export const RenderHero: React.FC<Page['hero']> = (props) => {
  const { type, richText, media, links } = props || {}

  if (!type || type === 'none') return null

  const richTextNode = richText ? <RichText data={richText} enableGutter={false} /> : undefined

  const mediaProps =
    media && typeof media === 'object' && media.url
      ? {
          src: media.url,
          alt: media.alt || '',
          width: media.width || undefined,
          height: media.height || undefined,
          caption: media.caption ? <RichText data={media.caption} enableGutter={false} /> : undefined,
        }
      : undefined

  const linksProps = links
    ?.map(({ link }) => {
      const href = link ? resolveHrefFromCMSLink(link) : undefined
      if (!href) return null

      const appearance = link?.appearance === 'default' || link?.appearance === 'outline' ? link.appearance : 'inline'

      return {
        href,
        label: link?.label ?? null,
        newTab: !!link?.newTab,
        appearance,
      } as UiLinkProps
    })
    .filter((l): l is UiLinkProps => l !== null)

  if (type === 'highImpact') {
    return <HighImpactHero richText={richTextNode} media={mediaProps} links={linksProps} />
  }
  if (type === 'mediumImpact') {
    return <MediumImpactHero richText={richTextNode} media={mediaProps} links={linksProps} />
  }
  if (type === 'lowImpact') {
    return <LowImpactHero richText={richTextNode} />
  }

  return null
}
