'use client'
import React from 'react'

import type { Page } from '@/payload-types'

import { CMSLink } from '@/components/molecules/Link'
import { Media } from '@/components/molecules/Media'
import RichText from '@/components/organisms/RichText'
import { Container } from '@/components/molecules/Container'

export const HighImpactHero: React.FC<Page['hero']> = ({ links, media, richText }) => {
  return (
    <div className="relative -mt-[10.4rem] flex items-center justify-center text-white">
      <Container className="relative z-10 mb-8 flex items-center justify-center">
        <div className="max-w-146 md:text-center">
          {richText && <RichText className="mb-6" data={richText} enableGutter={false} />}
          {Array.isArray(links) && links.length > 0 && (
            <ul className="flex gap-4 md:justify-center">
              {links.map(({ link }, i) => {
                return (
                  <li key={i}>
                    <CMSLink {...link} />
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
