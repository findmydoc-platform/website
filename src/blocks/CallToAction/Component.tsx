import React from 'react'

import type { CallToActionBlock as CTABlockProps } from '@/payload-types'

import { CallToAction } from '@/components/organisms/CallToAction'
import RichText from '@/components/organisms/RichText'
import type { UiLinkProps } from '@/components/molecules/Link'

function isNotNull<T>(value: T | null): value is T {
  return value !== null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function resolveHrefFromCMSLink(link: {
  type?: 'custom' | 'reference' | null
  url?: string | null
  reference?: unknown
}): string | undefined {
  if (link.type === 'reference' && isRecord(link.reference)) {
    const relationTo = link.reference['relationTo']
    const value = link.reference['value']

    if (typeof relationTo === 'string' && isRecord(value)) {
      const slug = value['slug']
      if (typeof slug === 'string' && slug.length > 0) {
        return `${relationTo !== 'pages' ? `/${relationTo}` : ''}/${slug}`
      }
    }
  }

  if (typeof link.url === 'string' && link.url.length > 0) return link.url

  return undefined
}

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
