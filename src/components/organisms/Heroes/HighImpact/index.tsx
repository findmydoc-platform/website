'use client'
import React from 'react'
import type { StaticImageData } from 'next/image'

import { UiLink, type UiLinkProps } from '@/components/molecules/Link'
import { Media } from '@/components/molecules/Media'
import { Container } from '@/components/molecules/Container'

export type HighImpactHeroProps = {
  richText?: React.ReactNode
  media?: {
    src: string | StaticImageData
    alt: string
    width?: number
    height?: number
  }
  links?: UiLinkProps[]
}

export const HighImpactHero: React.FC<HighImpactHeroProps> = ({ links, media, richText }) => {
  return (
    <div className="relative flex items-center justify-center text-white">
      <Container className="relative z-10 mb-8 flex items-center justify-center">
        <div className="max-w-146 md:text-center">
          {richText && <div className="mb-6">{richText}</div>}
          {Array.isArray(links) && links.length > 0 && (
            <ul className="flex gap-4 md:justify-center">
              {links.map((link, i) => {
                return (
                  <li key={i}>
                    <UiLink {...link} />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Container>
      <div className="min-h-hero select-none">
        {media && (
          <Media
            fill
            imgClassName="-z-10 object-cover"
            priority
            src={media.src}
            alt={media.alt}
            width={media.width}
            height={media.height}
          />
        )}
      </div>
    </div>
  )
}
