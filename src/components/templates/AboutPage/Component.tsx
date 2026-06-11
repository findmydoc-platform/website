import Image from 'next/image'
import React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'
import { UiLink } from '@/components/molecules/Link'
import { cn } from '@/utilities/ui'

type AboutImage = {
  src: string
  alt: string
  width?: number
  height?: number
  sizes?: string
  quality?: number
  objectPosition?: string
}

type AboutTextItem = {
  text: string
}

type AboutTextSection = {
  title: string
  items: AboutTextItem[]
}

type AboutTeamMember = {
  name: string
  role: string
  whatWeDo: string
  image: AboutImage
}

export type AboutPageProps = {
  hero: {
    title: string
    description: string
    image: AboutImage
  }
  why: AboutTextSection
  team: AboutTeamMember[]
  transparency: AboutTextSection
}

const primaryCtaClassName = 'bg-accent text-accent-foreground hover:bg-accent/85'
const secondaryCtaClassName = 'border-secondary/30 text-secondary hover:bg-secondary hover:text-white'

const resolveImageObjectPositionStyle = (image: AboutImage): React.CSSProperties | undefined =>
  image.objectPosition ? { objectPosition: image.objectPosition } : undefined

const SplitSection: React.FC<{
  className?: string
  section: AboutTextSection
  variant?: 'plain' | 'ruled'
}> = ({ className, section, variant = 'plain' }) => {
  return (
    <section className={cn('py-14 sm:py-18 lg:py-20', className)}>
      <Container>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_2px_minmax(0,1.45fr)] lg:gap-16">
          <Heading as="h2" align="left" size="h4" className="max-w-sm text-secondary">
            {section.title}
          </Heading>
          <div aria-hidden="true" className="hidden w-[2px] self-stretch bg-secondary/20 lg:block" />
          <ul
            className={cn(
              'max-w-2xl list-none text-base leading-8 text-secondary/88 sm:text-lg sm:leading-9',
              variant === 'plain' ? 'space-y-7' : 'divide-y divide-site-divider/70',
            )}
          >
            {section.items.map((item, index) => (
              <li key={`${section.title}-${index}`} className={cn(variant === 'ruled' && 'py-3 first:pt-0 last:pb-0')}>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  )
}

const TeamMember: React.FC<{ member: AboutTeamMember }> = ({ member }) => {
  return (
    <article className="grid gap-5 sm:grid-cols-[152px_minmax(0,1fr)] sm:gap-7 lg:grid-cols-[176px_minmax(0,1fr)]">
      <div className="relative aspect-square w-36 overflow-hidden rounded-xl bg-site-section sm:w-full">
        <Image
          src={member.image.src}
          alt={member.image.alt || member.name}
          fill
          sizes="(min-width: 1024px) 176px, (min-width: 640px) 152px, 144px"
          quality={member.image.quality ?? 75}
          className="object-cover"
          style={resolveImageObjectPositionStyle(member.image)}
        />
      </div>
      <div className="min-w-0 pt-1">
        <Heading as="h3" align="left" size="h6" className="text-secondary">
          {member.name}
        </Heading>
        <p className="mt-1 text-sm font-medium text-secondary/66">{member.role}</p>
        <div className="mt-5 text-base leading-7">
          <p className="font-semibold text-accent">What we do:</p>
          <p className="mt-1 text-secondary/82">{member.whatWeDo}</p>
        </div>
      </div>
    </article>
  )
}

export const AboutPage: React.FC<AboutPageProps> = ({ hero, why, team, transparency }) => {
  const teamRows = team.reduce<AboutTeamMember[][]>((rows, member, index) => {
    if (index % 2 === 0) {
      rows.push([member])
    } else {
      rows[rows.length - 1]?.push(member)
    }

    return rows
  }, [])

  return (
    <article className="bg-site-canvas text-foreground">
      <section className="pt-12 pb-12 sm:pt-16 sm:pb-16 lg:pt-16 lg:pb-14">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-20">
            <div className="max-w-2xl">
              <Heading
                as="h1"
                align="left"
                size="h1"
                className="text-5xl leading-[1.05] text-balance text-secondary sm:text-6xl lg:text-7xl"
              >
                {hero.title}
              </Heading>
              <p className="mt-7 max-w-xl text-base leading-8 text-secondary/78 sm:text-lg sm:leading-9">
                {hero.description}
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <UiLink
                  href="/listing-comparison"
                  label="Compare clinics"
                  appearance="accent"
                  size="lg"
                  className={primaryCtaClassName}
                />
                <UiLink
                  href="/partners/clinics"
                  label="For clinics"
                  appearance="outline"
                  size="lg"
                  className={secondaryCtaClassName}
                />
              </div>
            </div>
            <div className="relative aspect-[1.32] overflow-hidden rounded-xl bg-site-section">
              <Image
                src={hero.image.src}
                alt={hero.image.alt}
                fill
                sizes={hero.image.sizes ?? '(max-width: 1024px) 100vw, 50vw'}
                quality={hero.image.quality ?? 75}
                priority
                className="object-cover"
                style={resolveImageObjectPositionStyle(hero.image)}
              />
            </div>
          </div>
        </Container>
      </section>

      <SplitSection section={why} />

      <section className="py-14 sm:py-18 lg:py-20">
        <Container>
          <div className="max-w-3xl">
            <Heading as="h2" align="left" size="h4" className="text-secondary">
              People behind the platform
            </Heading>
          </div>
          <div className="mt-10 space-y-8 lg:mt-11">
            {teamRows.map((row, rowIndex) => (
              <div
                key={`team-row-${rowIndex}`}
                className={cn(
                  'grid gap-x-20 gap-y-8 lg:grid-cols-2',
                  rowIndex < teamRows.length - 1 && 'border-b border-site-divider/70 pb-8',
                )}
              >
                {row.map((member) => (
                  <TeamMember key={`${member.name}-${member.role}`} member={member} />
                ))}
              </div>
            ))}
          </div>
        </Container>
      </section>

      <SplitSection section={transparency} variant="ruled" />
    </article>
  )
}
