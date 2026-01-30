import React from 'react'
import Image, { type StaticImageData } from 'next/image'

import { Container } from '@/components/molecules/Container'
import { SectionHeading } from '@/components/molecules/SectionHeading'
import { LandingHeroSearchBarClient } from './LandingHeroSearchBar.client'
import { cn } from '@/utilities/ui'

export type LandingHeroProps = {
  title: string
  description: string
  image?: string | StaticImageData
  variant?: 'clinic-landing' | 'homepage'
  socialLinks?: {
    href: string
    label: string
    icon: React.ReactNode
  }[]
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  title,
  description,
  image,
  variant = 'clinic-landing',
  socialLinks,
}) => {
  const isHomepage = variant === 'homepage'
  const isClinicLanding = variant === 'clinic-landing'

  return (
    <section
      className={cn(
        'relative flex items-center justify-center bg-white py-20',
        isClinicLanding ? 'min-h-[48rem] overflow-hidden' : 'min-h-[39rem]',
      )}
    >
      {image ? (
        <div className="absolute inset-0 z-0 overflow-hidden">
          <Image src={image} alt="Hero Background" fill className="object-cover object-center" priority />
          <div className="absolute inset-0 bg-white/75" />
        </div>
      ) : null}

      <Container className="relative z-10 flex flex-col items-center text-center">
        <SectionHeading
          className="mb-12"
          title={title}
          description={description}
          size="hero"
          align="center"
          headingAs="h1"
        />

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

        {isClinicLanding && (
          <div className="mt-16 animate-bounce">
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
        <div className="absolute bottom-0 left-0 z-20 w-full translate-y-1/2 px-4">
          <LandingHeroSearchBarClient className="mx-auto" />
        </div>
      )}
    </section>
  )
}
