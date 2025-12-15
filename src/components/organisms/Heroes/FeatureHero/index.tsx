import React from 'react'
import { Check } from 'lucide-react'
import type { StaticImageData } from 'next/image'

import { Container } from '@/components/molecules/Container'
import { Media } from '@/components/molecules/Media'

export type FeatureHeroProps = {
  title: string
  subtitle?: string
  features?: string[]
  media?: {
    src: string | StaticImageData
    alt: string
    width?: number
    height?: number
  }
  /**
   * Which bullet style to show. 'both' shows a circular bullet containing a check.
   */
  bulletStyle?: 'circle' | 'check' | 'both'
}

export const FeatureHero: React.FC<FeatureHeroProps> = ({ title, subtitle, features, media, bulletStyle = 'both' }) => {
  return (
    <div className="relative flex min-h-(--min-height-hero) items-center justify-center bg-slate-900 text-white overflow-hidden">
      {/* Background Media */}
      <div className="absolute inset-0 select-none">
        {media && (
          <Media
            fill
            imgClassName="object-cover opacity-40"
            priority
            src={media.src}
            alt={media.alt}
            width={media.width}
            height={media.height}
          />
        )}
        {/* Gradient Overlay for text readability */}
        <div className="absolute inset-0 bg-linear-to-t from-slate-900 via-(--color-slate-900-40) to-transparent" />
      </div>

      <Container className="relative z-10 flex flex-col items-center py-20 text-center">
        <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">{title}</h1>

        {subtitle && <p className="mb-10 max-w-2xl text-lg text-slate-200 md:text-xl">{subtitle}</p>}

        {features && features.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm font-medium md:text-base">
                {bulletStyle === 'circle' && (
                  <span className="inline-block h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
                )}
                {bulletStyle === 'check' && <Check className="h-5 w-5 text-accent" aria-hidden="true" />}
                {bulletStyle === 'both' && (
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-(--bg-bullet-circle) text-accent"
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3" />
                  </span>
                )}
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </div>
  )
}
