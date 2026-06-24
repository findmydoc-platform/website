import React from 'react'

import { ScrollReveal } from '@/components/molecules/ScrollReveal'
import { LandingHero } from '@/components/organisms/Heroes/LandingHero'
import { AboutTrustSystemStory } from '@/components/organisms/AboutTrustSystemStory'

import { AccountabilitySection } from './AccountabilitySection'
import { BoundarySection } from './BoundarySection'
import { ClosingActionsSection } from './ClosingActionsSection'
import { SignalContextSection } from './SignalContextSection'
import { heroActions } from './aboutPageViewModel'
import type { AboutPageProps } from './types'

export type { AboutPageProps } from './types'

export const AboutPage: React.FC<AboutPageProps> = ({ hero, why, team, transparency }) => {
  return (
    <article className="bg-site-canvas text-foreground">
      <LandingHero
        title={hero.title}
        description={hero.description}
        image={hero.image}
        variant="image-backdrop"
        actions={heroActions}
      />

      <ScrollReveal preset="surface" staggerSelector="[data-about-signal-reveal]">
        <SignalContextSection section={why} />
      </ScrollReveal>

      <ScrollReveal preset="surface">
        <AboutTrustSystemStory />
      </ScrollReveal>

      <ScrollReveal preset="surface" staggerSelector="[data-about-team-reveal-item]">
        <AccountabilitySection team={team} />
      </ScrollReveal>

      <ScrollReveal preset="surface" staggerSelector="[data-about-boundary-reveal]">
        <BoundarySection section={transparency} />
      </ScrollReveal>

      <ClosingActionsSection />
    </article>
  )
}
