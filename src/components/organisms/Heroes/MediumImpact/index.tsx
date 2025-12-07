import React from 'react'

import type { Page } from '@/payload-types'

import { CMSLink } from '@/components/molecules/Link'
import { Media } from '@/components/molecules/Media'
import RichText from '@/components/organisms/RichText'
import { Container } from '@/components/molecules/Container'

export const MediumImpactHero: React.FC<Page['hero']> = ({ links, media, richText }) => {
  return (
    <div className="">
      <Container className="mb-8">
        {richText && <RichText className="mb-6" data={richText} enableGutter={false} />}
        {Array.isArray(links) && links.length > 0 && (
          <ul className="flex gap-4">
            {links.map(({ link }, i) => {
              return (
                <li key={i}>
                  <CMSLink {...link} />
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
