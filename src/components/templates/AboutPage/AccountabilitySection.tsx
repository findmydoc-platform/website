'use client'

import Image from 'next/image'
import React, { useEffect, useId, useRef, useState } from 'react'

import { Heading } from '@/components/atoms/Heading'
import { TrustAtom, type TrustAtomTone } from '@/components/atoms/TrustAtom'
import { Container } from '@/components/molecules/Container'
import { SocialLink, type SocialPlatform } from '@/components/molecules/SocialLink'
import { UiLink } from '@/components/molecules/Link'
import { cn } from '@/utilities/ui'

import type { AboutTeamMember } from './types'
import { accountabilityLabels } from './aboutPageViewModel'
import { resolveImageObjectPositionStyle } from './aboutPageUtils'

type TeamAccountabilityDetails = {
  owns: string
  decisionBoundary: string
  protects: string
}

const teamAccountabilityDetails: TeamAccountabilityDetails[] = [
  {
    owns: 'Sets the standards for partner relationships, commercial accountability, and sustainable clinic growth.',
    decisionBoundary:
      'Keeps partner decisions measurable and transparent before clinic information becomes part of the comparison experience.',
    protects:
      'Protects patient trust by making sure commercial growth does not outrun responsible clinic presentation.',
  },
  {
    owns: 'Owns the communication standards that make clinic information clear, consistent, and human.',
    decisionBoundary: 'Keeps service claims grounded before outreach, campaigns, or clinic stories reach patients.',
    protects: 'Protects patients from overstated promises by keeping clinic communication precise and accountable.',
  },
  {
    owns: 'Owns the comparison product and the user experience that turns clinic signals into useful decisions.',
    decisionBoundary:
      'Keeps product choices focused on patient questions before new features add noise to the comparison flow.',
    protects: 'Protects a simple, trustworthy product experience where evidence stays easier to evaluate.',
  },
  {
    owns: 'Owns legal clarity, privacy expectations, and responsible engagement across patient and clinic interactions.',
    decisionBoundary:
      'Keeps comparison context separate from medical advice, consent boundaries, and unsupported partner claims.',
    protects: 'Protects the legal foundation that lets patients and clinics use the platform with confidence.',
  },
  {
    owns: 'Owns the platform architecture that keeps clinic information structured, available, and reliable.',
    decisionBoundary:
      'Keeps technical decisions accountable before data quality, access, or system resilience can affect patients.',
    protects: 'Protects platform trust by keeping the experience secure, observable, and resilient as it scales.',
  },
]

const detailRows: Array<{ key: keyof TeamAccountabilityDetails; label: string; tone: TrustAtomTone }> = [
  { key: 'owns', label: 'Owns', tone: 'primary' },
  { key: 'decisionBoundary', label: 'Decision boundary', tone: 'accent' },
  { key: 'protects', label: 'Protects', tone: 'secondary' },
]

const defaultProfileLinks: NonNullable<AboutTeamMember['profileLinks']> = [{ href: '/contact', label: 'Contact' }]
const spotlightImageSizes = '(min-width: 640px) 144px, 120px'
const spotlightSocialPlatforms = ['linkedin', 'github'] as const satisfies SocialPlatform[]
const socialPlatformLabels: Record<(typeof spotlightSocialPlatforms)[number], string> = {
  github: 'GitHub',
  linkedin: 'LinkedIn',
}

function getTeamAccountabilityDetails(
  member: AboutTeamMember,
  index: number,
  accountabilityLabel: string,
): TeamAccountabilityDetails {
  return (
    teamAccountabilityDetails[index] ?? {
      owns: member.whatWeDo,
      decisionBoundary: `Keeps ${accountabilityLabel.toLowerCase()} decisions visible before they affect the comparison experience.`,
      protects: 'Protects patient trust by making the responsibility behind this part of the system explicit.',
    }
  )
}

