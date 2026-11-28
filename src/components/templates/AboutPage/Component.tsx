import React from 'react'

import { ScrollReveal } from '@/components/molecules/ScrollReveal'
import { LandingHero } from '@/components/organisms/Heroes/LandingHero'
import { AboutTrustSystemStory } from '@/components/organisms/AboutTrustSystemStory'

import { AccountabilitySection } from './AccountabilitySection'
import { BoundarySection } from './BoundarySection'
import { ClosingActionsSection } from './ClosingActionsSection'
import { SignalContextSection } from './SignalContextSection'
import type { AboutPageProps } from './types'

export type { AboutPageProps } from './types'

export const AboutPage: React.FC<AboutPageProps> = ({ hero, why, team, transparency, copy }) => {
  return (
    <article className="bg-site-canvas text-foreground">
      <LandingHero
        title={hero.title}
        description={hero.description}
        image={hero.image}
        variant="image-backdrop"
        actions={copy.heroActions}
      />

      <ScrollReveal preset="surface" staggerSelector="[data-about-signal-reveal]">
        <SignalContextSection section={why} copy={copy.signal} />
      </ScrollReveal>

      <ScrollReveal preset="surface">
        <AboutTrustSystemStory copy={copy.story} />
      </ScrollReveal>

      <ScrollReveal preset="surface" staggerSelector="[data-about-team-reveal-item]">
        <AccountabilitySection team={team} copy={copy.team} contact={copy.contact} />
      </ScrollReveal>

      <ScrollReveal preset="surface" staggerSelector="[data-about-boundary-reveal]">
        <BoundarySection section={transparency} copy={copy.boundary} signals={copy.signal.items} />
      </ScrollReveal>

      <ClosingActionsSection copy={copy.closing} />
    </article>
  )
}
