import React from 'react'
import type { StaticImageData } from 'next/image'

import { UiLink, type UiLinkProps } from '@/components/molecules/Link'
import { Media } from '@/components/molecules/Media'
import { Container } from '@/components/molecules/Container'

export type MediumImpactHeroProps = {
  richText?: React.ReactNode
  media?: {
    src: string | StaticImageData
    alt: string
    width?: number
    height?: number
    caption?: React.ReactNode
  }
  links?: UiLinkProps[]
}

export const MediumImpactHero: React.FC<MediumImpactHeroProps> = ({ links, media, richText }) => {
  return (
    <div className="">
      <Container className="mb-8">
        {richText && <div className="mb-6">{richText}</div>}
        {Array.isArray(links) && links.length > 0 && (
          <ul className="flex gap-4">
            {links.map((link, i) => {
              return (
                <li key={i}>
                  <UiLink {...link} />
                </li>
              )
            })}
          </ul>
        )}
      </Container>
      <Container>
        <div>
          {media && (
            <Media
              className="-mx-4 md:-mx-8 2xl:-mx-16"
              imgClassName=""
              priority
              src={media.src}
              alt={media.alt}
              width={media.width}
              height={media.height}
            />
          )}
          {media?.caption && <div className="mt-4">{media.caption}</div>}
        </div>
      </Container>
    </div>
  )
}
