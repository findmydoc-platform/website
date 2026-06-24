import Image from 'next/image'
import React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'
import { cn } from '@/utilities/ui'

import type { AboutTeamMember } from './types'
import { accountabilityLabels } from './aboutPageViewModel'
import { resolveImageObjectPositionStyle } from './aboutPageUtils'

const TeamMember: React.FC<{ member: AboutTeamMember; index: number }> = ({ member, index }) => {
  const accountabilityLabel = accountabilityLabels[index] ?? 'Trust accountability'

  return (
    <article
      className={cn(
        'grid gap-4 py-5 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-6 lg:py-6',
        index > 0 && 'border-t border-site-divider/70',
      )}
      data-about-team-member=""
    >
      <div
        className="relative h-32 w-24 overflow-hidden rounded-[4px] bg-site-section ring-1 ring-site-divider/80 sm:h-full sm:min-h-[8.5rem] sm:w-[6.5rem]"
        data-about-team-reveal-item=""
      >
        <Image
          src={member.image.src}
          alt={member.image.alt}
          fill
          className="object-cover grayscale"
          sizes="104px"
          quality={member.image.quality ?? 75}
          style={resolveImageObjectPositionStyle(member.image)}
        />
      </div>
      <div className="min-w-0" data-about-team-reveal-item="">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">{accountabilityLabel}</p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Heading as="h3" align="left" size="h6" className="text-secondary">
            {member.name}
          </Heading>
          <p className="text-sm font-medium text-secondary/56">{member.role}</p>
        </div>
        <p className="mt-4 text-base leading-7 text-secondary/76">{member.whatWeDo}</p>
      </div>
    </article>
  )
}

export const AccountabilitySection: React.FC<{ team: AboutTeamMember[] }> = ({ team }) => {
  return (
    <section className="pb-14 sm:pb-18 lg:pb-20" aria-labelledby="about-accountability-heading">
      <Container>
        <div className="grid gap-10 border-t border-site-divider/70 pt-14 sm:pt-18 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.5fr)] lg:gap-16 lg:pt-20">
          <div className="max-w-sm" data-about-team-reveal-item="">
            <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">Accountability layer</p>
            <Heading id="about-accountability-heading" as="h2" align="left" size="h4" className="mt-3 text-secondary">
              The people accountable for the system
            </Heading>
            <p className="mt-4 text-base leading-7 text-secondary/76">
              The trust system stays credible when the responsibilities behind it are visible.
            </p>
          </div>
          <div>
            {team.map((member, index) => (
              <TeamMember key={`${member.name}-${member.role}`} member={member} index={index} />
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
