import React from 'react'
import Image, { type StaticImageData } from 'next/image'

import type { ComboboxOption } from '@/components/atoms/combobox'
import { Container } from '@/components/molecules/Container'
import { UiLink, type UiLinkProps } from '@/components/molecules/Link'
import { SectionHeading } from '@/components/molecules/SectionHeading'
import { LandingHeroSearchBarClient } from './LandingHeroSearchBar.client'
import { cn } from '@/utilities/ui'
import type { ResolvedMediaImage } from '@/utilities/media/resolveMediaImage'

type LandingHeroImageObject = {
  src: string
  alt?: string | null
  sizes?: string
  quality?: number
  objectPosition?: string
}

export type LandingHeroAction = {
  href: string
  label: string
  appearance?: Exclude<UiLinkProps['appearance'], 'inline'>
  newTab?: boolean
}

export type LandingHeroProps = {
  title: string
  description: string
  image?: ResolvedMediaImage | LandingHeroImageObject | string | StaticImageData
  variant?: 'clinic-landing' | 'homepage' | 'split-media'
  actions?: LandingHeroAction[]
  socialLinks?: {
    href: string
    label: string
    icon: React.ReactNode
  }[]
  searchOptions?: {
    service: ComboboxOption[]
    location: ComboboxOption[]
  }
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  title,
  description,
  image,
  variant = 'clinic-landing',
  actions,
  socialLinks,
  searchOptions,
}) => {
  const isHomepage = variant === 'homepage'
  const isClinicLanding = variant === 'clinic-landing'
  const isSplitMedia = variant === 'split-media'
  const hasImageObject = typeof image === 'object' && image !== null && 'src' in image
  const imageSrc = hasImageObject ? image.src : image
  const imageAlt = hasImageObject && 'alt' in image ? (image.alt ?? '') : 'Hero Background'
  const imageSizes = hasImageObject && 'sizes' in image ? image.sizes : undefined
  const imageQuality = hasImageObject && 'quality' in image ? image.quality : undefined
  const imageObjectPosition = hasImageObject && 'objectPosition' in image ? image.objectPosition : undefined

  const renderActions = (className?: string) => {
    if (!actions?.length) return null

    return (
      <div className={cn('flex flex-col gap-3 sm:flex-row', className)}>
        {actions.map((action, index) => (
          <UiLink
            key={`${action.href}-${action.label}`}
            href={action.href}
            label={action.label}
            appearance={action.appearance ?? (index === 0 ? 'accent' : 'secondary')}
            newTab={action.newTab}
            size="lg"
          />
        ))}
      </div>
    )
  }

  if (isSplitMedia) {
    return (
      <section className="bg-site-canvas pt-12 pb-12 sm:pt-16 sm:pb-16 lg:pt-16 lg:pb-14">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-20">
            <div className="max-w-2xl">
              <SectionHeading
                className="gap-7"
                title={title}
                description={description}
                size="hero"
                align="left"
                headingAs="h1"
                titleClassName="text-left text-5xl leading-[1.05] text-balance text-secondary sm:text-6xl lg:text-7xl"
                descriptionClassName="max-w-xl text-left text-base leading-8 text-secondary/78 sm:text-lg sm:leading-9"
              />
              {renderActions('mt-9')}
            </div>
            {imageSrc ? (
              <div className="relative aspect-[1.32] overflow-hidden rounded-xl bg-site-section">
                <Image
                  src={imageSrc}
                  alt={imageAlt}
                  fill
                  sizes={imageSizes ?? '(max-width: 1024px) 100vw, 50vw'}
                  quality={imageQuality ?? 75}
                  priority
                  className="object-cover"
                  style={imageObjectPosition ? { objectPosition: imageObjectPosition } : undefined}
                />
              </div>
            ) : null}
          </div>
        </Container>
      </section>
    )
  }

  return (
    <section
      className={cn(
        'relative flex items-center justify-center bg-site-canvas py-14 sm:py-20',
        isClinicLanding ? 'min-h-[34rem] overflow-hidden sm:min-h-[48rem]' : 'min-h-[32rem] md:min-h-[39rem] md:pb-28',
      )}
    >
      {imageSrc ? (
        <div className="absolute inset-0 z-0 overflow-hidden">
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            sizes={imageSizes ?? '100vw'}
            quality={imageQuality}
            className="object-cover object-center"
            style={imageObjectPosition ? { objectPosition: imageObjectPosition } : undefined}
            priority
          />
          <div className="absolute inset-0 bg-site-canvas/75" />
        </div>
      ) : null}

      <Container className="relative z-10 flex flex-col items-center gap-8 text-center md:gap-10">
        <SectionHeading
          className="w-full"
          title={title}
          description={description}
          size="hero"
          align="center"
          headingAs="h1"
        />

        {isHomepage ? (
          <LandingHeroSearchBarClient
            className="mx-auto w-full md:hidden"
            serviceOptions={searchOptions?.service}
            locationOptions={searchOptions?.location}
          />
        ) : null}

        {isClinicLanding && Array.isArray(socialLinks) && socialLinks.length > 0 && (
          <div className="flex space-x-6">
            {socialLinks.map((item) => (
              <a key={item.label} href={item.href} className="text-foreground transition-colors hover:text-primary">
                {item.icon}
                <span className="sr-only">{item.label}</span>
              </a>
            ))}
          </div>
        )}

        {renderActions('mt-2')}

        {isClinicLanding && (
          <div className="mt-10 animate-bounce sm:mt-16">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 rotate-90 text-foreground"
              aria-hidden="true"
            >
              <path
                d="M9 18L15 12L9 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </Container>

      {isHomepage && (
        <div className="absolute right-0 bottom-0 left-0 z-20 hidden w-full translate-y-1/2 px-4 md:block">
          <LandingHeroSearchBarClient
            className="mx-auto"
            serviceOptions={searchOptions?.service}
            locationOptions={searchOptions?.location}
          />
        </div>
      )}
    </section>
  )
}
