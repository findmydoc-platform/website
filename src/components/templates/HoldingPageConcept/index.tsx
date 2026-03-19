import type { StaticImageData } from 'next/image'
import Image from 'next/image'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Heading } from '@/components/atoms/Heading'
import { ImmersiveVideoHero } from '@/components/molecules/ImmersiveVideoHero'
import { Container } from '@/components/molecules/Container'
import { UiLink, type UiLinkProps } from '@/components/molecules/Link'
import { HoldingPageContactForm } from './ContactForm.client'
import type { HoldingPageContactFormLabels } from './contactForm.shared'
import { cn } from '@/utilities/ui'

export type HoldingPageConceptSignal = {
  title: string
  body: string
  icon: LucideIcon
}

export type HoldingPageConceptSearchSnapshot = {
  internalLinks: UiLinkProps[]
  metaDescription: string
  metaTitle: string
  primaryKeyword: string
  searchIntent: string
}

export type HoldingPageConceptMediaNote = {
  badge: string
  description: string
  title: string
}

export type HoldingPageConceptHeroVideo = {
  crossfadeMs?: number
  ctaHref?: string
  playbackRate?: number
  posterSrc?: StaticImageData | string
  requiredLabel?: string
  videoBlurPx?: number
  subheadlineText?: string
  useReducedMotionFallback?: boolean
  videoSrc?: string
  withCrossfade?: boolean
}

export type HoldingPageConceptVisualVariant =
  | 'openLobby'
  | 'planningBoard'
  | 'dentalBanner'
  | 'precisionLens'
  | 'conversationRibbon'
  | 'labGallery'
  | 'privateSuite'
  | 'routeTimeline'
  | 'standardsGrid'
  | 'platformMosaic'
  | 'videoStage'
  | 'videoSplit'
  | 'videoPanorama'
  | 'videoImmersiveHero'

export type HoldingPageConceptProps = {
  backgroundImage: StaticImageData | string
  backgroundImageClassName?: string
  bestFor: string
  contactConsentCompact?: string
  contactConsentFull?: string
  contactEyebrow?: string
  contactFormLabels?: HoldingPageContactFormLabels
  contactFormSlug?: string
  contactDescription: string
  contactMode?: 'compact' | 'full'
  contactTitle: string
  description: string
  eyebrow: string
  footerLinks: UiLinkProps[]
  heroVideo?: HoldingPageConceptHeroVideo
  heroOverlay?: ReactNode
  layoutMode?: 'balanced' | 'video'
  mediaNote: HoldingPageConceptMediaNote
  narrative: string
  overlayClassName?: string
  primaryCtaLabel: string
  searchSnapshot: HoldingPageConceptSearchSnapshot
  signals: HoldingPageConceptSignal[]
  specialties: string[]
  statusLabel?: string
  supportingNote: string
  themeName: string
  title: string
  visualVariant: HoldingPageConceptVisualVariant
  whatYouGetEyebrow?: string
  whySectionEyebrow?: string
  whySectionHeading?: string
}

type SharedConceptData = Omit<HoldingPageConceptProps, 'visualVariant'>

const baseSurfaceClassName =
  'border border-white/74 bg-white/84 shadow-[0_28px_90px_-48px_rgba(15,23,42,0.26)] backdrop-blur-xl'
const mutedSurfaceClassName =
  'border border-slate-200/88 bg-slate-50/88 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.2)] backdrop-blur-xl'
const tintedSurfaceClassName =
  'border border-sky-100/92 bg-white/90 shadow-[0_24px_84px_-50px_rgba(8,47,73,0.24)] backdrop-blur-xl'

function MetadataPills({
  statusLabel,
  themeName,
  isVideoLayout,
  className,
}: {
  className?: string
  isVideoLayout: boolean
  statusLabel: string
  themeName: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 text-sm text-slate-600', className)}>
      <span className="inline-flex rounded-full border border-slate-200 bg-white/92 px-3 py-1 font-medium tracking-[0.24em] uppercase shadow-sm">
        {statusLabel}
      </span>
      <span className="inline-flex rounded-full border border-slate-200 bg-white/78 px-3 py-1 shadow-sm">
        {themeName}
      </span>
      {isVideoLayout ? (
        <span className="inline-flex rounded-full border border-sky-200 bg-sky-50/92 px-3 py-1 text-sky-700 shadow-sm">
          Video-ready direction
        </span>
      ) : null}
    </div>
  )
}

