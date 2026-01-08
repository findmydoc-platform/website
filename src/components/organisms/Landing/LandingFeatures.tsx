import React from 'react'
import { type StaticImageData } from 'next/image'

import { Container } from '@/components/molecules/Container'
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
}

export const LandingFeatures: React.FC<LandingFeaturesProps> = ({
  features,
  variant = 'default',
  backgroundImage,
  backgroundParallax,
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
        <div className="mb-16">
          <h2 className={cn('mb-6 text-5xl font-bold', isGreen ? 'text-accent-foreground' : 'text-foreground')}>
            Features
          </h2>
          <p className={cn('mx-auto max-w-2xl text-xl', isGreen ? 'text-accent-foreground/80' : 'text-foreground/80')}>
            Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos.
          </p>
        </div>

        <div className="grid gap-12 md:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div key={index} className="flex flex-col items-start gap-4 md:flex-row md:items-start md:gap-6">
                <div className="bg-muted mb-2 flex h-16 w-16 shrink-0 items-center justify-center rounded-full md:mb-0">
                  <Icon className="text-foreground h-8 w-8" />
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
