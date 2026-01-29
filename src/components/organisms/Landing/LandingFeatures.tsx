import React from 'react'
import { type StaticImageData } from 'next/image'

import { Container } from '@/components/molecules/Container'
import { SectionHeading } from '@/components/molecules/SectionHeading'
import { SectionBackground } from '@/components/molecules/SectionBackground'
import { cn } from '@/utilities/ui'

type LandingFeature = {
  title: string
  subtitle: string
  description: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

type LandingFeaturesProps = {
  features: LandingFeature[]
  variant?: 'default' | 'green'
  backgroundImage?: string | StaticImageData
  backgroundParallax?:
    | boolean
    | {
        rangePx?: number
        scale?: number
      }
  title: string
  description: string
}

export const LandingFeatures: React.FC<LandingFeaturesProps> = ({
  features,
  variant = 'default',
  backgroundImage,
  backgroundParallax,
  title,
  description,
}) => {
  const isGreen = variant === 'green'
  const parallaxEnabled = Boolean(backgroundImage && backgroundParallax)
  const parallaxConfig = typeof backgroundParallax === 'object' ? backgroundParallax : undefined

  return (
    <SectionBackground
      as="section"
      className={cn('py-20', isGreen ? 'bg-accent' : 'bg-white')}
      media={
        backgroundImage
          ? {
              src: backgroundImage,
              alt: '',
              imgClassName: 'object-center opacity-10',
            }
          : undefined
      }
      parallax={
        parallaxEnabled
          ? {
              mode: 'scroll',
              rangePx: parallaxConfig?.rangePx ?? 64,
              scale: parallaxConfig?.scale ?? 1.06,
            }
          : undefined
      }
    >
      <Container>
        <SectionHeading
          className="mb-16"
          title={title}
          description={description}
          size="section"
          align="center"
          tone={isGreen ? 'accent' : 'default'}
        />

        <div className="grid gap-12 md:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div key={index} className="flex flex-col items-start gap-4 md:flex-row md:items-start md:gap-6">
                <div className="mb-2 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-muted md:mb-0">
                  <Icon className="h-8 w-8 text-foreground" />
                </div>
                <div className="flex flex-col items-start gap-2">
                  <h3
                    className={cn(
                      'text-left text-5xl font-bold',
                      isGreen ? 'text-accent-foreground' : 'text-foreground',
                    )}
                  >
                    {feature.title}
                  </h3>
                  <h4
                    className={cn(
                      'text-left text-xl font-bold',
                      isGreen ? 'text-accent-foreground' : 'text-foreground',
                    )}
                  >
                    {feature.subtitle}
                  </h4>
                  <p
                    className={cn('text-left text-lg', isGreen ? 'text-accent-foreground/80' : 'text-muted-foreground')}
                  >
                    {feature.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </Container>
    </SectionBackground>
  )
}