function HeroCopy({
  description,
  eyebrow,
  specialties,
  title,
  className,
  titleClassName,
  descriptionClassName,
  chipClassName,
}: {
  chipClassName?: string
  className?: string
  description: string
  descriptionClassName?: string
  eyebrow: string
  specialties: string[]
  title: string
  titleClassName?: string
}) {
  return (
    <div className={className}>
      <p className="text-sm font-semibold tracking-[0.28em] text-[#0f8f85] uppercase">{eyebrow}</p>

      <Heading
        as="h1"
        align="left"
        variant="default"
        className={cn(
          'mt-4 text-4xl leading-[1.02] font-semibold text-slate-950 sm:text-5xl lg:text-7xl',
          titleClassName,
        )}
      >
        {title}
      </Heading>

      <p className={cn('mt-6 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg', descriptionClassName)}>
        {description}
      </p>

      {specialties.length > 0 ? (
        <div className="mt-8 flex flex-wrap gap-3">
          {specialties.map((specialty) => (
            <span
              key={specialty}
              className={cn(
                'inline-flex rounded-full border border-slate-200 bg-slate-50/92 px-4 py-2 text-sm text-slate-700',
                chipClassName,
              )}
            >
              {specialty}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function NarrativePanel({ narrative, className }: { className?: string; narrative: string }) {
  return (
    <div className={cn(baseSurfaceClassName, 'rounded-[28px] p-5', className)}>
      <p className="text-xs font-semibold tracking-[0.28em] text-slate-500 uppercase">Narrative fit</p>
      <p className="mt-3 text-base leading-7 text-slate-700">{narrative}</p>
    </div>
  )
}

function SearchPanel({
  className,
  searchSnapshot,
}: {
  className?: string
  searchSnapshot: HoldingPageConceptSearchSnapshot
}) {
  return (
    <div className={cn(tintedSurfaceClassName, 'rounded-[28px] p-5', className)}>
      <p className="text-xs font-semibold tracking-[0.28em] text-slate-500 uppercase">Search fit</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
          Keyword: {searchSnapshot.primaryKeyword}
        </span>
        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
          Intent: {searchSnapshot.searchIntent}
        </span>
      </div>

      <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50/88 p-4">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-slate-500 uppercase">Meta title</p>
        <p className="mt-2 text-sm font-medium text-slate-900">{searchSnapshot.metaTitle}</p>

        <p className="mt-4 text-[11px] font-semibold tracking-[0.22em] text-slate-500 uppercase">Meta description</p>
        <p className="mt-2 text-sm leading-6 text-slate-700">{searchSnapshot.metaDescription}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {searchSnapshot.internalLinks.map((link) => (
          <UiLink
            key={`${link.href}-${link.label ?? 'internal-link'}`}
            {...link}
            className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 transition-colors hover:bg-white hover:text-slate-950"
          />
        ))}
      </div>
    </div>
  )
}

function SignalCards({
  signals,
  className,
  cardClassName,
  numbered = false,
  orientation = 'grid',
}: {
  cardClassName?: string
  className?: string
  numbered?: boolean
  orientation?: 'grid' | 'stack'
  signals: HoldingPageConceptSignal[]
}) {
  const gridClassName =
    orientation === 'stack'
      ? 'grid gap-4'
      : signals.length <= 1
        ? 'grid gap-4 md:grid-cols-1'
        : signals.length === 2
          ? 'grid gap-4 md:grid-cols-2'
          : 'grid gap-4 md:grid-cols-3'

  return (
    <div className={cn(gridClassName, className)}>
      {signals.map((signal, index) => {
        const Icon = signal.icon

        return (
          <div key={signal.title} className={cn(baseSurfaceClassName, 'rounded-[24px] p-5', cardClassName)}>
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-[#0f8f85]" aria-hidden="true" />
              {numbered ? (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                  {index + 1}
                </span>
              ) : null}
            </div>
            <p className="mt-4 text-lg font-medium text-slate-950">{signal.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{signal.body}</p>
          </div>
        )
      })}
    </div>
  )
}

function MediaPanel({
  backgroundImage,
  backgroundImageClassName,
  className,
  isVideoLayout,
  mediaNote,
  noteClassName,
  frameClassName,
  imageClassName,
  overlayToneClassName = 'from-white/78 via-white/10 to-transparent',
}: {
  backgroundImage: StaticImageData | string
  backgroundImageClassName?: string
  className?: string
  frameClassName?: string
  imageClassName?: string
  isVideoLayout: boolean
  mediaNote: HoldingPageConceptMediaNote
  noteClassName?: string
  overlayToneClassName?: string
}) {
  return (
    <div className={cn(baseSurfaceClassName, 'p-3', className)}>
      <div className={cn('relative overflow-hidden bg-slate-100', frameClassName)}>
        <Image
          src={backgroundImage}
          alt={mediaNote.title}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className={cn('object-cover object-center', backgroundImageClassName, imageClassName)}
        />
        <div className={cn('absolute inset-0 bg-linear-to-t', overlayToneClassName)} />

        <div className="absolute inset-x-4 top-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-white/82 bg-white/90 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-slate-700 uppercase backdrop-blur-sm">
            {mediaNote.badge}
          </span>
          {isVideoLayout ? (
            <span className="inline-flex rounded-full border border-sky-200 bg-sky-50/92 px-3 py-1 text-xs font-medium text-sky-700 backdrop-blur-sm">
              Motion-led hero
            </span>
          ) : null}
        </div>

        <div className="absolute inset-x-4 bottom-4">
          <div
            className={cn(
              'max-w-md rounded-[24px] border border-white/82 bg-white/90 p-4 backdrop-blur-md',
              noteClassName,
            )}
          >
            <p className="text-[11px] font-semibold tracking-[0.22em] text-slate-500 uppercase">Media note</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">{mediaNote.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{mediaNote.description}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactPanel({
  className,
  contactConsentCompact,
  contactConsentFull,
  contactEyebrow,
  contactFormLabels,
  contactFormSlug,
  contactDescription,
  contactMode,
  contactTitle,
  primaryCtaLabel,
  layout = 'card',
}: {
  className?: string
  contactConsentCompact?: string
  contactConsentFull?: string
  contactEyebrow?: string
  contactFormLabels?: HoldingPageContactFormLabels
  contactFormSlug?: string
  contactDescription: string
  contactMode: 'compact' | 'full'
  contactTitle: string
  layout?: 'card' | 'strip'
  primaryCtaLabel: string
}) {
  const isCompactContact = contactMode === 'compact'

  return (
    <div
      id="contact"
      className={cn(
        baseSurfaceClassName,
        layout === 'strip' ? 'rounded-[32px] p-5 lg:p-6' : 'rounded-[32px] p-6 lg:p-7',
        className,
      )}
    >
      <div className={cn(layout === 'strip' && 'lg:flex lg:items-start lg:justify-between lg:gap-6')}>
        <div className={cn(layout === 'strip' && 'lg:max-w-md')}>
          <p className="text-xs font-semibold tracking-[0.28em] text-slate-500 uppercase">
            {contactEyebrow ?? 'Contact'}
          </p>

          <Heading
            as="h2"
            align="left"
            variant="default"
            size="h4"
            className="mt-4 text-3xl font-semibold text-slate-950"
          >
            {contactTitle}
          </Heading>

          <p className="mt-3 text-sm leading-6 text-slate-700">{contactDescription}</p>
        </div>

        <div className={cn('mt-6', layout === 'strip' && 'lg:mt-0 lg:min-w-[320px] lg:flex-1')}>
          <HoldingPageContactForm
            contactMode={contactMode}
            contactFormSlug={contactFormSlug}
            labels={contactFormLabels}
            primaryCtaLabel={primaryCtaLabel}
          />
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        {isCompactContact
          ? (contactConsentCompact ?? 'We use your email to share launch updates and first-access information.')
          : (contactConsentFull ??
            'By sending this request, you agree that findmydoc may contact you about your inquiry.')}
      </p>
    </div>
  )
}

function FooterBlock({
  bestFor,
  footerLinks,
  supportingNote,
  className,
}: {
  bestFor: string
  className?: string
  footerLinks: UiLinkProps[]
  supportingNote: string
}) {
  const hasAudienceCopy = Boolean(bestFor.trim() || supportingNote.trim())

  return (
    <div className={cn('mt-10 border-t border-slate-200/90 pt-6', className)}>
      <div
        className={cn(
          'flex flex-col gap-6',
          hasAudienceCopy ? 'lg:flex-row lg:items-end lg:justify-between' : 'lg:flex-row lg:justify-end',
        )}
      >
        {hasAudienceCopy ? (
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.28em] text-slate-500 uppercase">Best used for</p>
            {bestFor ? (
              <Heading
                as="h3"
                align="left"
                variant="default"
                size="h5"
                className="mt-3 text-xl font-semibold text-slate-950"
              >
                {bestFor}
              </Heading>
            ) : null}
            {supportingNote ? <p className="mt-2 text-sm leading-6 text-slate-600">{supportingNote}</p> : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {footerLinks.map((link) => (
            <UiLink
              key={`${link.href}-${link.label ?? 'link'}`}
              {...link}
              className="text-slate-600 transition-colors hover:text-slate-950"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function BackgroundCanvas({
  backgroundImage,
  backgroundImageClassName,
  overlayClassName,
  visualVariant,
}: Pick<SharedConceptData, 'backgroundImage' | 'backgroundImageClassName' | 'overlayClassName'> & {
  visualVariant: HoldingPageConceptVisualVariant
}) {
  const decorativeClassName = {
    openLobby:
      'bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.18),transparent_26%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_34%)]',
    planningBoard:
      'bg-[linear-gradient(rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px)] bg-[size:34px_34px]',
    dentalBanner:
      'bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.18),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0)_0%,rgba(186,230,253,0.22)_100%)]',
    precisionLens:
      'bg-[radial-gradient(circle_at_68%_14%,rgba(125,211,252,0.22),transparent_18%),radial-gradient(circle_at_82%_26%,rgba(255,255,255,0.82),transparent_10%),linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(226,232,240,0.26)_100%)]',
    conversationRibbon:
      'bg-[linear-gradient(180deg,rgba(220,252,231,0.24)_0%,rgba(255,255,255,0)_42%),radial-gradient(circle_at_bottom_right,rgba(125,211,252,0.18),transparent_24%)]',
    labGallery:
      'bg-[linear-gradient(135deg,rgba(204,251,241,0.16)_0%,rgba(255,255,255,0)_42%),radial-gradient(circle_at_bottom_left,rgba(165,243,252,0.24),transparent_28%)]',
    privateSuite:
      'bg-[linear-gradient(90deg,rgba(255,255,255,0.5)_0%,rgba(226,232,240,0.22)_50%,rgba(255,255,255,0.5)_100%)]',
    routeTimeline:
      'bg-[linear-gradient(90deg,transparent_0,transparent_11.6rem,rgba(148,163,184,0.18)_11.6rem,rgba(148,163,184,0.18)_11.75rem,transparent_11.75rem),radial-gradient(circle_at_top_right,rgba(34,197,94,0.14),transparent_28%)]',
    standardsGrid:
      'bg-[linear-gradient(rgba(148,163,184,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.22)_1px,transparent_1px),radial-gradient(circle_at_top_left,rgba(103,232,249,0.2),transparent_26%)] bg-[size:28px_28px]',
    platformMosaic:
      'bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(241,245,249,0.38)_100%)]',
    videoStage:
      'bg-[radial-gradient(circle_at_top_center,rgba(56,189,248,0.2),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(224,242,254,0.36)_100%)]',
    videoSplit:
      'bg-[linear-gradient(90deg,rgba(239,246,255,0.9)_0%,rgba(239,246,255,0.9)_39%,rgba(255,255,255,0)_39%),radial-gradient(circle_at_top_right,rgba(45,212,191,0.14),transparent_28%)]',
    videoPanorama:
      'bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(236,253,245,0.34)_100%)]',
    videoImmersiveHero:
      'bg-[radial-gradient(circle_at_top_center,rgba(56,189,248,0.14),transparent_26%),linear-gradient(180deg,rgba(248,250,252,0)_0%,rgba(241,245,249,0.58)_100%)]',
  }[visualVariant]

  return (
    <div className="pointer-events-none absolute inset-0">
      {backgroundImage ? (
        <Image
          src={backgroundImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className={cn('object-cover object-center opacity-18 saturate-75', backgroundImageClassName)}
        />
      ) : null}
      <div
        className={cn('absolute inset-0 bg-linear-to-br from-white/94 via-white/82 to-sky-50/84', overlayClassName)}
      />
      <div className={cn('absolute inset-0', decorativeClassName)} />
    </div>
  )
}

function renderVariantLayout(
  visualVariant: HoldingPageConceptVisualVariant,
  data: SharedConceptData,
  isVideoLayout: boolean,
) {
  const {
    backgroundImage,
    backgroundImageClassName,
    bestFor,
    contactConsentCompact,
    contactConsentFull,
    contactEyebrow,
    contactFormLabels,
    contactFormSlug,
    contactDescription,
    contactMode = 'full',
    contactTitle,
    description,
    eyebrow,
    footerLinks,
    heroOverlay,
    heroVideo,
    mediaNote,
    narrative,
    primaryCtaLabel,
    searchSnapshot,
    signals,
    specialties,
    statusLabel,
    supportingNote,
    title,
    whatYouGetEyebrow,
    whySectionEyebrow,
    whySectionHeading,
  } = data

  switch (visualVariant) {
    case 'openLobby':
      return (
        <>
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)]">
            <div className="space-y-6">
              <div className={cn(baseSurfaceClassName, 'rounded-[48px_18px_48px_18px] p-7 sm:p-9 lg:p-10')}>
                <HeroCopy description={description} eyebrow={eyebrow} specialties={specialties} title={title} />
              </div>

              <div className="grid gap-4 xl:grid-cols-[0.84fr_1.16fr]">
                <NarrativePanel narrative={narrative} className="rounded-[18px_34px_34px_34px]" />
                <SearchPanel searchSnapshot={searchSnapshot} className="rounded-[34px_18px_34px_34px]" />
              </div>

              <SignalCards signals={signals} className="lg:grid-cols-3" />
            </div>

            <div className="space-y-5 lg:pt-6">
              <MediaPanel
                backgroundImage={backgroundImage}
                backgroundImageClassName={backgroundImageClassName}
                frameClassName="aspect-[4/4.9] rounded-[38px]"
                isVideoLayout={isVideoLayout}
                mediaNote={mediaNote}
                noteClassName="ml-auto"
              />
              <ContactPanel
                contactDescription={contactDescription}
                contactMode={contactMode}
                contactTitle={contactTitle}
                primaryCtaLabel={primaryCtaLabel}
              />
            </div>
          </div>

          <FooterBlock bestFor={bestFor} footerLinks={footerLinks} supportingNote={supportingNote} />
        </>
      )

    case 'planningBoard':
      return (
        <>
          <div className="grid gap-8 lg:grid-cols-[minmax(240px,0.42fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <SearchPanel searchSnapshot={searchSnapshot} className="rounded-[24px] lg:sticky lg:top-8" />
              <NarrativePanel narrative={narrative} className="-rotate-1 rounded-[30px_20px_26px_20px] bg-white/92" />
            </div>

            <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(340px,0.68fr)]">
                <div className="relative overflow-hidden rounded-[42px] border border-white/78 bg-white/84 p-7 shadow-[0_34px_110px_-54px_rgba(15,23,42,0.26)] backdrop-blur-xl sm:p-10">
                  <div className="absolute top-6 right-6 h-20 w-20 rounded-full border border-sky-100 bg-sky-50/70" />
                  <HeroCopy
                    description={description}
                    eyebrow={eyebrow}
                    specialties={specialties}
                    title={title}
                    chipClassName="bg-white"
                    titleClassName="max-w-3xl"
                  />
                </div>

                <MediaPanel
                  backgroundImage={backgroundImage}
                  backgroundImageClassName={backgroundImageClassName}
                  className="rotate-1 rounded-[18px_42px_18px_42px]"
                  frameClassName="aspect-[4/4.6] rounded-[18px_36px_18px_36px]"
                  isVideoLayout={isVideoLayout}
                  mediaNote={mediaNote}
                  noteClassName="-rotate-2"
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.04fr_0.96fr]">
                <SignalCards signals={signals} orientation="stack" cardClassName="rounded-[22px] bg-white/92" />
                <ContactPanel
                  contactDescription={contactDescription}
                  contactMode={contactMode}
                  contactTitle={contactTitle}
                  primaryCtaLabel={primaryCtaLabel}
                  className="rounded-[42px_18px_42px_18px]"
                />
              </div>
            </div>
          </div>

          <FooterBlock bestFor={bestFor} footerLinks={footerLinks} supportingNote={supportingNote} />
        </>
      )

    case 'dentalBanner':
      return (
        <>
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-[40px] border border-white/78 bg-white/84 p-3 shadow-[0_34px_100px_-52px_rgba(15,23,42,0.28)] backdrop-blur-xl">
              <div className="relative aspect-[16/7] overflow-hidden rounded-[32px]">
                <Image
                  src={backgroundImage}
                  alt={mediaNote.title}
                  fill
                  priority
                  sizes="100vw"
                  className={cn('object-cover object-center', backgroundImageClassName)}
                />
                <div className="absolute inset-0 bg-linear-to-r from-white/94 via-white/65 to-transparent" />
                <div className="absolute top-5 left-5 max-w-2xl rounded-[28px] bg-white/90 p-6 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.24)] backdrop-blur-md sm:p-8">
                  <HeroCopy
                    description={description}
                    eyebrow={eyebrow}
                    specialties={specialties}
                    title={title}
                    titleClassName="text-3xl sm:text-5xl lg:text-6xl"
                    descriptionClassName="max-w-xl"
                  />
                </div>
                <div className="absolute top-5 right-5 max-w-xs rounded-[24px] border border-white/80 bg-white/88 p-4 backdrop-blur-md">
                  <p className="text-[11px] font-semibold tracking-[0.22em] text-slate-500 uppercase">
                    {mediaNote.badge}
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-950">{mediaNote.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{mediaNote.description}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.96fr_0.82fr_1.08fr]">
              <NarrativePanel narrative={narrative} className="rounded-[18px_30px_18px_30px]" />
              <SignalCards
                signals={signals}
                orientation="stack"
                className="grid-cols-1"
                cardClassName="rounded-[18px] border-slate-200 bg-slate-50/92"
              />
              <div className="space-y-4">
                <SearchPanel searchSnapshot={searchSnapshot} className="rounded-[34px_18px_34px_18px]" />
                <ContactPanel
                  contactDescription={contactDescription}
                  contactMode={contactMode}
                  contactTitle={contactTitle}
                  primaryCtaLabel={primaryCtaLabel}
                  className="rounded-[18px_34px_18px_34px]"
                />
              </div>
            </div>
          </div>

          <FooterBlock bestFor={bestFor} footerLinks={footerLinks} supportingNote={supportingNote} />
        </>
      )

    case 'precisionLens':
      return (
        <>
          <div className="relative">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-sm font-semibold tracking-[0.28em] text-[#0f8f85] uppercase">{eyebrow}</p>
              <Heading
                as="h1"
                align="center"
                variant="default"
                className="mt-5 text-4xl leading-[1.02] font-semibold text-slate-950 sm:text-5xl lg:text-7xl"
              >
                {title}
              </Heading>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">{description}</p>
            </div>

            <div className="pointer-events-none absolute top-12 right-[4%] hidden h-60 w-60 rounded-full border border-white/84 bg-white/70 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.24)] backdrop-blur-xl lg:block" />

            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(340px,0.7fr)] lg:items-center">
              <div className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
                <NarrativePanel narrative={narrative} className="rounded-[32px] bg-white/92" />
                <SearchPanel searchSnapshot={searchSnapshot} className="rounded-[32px] bg-white/94" />
              </div>

              <div className="relative mx-auto h-[26rem] w-full max-w-[26rem] overflow-hidden rounded-full border border-white/82 bg-white/88 p-4 shadow-[0_36px_110px_-54px_rgba(15,23,42,0.28)] backdrop-blur-xl">
                <div className="relative h-full overflow-hidden rounded-full">
                  <Image
                    src={backgroundImage}
                    alt={mediaNote.title}
                    fill
                    priority
                    sizes="(min-width: 1024px) 28rem, 100vw"
                    className={cn('object-cover object-center', backgroundImageClassName)}
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-white/58 via-transparent to-white/18" />
                </div>
                <div className="absolute right-10 bottom-10 left-10 rounded-[28px] border border-white/82 bg-white/90 p-5 backdrop-blur-md">
                  <p className="text-[11px] font-semibold tracking-[0.22em] text-slate-500 uppercase">
                    {mediaNote.badge}
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-950">{mediaNote.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{mediaNote.description}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {specialties.map((specialty) => (
                <span
                  key={specialty}
                  className="inline-flex rounded-full border border-slate-200 bg-white/86 px-4 py-2 text-sm text-slate-700"
                >
                  {specialty}
                </span>
              ))}
            </div>

            <SignalCards signals={signals} className="mt-8" cardClassName="rounded-[24px] bg-white/90" />
            <ContactPanel
              contactDescription={contactDescription}
              contactMode={contactMode}
              contactTitle={contactTitle}
              primaryCtaLabel={primaryCtaLabel}
              layout="strip"
              className="mt-8 rounded-[40px]"
            />
          </div>

          <FooterBlock bestFor={bestFor} footerLinks={footerLinks} supportingNote={supportingNote} />
        </>
      )

    case 'conversationRibbon':
      return (
        <>
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-[42px] border border-white/80 bg-white/88 p-3 shadow-[0_38px_110px_-58px_rgba(15,23,42,0.28)] backdrop-blur-xl">
              <div className="relative aspect-[16/8.2] overflow-hidden rounded-[34px]">
                <Image
                  src={backgroundImage}
                  alt={mediaNote.title}
                  fill
                  priority
                  sizes="100vw"
                  className={cn('object-cover object-center', backgroundImageClassName)}
                />
                <div className="absolute inset-0 bg-linear-to-r from-white/96 via-white/70 to-transparent" />
                <div className="absolute top-6 left-6 max-w-xl">
                  <HeroCopy
                    description={description}
                    eyebrow={eyebrow}
                    specialties={specialties}
                    title={title}
                    titleClassName="text-3xl sm:text-5xl lg:text-6xl"
                  />
                </div>
                <div className="absolute right-6 bottom-6 max-w-sm rounded-[28px_18px_28px_18px] border border-white/84 bg-white/90 p-5 backdrop-blur-md">
                  <p className="text-[11px] font-semibold tracking-[0.22em] text-slate-500 uppercase">Media note</p>
                  <p className="mt-2 text-base font-semibold text-slate-950">{mediaNote.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{mediaNote.description}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.96fr)]">
              <div className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
                <NarrativePanel narrative={narrative} className="rounded-[40px_18px_40px_18px]" />
                <SearchPanel searchSnapshot={searchSnapshot} className="rounded-[18px_40px_18px_40px]" />
                <SignalCards
                  signals={signals}
                  className="xl:col-span-2"
                  cardClassName="rounded-[20px] -rotate-[0.5deg] bg-white/92"
                />
              </div>

              <ContactPanel
                contactDescription={contactDescription}
                contactMode={contactMode}
                contactTitle={contactTitle}
                primaryCtaLabel={primaryCtaLabel}
                className="rounded-[40px]"
              />
            </div>
          </div>

          <FooterBlock bestFor={bestFor} footerLinks={footerLinks} supportingNote={supportingNote} />
        </>
      )

    case 'labGallery':
      return (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(250px,0.34fr)_minmax(0,0.86fr)_minmax(320px,0.56fr)]">
            <div className="space-y-5">
              <MediaPanel
                backgroundImage={backgroundImage}
                backgroundImageClassName={backgroundImageClassName}
                className="rounded-[26px] p-2"
                frameClassName="aspect-[4/6.6] rounded-[20px]"
                isVideoLayout={isVideoLayout}
                mediaNote={mediaNote}
                noteClassName="max-w-[14rem]"
              />
              <NarrativePanel narrative={narrative} className="rounded-[20px_34px_20px_34px]" />
            </div>

            <div className="space-y-5">
              <div className={cn(baseSurfaceClassName, 'rounded-[30px_48px_30px_18px] p-7 sm:p-10')}>
                <HeroCopy
                  description={description}
                  eyebrow={eyebrow}
                  specialties={specialties}
                  title={title}
                  titleClassName="max-w-3xl text-4xl sm:text-5xl lg:text-6xl"
                />
              </div>
              <SignalCards signals={signals} className="md:grid-cols-2" cardClassName="rounded-[18px] bg-slate-50/92" />
            </div>

            <div className="space-y-5 xl:pt-16">
              <SearchPanel searchSnapshot={searchSnapshot} className="rounded-[40px_18px_40px_18px]" />
              <ContactPanel
                contactDescription={contactDescription}
                contactMode={contactMode}
                contactTitle={contactTitle}
                primaryCtaLabel={primaryCtaLabel}
                className="rounded-[18px_40px_18px_40px]"
              />
            </div>
          </div>

          <FooterBlock bestFor={bestFor} footerLinks={footerLinks} supportingNote={supportingNote} />
        </>
      )

    case 'privateSuite':
      return (
        <>
          <div className="grid gap-8 lg:grid-cols-[minmax(320px,0.62fr)_minmax(0,0.92fr)]">
            <div className="space-y-5">
              <div className="rounded-[56px] border border-white/78 bg-white/72 p-3 shadow-[0_36px_120px_-58px_rgba(15,23,42,0.22)] backdrop-blur-xl">
                <div className="relative aspect-[4/5.8] overflow-hidden rounded-[46px]">
                  <Image
                    src={backgroundImage}
                    alt={mediaNote.title}
                    fill
                    priority
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    className={cn('object-cover object-center', backgroundImageClassName)}
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-white/46 via-transparent to-white/14" />
                </div>
              </div>

              <div className={cn(mutedSurfaceClassName, 'rounded-[24px] p-5')}>
                <p className="text-[11px] font-semibold tracking-[0.22em] text-slate-500 uppercase">
                  {mediaNote.badge}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{mediaNote.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{mediaNote.description}</p>
              </div>
            </div>

            <div className="flex flex-col justify-between">
              <div className="max-w-3xl">
                <HeroCopy
                  description={description}
                  eyebrow={eyebrow}
                  specialties={specialties}
                  title={title}
                  titleClassName="text-4xl sm:text-5xl lg:text-[4.7rem]"
                  chipClassName="bg-white"
                />
              </div>

              <div className="mt-8 grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
                <NarrativePanel narrative={narrative} className="rounded-[20px]" />
                <SearchPanel searchSnapshot={searchSnapshot} className="rounded-[20px]" />
              </div>

              <SignalCards signals={signals} className="mt-8" cardClassName="rounded-[18px] bg-white/92" />

              <ContactPanel
                contactDescription={contactDescription}
                contactMode={contactMode}
                contactTitle={contactTitle}
                primaryCtaLabel={primaryCtaLabel}
                layout="strip"
                className="mt-8 rounded-[28px]"
              />
            </div>
          </div>

          <FooterBlock bestFor={bestFor} footerLinks={footerLinks} supportingNote={supportingNote} />
        </>
      )

    case 'routeTimeline':
      return (
        <>
          <div className="grid gap-8 lg:grid-cols-[minmax(260px,0.5fr)_minmax(0,1fr)]">
            <div className="relative pl-10">
              <div className="absolute top-5 bottom-6 left-4 w-px bg-slate-200" />
              <div className="space-y-5">
                <NarrativePanel narrative={narrative} className="rounded-[22px_32px_22px_22px]" />
                {signals.map((signal, index) => {
                  const Icon = signal.icon

                  return (
                    <div key={signal.title} className={cn(baseSurfaceClassName, 'relative rounded-[22px] p-5')}>
                      <div className="absolute top-6 -left-[2.05rem] flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700">
                        {index + 1}
                      </div>
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-[#0f8f85]" aria-hidden="true" />
                        <p className="text-base font-semibold text-slate-950">{signal.title}</p>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-700">{signal.body}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid gap-5 xl:grid-cols-[0.94fr_1.06fr]">
                <div className={cn(baseSurfaceClassName, 'rounded-[40px] p-7 sm:p-10')}>
                  <HeroCopy description={description} eyebrow={eyebrow} specialties={specialties} title={title} />
                </div>
                <SearchPanel searchSnapshot={searchSnapshot} className="rounded-[40px_18px_40px_18px]" />
              </div>

              <MediaPanel
                backgroundImage={backgroundImage}
                backgroundImageClassName={backgroundImageClassName}
                className="rounded-[28px] p-2"
                frameClassName="aspect-[16/8.8] rounded-[24px]"
                isVideoLayout={isVideoLayout}
                mediaNote={mediaNote}
                noteClassName="max-w-lg"
              />

              <ContactPanel
                contactDescription={contactDescription}
                contactMode={contactMode}
                contactTitle={contactTitle}
                primaryCtaLabel={primaryCtaLabel}
                layout="strip"
                className="rounded-[40px_18px_40px_18px]"
              />
            </div>
          </div>

          <FooterBlock bestFor={bestFor} footerLinks={footerLinks} supportingNote={supportingNote} />
        </>
      )

    case 'standardsGrid':
      return (
        <>
          <div className="grid gap-4 lg:grid-cols-12">
            <div className={cn(baseSurfaceClassName, 'rounded-[18px] p-7 sm:p-9 lg:col-span-7 lg:row-span-2')}>
              <HeroCopy
                description={description}
                eyebrow={eyebrow}
                specialties={specialties}
                title={title}
                titleClassName="text-4xl sm:text-5xl lg:text-6xl"
                chipClassName="rounded-[12px]"
              />
            </div>

            <SearchPanel searchSnapshot={searchSnapshot} className="rounded-[18px] lg:col-span-5" />

            <MediaPanel
              backgroundImage={backgroundImage}
              backgroundImageClassName={backgroundImageClassName}
              className="rounded-[18px] lg:col-span-5 lg:row-span-2"
              frameClassName="aspect-[5/6] rounded-[12px]"
              isVideoLayout={isVideoLayout}
              mediaNote={mediaNote}
              noteClassName="rounded-[14px]"
              overlayToneClassName="from-white/72 via-white/10 to-transparent"
            />

            <NarrativePanel narrative={narrative} className="rounded-[18px] lg:col-span-4" />
            <ContactPanel
              contactDescription={contactDescription}
              contactMode={contactMode}
              contactTitle={contactTitle}
              primaryCtaLabel={primaryCtaLabel}
              className="rounded-[18px] lg:col-span-8"
            />

            <SignalCards
              signals={signals}
              numbered
              className="lg:col-span-12 lg:grid-cols-3"
              cardClassName="rounded-[18px] border-slate-200 bg-white/92"
            />
          </div>

          <FooterBlock bestFor={bestFor} footerLinks={footerLinks} supportingNote={supportingNote} />
        </>
      )

    case 'platformMosaic':
      return (
        <>
          <div className="grid gap-4 lg:grid-cols-12">
            <div className={cn(baseSurfaceClassName, 'rounded-[42px] p-7 sm:p-10 lg:col-span-8 lg:row-span-2')}>
              <HeroCopy
                description={description}
                eyebrow={eyebrow}
                specialties={specialties}
                title={title}
                titleClassName="max-w-4xl text-4xl sm:text-5xl lg:text-[4.9rem]"
              />
            </div>

            <NarrativePanel narrative={narrative} className="rounded-[22px_38px_22px_22px] lg:col-span-4" />

            <MediaPanel
              backgroundImage={backgroundImage}
              backgroundImageClassName={backgroundImageClassName}
              className="rounded-[28px] lg:col-span-5"
              frameClassName="aspect-[4/4.45] rounded-[22px]"
              isVideoLayout={isVideoLayout}
              mediaNote={mediaNote}
              noteClassName="max-w-xs"
            />

            <SearchPanel searchSnapshot={searchSnapshot} className="rounded-[38px_22px_22px_22px] lg:col-span-4" />

            <div className={cn(mutedSurfaceClassName, 'rounded-[22px] p-5 lg:col-span-3')}>
              <p className="text-xs font-semibold tracking-[0.28em] text-slate-500 uppercase">Platform spread</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {specialties.map((specialty) => (
                  <span
                    key={specialty}
                    className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            </div>

            <SignalCards
              signals={signals}
              className="lg:col-span-7 lg:grid-cols-3"
              cardClassName="rounded-[22px] bg-white/92"
            />

            <ContactPanel
              contactDescription={contactDescription}
              contactMode={contactMode}
              contactTitle={contactTitle}
              primaryCtaLabel={primaryCtaLabel}
              className="rounded-[22px_42px_22px_22px] lg:col-span-5"
            />
          </div>

          <FooterBlock bestFor={bestFor} footerLinks={footerLinks} supportingNote={supportingNote} />
        </>
      )

    case 'videoStage':
      return (
        <>
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <p className="text-sm font-semibold tracking-[0.28em] text-[#0f8f85] uppercase">{eyebrow}</p>
              <Heading
                as="h1"
                align="center"
                variant="default"
                className="mx-auto mt-5 max-w-5xl text-4xl leading-[1.02] font-semibold text-slate-950 sm:text-5xl lg:text-[5.5rem]"
              >
                {title}
              </Heading>
              <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-slate-700 sm:text-lg">{description}</p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                {specialties.map((specialty) => (
                  <span
                    key={specialty}
                    className="inline-flex rounded-full border border-slate-200 bg-white/86 px-4 py-2 text-sm text-slate-700"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            </div>

            <MediaPanel
              backgroundImage={backgroundImage}
              backgroundImageClassName={backgroundImageClassName}
              className="mt-8 rounded-[44px] p-4"
              frameClassName="aspect-[16/8.6] rounded-[36px]"
              isVideoLayout={isVideoLayout}
              mediaNote={mediaNote}
              noteClassName="max-w-xl"
            />

            <div className="mt-6 grid gap-4 xl:grid-cols-[0.82fr_1.08fr_0.9fr]">
              <NarrativePanel narrative={narrative} className="rounded-[28px]" />
              <SearchPanel searchSnapshot={searchSnapshot} className="rounded-[28px]" />
              <ContactPanel
                contactFormSlug={contactFormSlug}
                contactDescription={contactDescription}
                contactMode={contactMode}
                contactTitle={contactTitle}
                primaryCtaLabel={primaryCtaLabel}
                className="rounded-[28px]"
              />
            </div>

            <SignalCards signals={signals} className="mt-6" cardClassName="rounded-[20px]" />
          </div>

          <FooterBlock
            bestFor={bestFor}
            footerLinks={footerLinks}
            supportingNote={supportingNote}
            className="mx-auto max-w-6xl"
          />
        </>
      )

    case 'videoSplit':
      return (
        <>
          <div className="grid gap-6 lg:min-h-[44rem] lg:grid-cols-[minmax(0,0.82fr)_minmax(420px,1.18fr)]">
            <div className="rounded-[44px] border border-sky-100 bg-[linear-gradient(180deg,rgba(239,246,255,0.94)_0%,rgba(255,255,255,0.84)_100%)] p-7 shadow-[0_34px_100px_-56px_rgba(8,47,73,0.24)] backdrop-blur-xl sm:p-10 lg:flex lg:flex-col lg:justify-between">
              <div>
                <HeroCopy
                  description={description}
                  eyebrow={eyebrow}
                  specialties={specialties}
                  title={title}
                  chipClassName="bg-white"
                  titleClassName="text-4xl sm:text-5xl lg:text-6xl"
                />
              </div>

              <div className="mt-8 grid gap-4">
                <NarrativePanel narrative={narrative} className="rounded-[22px] bg-white/92" />
                <ContactPanel
                  contactDescription={contactDescription}
                  contactMode={contactMode}
                  contactTitle={contactTitle}
                  primaryCtaLabel={primaryCtaLabel}
                  className="rounded-[22px] bg-white/92"
                />
              </div>
            </div>

            <div className="space-y-5">
              <MediaPanel
                backgroundImage={backgroundImage}
                backgroundImageClassName={backgroundImageClassName}
                className="rounded-[44px] p-3"
                frameClassName="aspect-[4/5.8] rounded-[34px]"
                isVideoLayout={isVideoLayout}
                mediaNote={mediaNote}
                noteClassName="max-w-sm"
              />

              <SearchPanel searchSnapshot={searchSnapshot} className="rounded-[42px_18px_42px_18px]" />
              <SignalCards signals={signals} className="md:grid-cols-2" cardClassName="rounded-[18px] bg-white/92" />
            </div>
          </div>

          <FooterBlock bestFor={bestFor} footerLinks={footerLinks} supportingNote={supportingNote} />
        </>
      )

    case 'videoPanorama':
      return (
        <>
          <div className="space-y-6">
            <div className="relative overflow-visible rounded-[44px] border border-white/78 bg-white/82 p-4 shadow-[0_38px_110px_-58px_rgba(15,23,42,0.28)] backdrop-blur-xl">
              <div className="relative aspect-[16/7] overflow-hidden rounded-[34px]">
                <Image
                  src={backgroundImage}
                  alt={mediaNote.title}
                  fill
                  priority
                  sizes="100vw"
                  className={cn('object-cover object-center', backgroundImageClassName)}
                />
                <div className="absolute inset-0 bg-linear-to-t from-white/44 via-transparent to-white/12" />
              </div>

              <div className="-mt-20 grid gap-4 px-3 lg:grid-cols-[minmax(0,1.02fr)_minmax(340px,0.68fr)]">
                <div className={cn(baseSurfaceClassName, 'rounded-[36px] p-6 sm:p-8')}>
                  <HeroCopy
                    description={description}
                    eyebrow={eyebrow}
                    specialties={specialties}
                    title={title}
                    titleClassName="text-4xl sm:text-5xl lg:text-6xl"
                  />
                </div>
                <div className={cn(baseSurfaceClassName, 'rounded-[28px] p-5 lg:mt-24')}>
                  <p className="text-[11px] font-semibold tracking-[0.22em] text-slate-500 uppercase">
                    {mediaNote.badge}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{mediaNote.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{mediaNote.description}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr_0.96fr]">
              <NarrativePanel narrative={narrative} className="rounded-[28px]" />
              <SearchPanel searchSnapshot={searchSnapshot} className="rounded-[28px]" />
              <ContactPanel
                contactDescription={contactDescription}
                contactMode={contactMode}
                contactTitle={contactTitle}
                primaryCtaLabel={primaryCtaLabel}
                className="rounded-[28px]"
              />
            </div>

            <SignalCards signals={signals} cardClassName="rounded-[20px]" />
          </div>

          <FooterBlock bestFor={bestFor} footerLinks={footerLinks} supportingNote={supportingNote} />
        </>
      )

    case 'videoImmersiveHero':
      return (
        <>
          <div className="mx-auto max-w-[94rem]">
            <div className="relative">
              {statusLabel ? (
                <div className="pointer-events-none absolute top-4 left-4 z-30 sm:top-6 sm:left-6">
                  <div className="inline-flex items-center gap-1 rounded-full border border-white/35 bg-slate-900/38 p-1 backdrop-blur-md">
                    <span className="inline-flex min-w-10 items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold tracking-[0.14em] text-white/88 uppercase">
                      {statusLabel}
                    </span>
                  </div>
                </div>
              ) : null}

              {heroOverlay ? (
                <div className="absolute top-4 right-4 z-30 sm:top-6 sm:right-6">{heroOverlay}</div>
              ) : null}

              <ImmersiveVideoHero
                ctaHref={heroVideo?.ctaHref ?? '#contact'}
                ctaLabel={primaryCtaLabel}
                crossfadeMs={heroVideo?.crossfadeMs}
                descriptionText={description}
                eyebrowText={eyebrow}
                fallbackImageSrc={backgroundImage}
                headlineText={title}
                mediaAlt={mediaNote.title}
                playbackRate={heroVideo?.playbackRate}
                posterSrc={heroVideo?.posterSrc ?? backgroundImage}
                requiredLabel={heroVideo?.requiredLabel}
                scrollHintHref="#landing-content-start"
                showScrollArrow
                subheadlineText={heroVideo?.subheadlineText}
                videoBlurPx={heroVideo?.videoBlurPx}
                useReducedMotionFallback={heroVideo?.useReducedMotionFallback}
                videoUrl={heroVideo?.videoSrc}
                withCrossfade={heroVideo?.withCrossfade ?? true}
              />
            </div>

            <div id="landing-content-start" className="mt-6 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
              <div className={cn(baseSurfaceClassName, 'flex h-full flex-col rounded-[28px] p-6 lg:p-7')}>
                <p className="text-xs font-semibold tracking-[0.28em] text-slate-500 uppercase">
                  {whySectionEyebrow ?? 'Why findmydoc'}
                </p>
                <Heading as="h2" align="left" variant="default" size="h4" className="mt-3 text-3xl text-slate-950">
                  {whySectionHeading ?? 'Compare clinics abroad with verified quality signals and trusted guidance.'}
                </Heading>
                <div className="mt-3 max-w-2xl space-y-3 text-base leading-7 text-slate-700">
                  {narrative
                    .split('\n\n')
                    .filter((paragraph) => paragraph.trim().length > 0)
                    .map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-2 xl:mt-auto">
                  {searchSnapshot.internalLinks.map((link) => (
                    <span
                      key={`${link.href}-${link.label ?? 'internal-link'}`}
                      className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
                    >
                      {link.label ?? link.href}
                    </span>
                  ))}
                </div>
              </div>

              <ContactPanel
                contactConsentCompact={contactConsentCompact}
                contactConsentFull={contactConsentFull}
                contactEyebrow={contactEyebrow}
                contactFormLabels={contactFormLabels}
                contactFormSlug={contactFormSlug}
                contactDescription={contactDescription}
                contactMode={contactMode}
                contactTitle={contactTitle}
                primaryCtaLabel={primaryCtaLabel}
                className="rounded-[28px]"
              />
            </div>

            <div className={cn(baseSurfaceClassName, 'mt-6 rounded-[24px] p-4 sm:p-5')}>
              <p className="text-[11px] font-semibold tracking-[0.22em] text-slate-500 uppercase">
                {whatYouGetEyebrow ?? 'What you get'}
              </p>
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                {signals.map((signal) => {
                  const Icon = signal.icon

                  return (
                    <div key={signal.title} className="rounded-[18px] border border-slate-200 bg-white/92 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                          <Icon className="h-4 w-4 text-[#0f8f85]" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-base font-semibold text-slate-950">{signal.title}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{signal.body}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <FooterBlock
            bestFor={bestFor}
            footerLinks={footerLinks}
            supportingNote={supportingNote}
            className="mx-auto max-w-[94rem]"
          />
        </>
      )

    default:
      return null
  }
}

export function HoldingPageConcept({
  backgroundImage,
  backgroundImageClassName,
  bestFor,
  contactConsentCompact,
  contactConsentFull,
  contactEyebrow,
  contactFormLabels,
  contactFormSlug,
  contactDescription,
  contactMode = 'full',
  contactTitle,
  description,
  eyebrow,
  footerLinks,
  heroOverlay,
  heroVideo,
  layoutMode = 'balanced',
  mediaNote,
  narrative,
  overlayClassName,
  primaryCtaLabel,
  searchSnapshot,
  signals,
  specialties,
  statusLabel = 'Coming Soon',
  supportingNote,
  themeName,
  title,
  visualVariant,
  whatYouGetEyebrow,
  whySectionEyebrow,
  whySectionHeading,
}: HoldingPageConceptProps) {
  const isVideoLayout = layoutMode === 'video'
  const showMetadataPills = visualVariant !== 'videoImmersiveHero'

  const sharedData: SharedConceptData = {
    backgroundImage,
    backgroundImageClassName,
    bestFor,
    contactConsentCompact,
    contactConsentFull,
    contactEyebrow,
    contactFormLabels,
    contactFormSlug,
    contactDescription,
    contactMode,
    contactTitle,
    description,
    eyebrow,
    footerLinks,
    heroOverlay,
    heroVideo,
    layoutMode,
    mediaNote,
    narrative,
    overlayClassName,
    primaryCtaLabel,
    searchSnapshot,
    signals,
    specialties,
    statusLabel,
    supportingNote,
    themeName,
    title,
    whatYouGetEyebrow,
    whySectionEyebrow,
    whySectionHeading,
  }

  return (
    <section className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f8fcfd_0%,#eef6f8_52%,#f9fbfc_100%)] text-slate-950">
      <BackgroundCanvas
        backgroundImage={backgroundImage}
        backgroundImageClassName={backgroundImageClassName}
        overlayClassName={overlayClassName}
        visualVariant={visualVariant}
      />

      <Container className="relative z-10 py-6 sm:py-8 lg:py-10">
        {showMetadataPills ? (
          <MetadataPills
            className="mb-8"
            isVideoLayout={isVideoLayout}
            statusLabel={statusLabel}
            themeName={themeName}
          />
        ) : null}
        {renderVariantLayout(visualVariant, sharedData, isVideoLayout)}
      </Container>
    </section>
  )
}
