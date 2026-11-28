import React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'
import { UiLink } from '@/components/molecules/Link'

import type { AboutPageCopy } from '@/features/uiCopy/aboutPage'

export const ClosingActionsSection: React.FC<{ copy: AboutPageCopy['closing'] }> = ({ copy }) => (
  <section className="pb-14 sm:pb-18 lg:pb-20" aria-labelledby="about-closing-actions-heading">
    <Container>
      <div className="grid gap-8 border-t border-site-divider/70 pt-14 sm:pt-18 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12 lg:pt-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold tracking-[0.18em] text-accent uppercase">{copy.intro}</p>
          <Heading id="about-closing-actions-heading" as="h2" align="left" size="h4" className="mt-3 text-secondary">
            {copy.title}
          </Heading>
          <p className="mt-4 text-base leading-7 text-secondary/76 sm:text-lg sm:leading-8">{copy.description}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
          <UiLink
            href={copy.actions[0].href}
            label={copy.actions[0].label}
            appearance={copy.actions[0].appearance}
            className="rounded-full"
            size="lg"
          />
          <UiLink
            href={copy.actions[1].href}
            label={copy.actions[1].label}
            appearance={copy.actions[1].appearance}
            className="rounded-full"
            hoverEffect="slideFill"
            size="lg"
          />
        </div>
      </div>
    </Container>
  </section>
)