const getTeamProfileLinks = (member: AboutTeamMember) =>
  member.profileLinks && member.profileLinks.length > 0 ? member.profileLinks : defaultProfileLinks

const getTeamSocialLinks = (member: AboutTeamMember) =>
  spotlightSocialPlatforms
    .map((platform) => {
      const href = member.socials?.[platform]

      if (!href) return null

      return {
        href,
        label: socialPlatformLabels[platform],
        platform,
      }
    })
    .filter((item): item is { href: string; label: string; platform: (typeof spotlightSocialPlatforms)[number] } =>
      Boolean(item),
    )

const TeamProfileLinks: React.FC<{ className?: string; member: AboutTeamMember }> = ({ className, member }) => {
  const socialLinks = getTeamSocialLinks(member)
  const profileLinks = getTeamProfileLinks(member)

  if (socialLinks.length === 0 && profileLinks.length === 0) return null

  return (
    <div
      className={cn(
        'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm motion-safe:delay-100 motion-safe:duration-200 motion-reduce:animate-none',
        className,
      )}
      aria-label={`${member.name} links`}
    >
      {socialLinks.length > 0 ? (
        <div className="flex items-center gap-2" aria-label={`${member.name} social profiles`}>
          {socialLinks.map((link) => {
            const opensCurrentPage = link.href.startsWith('#')

            return (
              <SocialLink
                key={link.platform}
                aria-label={`${member.name} on ${link.label}`}
                className="h-11 w-11 rounded-full text-secondary/58 hover:bg-primary/8 hover:text-primary focus-visible:ring-primary/35 focus-visible:ring-offset-site-canvas sm:h-9 sm:w-9"
                href={link.href}
                platform={link.platform}
                rel={opensCurrentPage ? undefined : 'noopener noreferrer'}
                size="sm"
                target={opensCurrentPage ? undefined : '_blank'}
                variant="ghost"
              />
            )
          })}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {profileLinks.map((link) => (
          <UiLink
            key={`${link.href}-${link.label}`}
            className="text-xs font-semibold tracking-[0.14em] text-secondary/56 uppercase underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-4 focus-visible:ring-offset-site-canvas focus-visible:outline-none"
            href={link.href}
            label={link.label}
            newTab={link.newTab}
          />
        ))}
      </div>
    </div>
  )
}

const TeamSpotlight: React.FC<{
  member: AboutTeamMember
  index: number
  id: string
  labelledBy: string
  spotlightRef: React.Ref<HTMLElement>
}> = ({ member, index, id, labelledBy, spotlightRef }) => {
  const [imageReady, setImageReady] = useState(false)
  const accountabilityLabel = accountabilityLabels[index] ?? 'Trust accountability'
  const details = getTeamAccountabilityDetails(member, index, accountabilityLabel)

  useEffect(() => {
    setImageReady(false)
  }, [member.image.src])

  return (
    <article
      id={id}
      ref={spotlightRef}
      role="tabpanel"
      aria-labelledby={labelledBy}
      aria-live="polite"
      tabIndex={-1}
      className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 motion-safe:ease-out motion-reduce:transform-none motion-reduce:animate-none"
      data-about-team-spotlight=""
      data-about-team-reveal-item=""
    >
      <div>
        <div className="border-b border-site-divider/70 pb-7">
          <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-7">
            <div className="relative h-[10.5rem] w-[7.5rem] overflow-hidden rounded-[4px] bg-site-section ring-1 ring-site-divider/80 sm:h-[12.5rem] sm:w-36">
              <Image
                src={member.image.src}
                alt={member.image.alt}
                fill
                className={cn(
                  'object-cover grayscale transition-opacity duration-200 ease-out motion-reduce:transition-none',
                  imageReady ? 'opacity-100' : 'opacity-0',
                )}
                sizes={spotlightImageSizes}
                quality={member.image.quality ?? 75}
                loading={index === 0 ? undefined : 'eager'}
                onError={() => setImageReady(true)}
                onLoad={() => setImageReady(true)}
                priority={index === 0}
                style={resolveImageObjectPositionStyle(member.image)}
              />
            </div>
            <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 min-w-0 motion-safe:duration-200 motion-reduce:animate-none">
              <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">{accountabilityLabel}</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Heading as="h3" align="left" size="h5" className="text-secondary">
                  {member.name}
                </Heading>
                <p className="text-sm font-medium text-secondary/56">{member.role}</p>
              </div>
              <TeamProfileLinks className="mt-4" member={member} />
            </div>
          </div>
        </div>
        <div className="divide-y divide-site-divider/70">
          {detailRows.map((row) => (
            <div
              key={row.key}
              className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 grid gap-3 py-6 motion-safe:duration-200 motion-reduce:animate-none sm:grid-cols-[minmax(9rem,0.42fr)_minmax(0,1fr)] sm:gap-6 sm:py-7"
            >
              <div className="flex items-start gap-3">
                <TrustAtom tone={row.tone} className="mt-1 !h-5 !w-5 !border-[5px]" />
                <p className="text-lg leading-7 font-bold tracking-tight text-secondary">{row.label}</p>
              </div>
              <p className="text-base leading-7 text-secondary/76">{details[row.key]}</p>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

const TeamMemberTab: React.FC<{
  member: AboutTeamMember
  index: number
  isActive: boolean
  onSelect: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void
  panelId: string
  tabId: string
}> = ({ member, index, isActive, onKeyDown, onSelect, panelId, tabId }) => {
  const accountabilityLabel = accountabilityLabels[index] ?? 'Trust accountability'

  return (
    <button
      id={tabId}
      type="button"
      role="tab"
      aria-controls={panelId}
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      className={cn(
        'group relative grid w-full grid-cols-[5rem_minmax(0,1fr)] gap-5 border-l-2 border-l-transparent py-5 pl-4 text-left transition-[border-color,background-color] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-4 focus-visible:ring-offset-site-canvas focus-visible:outline-none sm:grid-cols-[5.25rem_minmax(0,1fr)] sm:gap-6 lg:py-6',
        index > 0 && 'border-t border-site-divider/70',
        isActive
          ? 'cursor-default border-l-primary bg-primary/[0.018]'
          : 'cursor-pointer hover:border-l-primary/60 hover:bg-primary/[0.012] focus-visible:border-l-primary/70',
      )}
      data-active={isActive ? 'true' : undefined}
      data-about-team-member=""
      data-about-team-reveal-item=""
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      <span
        className={cn(
          'relative h-28 w-20 overflow-hidden rounded-[4px] bg-site-section ring-1 ring-site-divider/80 transition-[opacity,transform,filter] duration-200 ease-out sm:h-28 sm:w-[5.25rem]',
          isActive
            ? 'opacity-90 ring-primary/28'
            : 'opacity-60 group-hover:scale-[1.025] group-hover:opacity-90 group-focus-visible:scale-[1.025] group-focus-visible:opacity-90',
        )}
      >
        <Image
          src={member.image.src}
          alt=""
          fill
          className="object-cover grayscale"
          sizes="84px"
          quality={member.image.quality ?? 70}
          style={resolveImageObjectPositionStyle(member.image)}
        />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <TrustAtom
            tone={isActive ? 'accent' : 'primary'}
            className={cn(
              '!h-3 !w-3 shrink-0 !border-[3px] transition-opacity duration-200 ease-out',
              isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-80 group-focus-visible:opacity-80',
            )}
          />
          <span
            className={cn(
              'block text-xs font-semibold tracking-[0.16em] uppercase transition-colors duration-200 ease-out',
              isActive ? 'text-primary' : 'text-primary/58 group-hover:text-primary group-focus-visible:text-primary',
            )}
          >
            {accountabilityLabel}
          </span>
        </span>
        <span className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className={cn(
              'text-base font-bold tracking-tight normal-case transition-colors duration-200 ease-out md:text-lg',
              isActive
                ? 'text-secondary'
                : 'text-secondary/62 group-hover:text-secondary group-focus-visible:text-secondary',
            )}
          >
            {member.name}
          </span>
          <span className="text-sm font-medium text-secondary/48">{member.role}</span>
        </span>
        <span
          className={cn(
            'mt-3 block text-sm leading-6 transition-colors duration-200 ease-out sm:text-base sm:leading-7',
            isActive
              ? 'text-secondary/76'
              : 'text-secondary/56 group-hover:text-secondary/72 group-focus-visible:text-secondary/72',
          )}
        >
          {member.whatWeDo}
        </span>
      </span>
    </button>
  )
}

export const AccountabilitySection: React.FC<{ team: AboutTeamMember[] }> = ({ team }) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const componentId = useId()
  const spotlightRef = useRef<HTMLElement | null>(null)
  const activeMember = team[activeIndex] ?? team[0]

  if (!activeMember) return null

  const activePanelId = `${componentId}-team-spotlight`
  const activeTabId = `${componentId}-team-tab-${activeIndex}`

  const scrollSpotlightIntoView = () => {
    spotlightRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }

  const shouldScrollToSpotlight = () =>
    typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches

  const selectTeamMember = (index: number, options?: { focusSpotlight?: boolean; scrollSpotlight?: boolean }) => {
    setActiveIndex(index)

    window.requestAnimationFrame(() => {
      if (options?.scrollSpotlight) scrollSpotlightIntoView()
      if (options?.focusSpotlight) spotlightRef.current?.focus({ preventScroll: !options.scrollSpotlight })
    })
  }

  const handleTeamTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const lastIndex = team.length - 1
    const nextIndex = index + 1 > lastIndex ? 0 : index + 1
    const previousIndex = index - 1 < 0 ? lastIndex : index - 1
    const keyMap: Partial<Record<string, number>> = {
      ArrowDown: nextIndex,
      ArrowRight: nextIndex,
      ArrowLeft: previousIndex,
      ArrowUp: previousIndex,
      End: lastIndex,
      Home: 0,
    }
    const targetIndex = keyMap[event.key]

    if (typeof targetIndex === 'number') {
      event.preventDefault()
      selectTeamMember(targetIndex, { focusSpotlight: true, scrollSpotlight: shouldScrollToSpotlight() })
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectTeamMember(index, { focusSpotlight: true, scrollSpotlight: shouldScrollToSpotlight() })
    }
  }

  return (
    <section className="pb-14 sm:pb-18 lg:pb-20" aria-labelledby="about-accountability-heading">
      <Container>
        <div className="grid gap-10 border-t border-site-divider/70 pt-14 sm:pt-18 lg:grid-cols-[minmax(0,1.04fr)_minmax(24rem,0.96fr)] lg:gap-14 lg:pt-20">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="max-w-lg" data-about-team-reveal-item="">
              <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">Accountability layer</p>
              <Heading id="about-accountability-heading" as="h2" align="left" size="h4" className="mt-3 text-secondary">
                The people accountable for the system
              </Heading>
            </div>
            <div className="mt-10 sm:mt-12">
              <TeamSpotlight
                member={activeMember}
                index={activeIndex}
                id={activePanelId}
                labelledBy={activeTabId}
                spotlightRef={spotlightRef}
              />
            </div>
          </div>
          <div role="tablist" aria-label="Team accountability roles">
            {team.map((member, index) => (
              <TeamMemberTab
                key={`${member.name}-${member.role}`}
                member={member}
                index={index}
                isActive={index === activeIndex}
                onSelect={() => selectTeamMember(index, { scrollSpotlight: shouldScrollToSpotlight() })}
                onKeyDown={(event) => handleTeamTabKeyDown(event, index)}
                panelId={activePanelId}
                tabId={`${componentId}-team-tab-${index}`}
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
