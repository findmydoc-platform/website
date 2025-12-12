'use client'
import React from 'react'

import type { Page } from '@/payload-types'

import { UiLink, type UiLinkProps } from '@/components/molecules/Link'
import { Media } from '@/components/molecules/Media'
import RichText from '@/components/organisms/RichText'
import { Container } from '@/components/molecules/Container'

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

export const HighImpactHero: React.FC<Page['hero']> = ({ links, media, richText }) => {
  return (
    <div className="relative flex items-center justify-center text-white">
      <Container className="relative z-10 mb-8 flex items-center justify-center">
        <div className="max-w-146 md:text-center">
          {richText && <RichText className="mb-6" data={richText} enableGutter={false} />}
          {Array.isArray(links) && links.length > 0 && (
            <ul className="flex gap-4 md:justify-center">
              {links.map(({ link }, i) => {
                const href = link ? resolveHrefFromCMSLink(link) : undefined
                if (!href) return null

                const appearance =
                  link?.appearance === 'default' || link?.appearance === 'outline' ? link.appearance : 'inline'

                const uiLink: UiLinkProps = {
                  href,
                  label: link?.label ?? null,
                  newTab: !!link?.newTab,
                  appearance,
                }

                return (
                  <li key={i}>
                    <UiLink {...uiLink} />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Container>
      <div className="min-h-hero select-none">
        {media && typeof media === 'object' && (
          <Media fill imgClassName="-z-10 object-cover" priority resource={media} />
        )}
      </div>
    </div>
  )
}
