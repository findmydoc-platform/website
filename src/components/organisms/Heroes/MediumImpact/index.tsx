import React from 'react'

import type { Page } from '@/payload-types'

import { UiLink, type UiLinkProps } from '@/components/molecules/Link'
import { Media } from '@/components/molecules/Media'
import RichText from '@/components/organisms/RichText'
import { Container } from '@/components/molecules/Container'
import { resolveHrefFromCMSLink } from '@/blocks/_shared/utils'

export const MediumImpactHero: React.FC<Page['hero']> = ({ links, media, richText }) => {
  return (
    <div className="">
      <Container className="mb-8">
        {richText && <RichText className="mb-6" data={richText} enableGutter={false} />}
        {Array.isArray(links) && links.length > 0 && (
          <ul className="flex gap-4">
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
      </Container>
      <Container>
        <div>
          {media && typeof media === 'object' && (
            <Media className="-mx-4 md:-mx-8 2xl:-mx-16" imgClassName="" priority resource={media} />
          )}
          {media && typeof media === 'object' && media?.caption && (
            <div className="mt-4">
              <RichText data={media.caption} enableGutter={false} />
            </div>
          )}
        </div>
      </Container>
    </div>
  )
}
