import * as React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { Card, CardContent } from '@/components/atoms/card'
import { Media } from '@/components/molecules/Media'
import { cn } from '@/utilities/ui'

import type {
  BeforeAfterCaseGalleryEntry,
  BeforeAfterCaseGalleryMetaConfig,
  BeforeAfterCaseGalleryVariant,
} from './types'

type SpotlightQueueEntry = BeforeAfterCaseGalleryEntry & {
  category: string
  durationLabel: string
}

const SPOTLIGHT_CATEGORY_PALETTE = [
  'Orthopedic',
  'Respiratory',
  'Recovery',
  'Chronic Care',
  'Nutrition',
  'Sports',
] as const

const SPOTLIGHT_DURATION_PALETTE = ['4 weeks', '8 weeks', '12 weeks', '16 weeks', '24 weeks', '32 weeks'] as const

const DEFAULT_REVEAL_SPLIT = 25

function resolveMetaPalette<T extends readonly string[]>(
  fallbackPalette: T,
  configuredPalette?: readonly string[],
): readonly string[] {
  return configuredPalette && configuredPalette.length > 0 ? configuredPalette : fallbackPalette
}

function withSpotlightMeta(
  entries: BeforeAfterCaseGalleryEntry[],
  metaConfig: BeforeAfterCaseGalleryMetaConfig | undefined,
): SpotlightQueueEntry[] {
  const categoryPalette = resolveMetaPalette(SPOTLIGHT_CATEGORY_PALETTE, metaConfig?.fallbackCategories)
  const durationPalette = resolveMetaPalette(SPOTLIGHT_DURATION_PALETTE, metaConfig?.fallbackDurations)

  return entries.map((entry, index) => ({
    ...entry,
    category: entry.category?.trim() || categoryPalette[index % categoryPalette.length] || 'General',
    durationLabel: entry.durationLabel?.trim() || durationPalette[index % durationPalette.length] || '8 weeks',
  }))
}

function clampRevealPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function BeforeAfterResultDisclaimer() {
  return (
    <p className="text-xs text-muted-foreground">
      Individual results may vary depending on baseline condition and care path.
    </p>
  )
}

function BeforeAfterPair({ entry }: { entry: BeforeAfterCaseGalleryEntry }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Before</p>
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
          <Media
            htmlElement={null}
            src={entry.before.src}
            alt={entry.before.alt}
            fill
            imgClassName="object-cover"
            size="(min-width: 1024px) 28vw, 100vw"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">After</p>
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
          <Media
            htmlElement={null}
            src={entry.after.src}
            alt={entry.after.alt}
            fill
            imgClassName="object-cover"
            size="(min-width: 1024px) 28vw, 100vw"
          />
        </div>
      </div>
    </div>
  )
}

function BeforeAfterRevealCompare({
  entry,
  split,
  onSplitChange,
}: {
  entry: BeforeAfterCaseGalleryEntry
  split: number
  onSplitChange: (next: number) => void
}) {
  const compareRef = React.useRef<HTMLDivElement | null>(null)
  const activePointerId = React.useRef<number | null>(null)

  const updateSplitFromClientX = React.useCallback(
    (clientX: number) => {
      const bounds = compareRef.current?.getBoundingClientRect()
      if (!bounds || bounds.width <= 0) return

      const ratio = ((clientX - bounds.left) / bounds.width) * 100
      onSplitChange(clampRevealPercent(100 - ratio))
    },
    [onSplitChange],
  )

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      activePointerId.current = event.pointerId
      event.currentTarget.setPointerCapture(event.pointerId)
      updateSplitFromClientX(event.clientX)
    },
    [updateSplitFromClientX],
  )

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (activePointerId.current !== event.pointerId) return
      updateSplitFromClientX(event.clientX)
    },
    [updateSplitFromClientX],
  )

  const handlePointerEnd = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== event.pointerId) return
    activePointerId.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        event.preventDefault()
        onSplitChange(clampRevealPercent(split + 5))
        return
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        event.preventDefault()
        onSplitChange(clampRevealPercent(split - 5))
        return
      }

      if (event.key === 'Home') {
        event.preventDefault()
        onSplitChange(100)
        return
      }

      if (event.key === 'End') {
        event.preventDefault()
        onSplitChange(0)
      }
    },
    [onSplitChange, split],
  )

  const revealPercent = clampRevealPercent(split)
  const revealStyle = React.useMemo(
    () =>
      ({
        '--reveal-split': `${revealPercent}%`,
        '--reveal-divider': `${100 - revealPercent}%`,
      }) as React.CSSProperties,
    [revealPercent],
  )

  return (
    <div>
      {/* Continuous drag updates rely on dynamic CSS variables to avoid quantized Tailwind step classes. */}
      <div
        ref={compareRef}
        style={revealStyle}
        className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-primary/20 bg-background select-none"
      >
        <Media
          htmlElement={null}
          src={entry.before.src}
          alt={entry.before.alt}
          fill
          imgClassName="object-cover"
          size="(min-width: 1024px) 28vw, 100vw"
        />

        <div className="absolute inset-0 overflow-hidden [clip-path:inset(0_0_0_calc(100%-var(--reveal-split)))]">
          <Media
            htmlElement={null}
            src={entry.after.src}
            alt={entry.after.alt}
            fill
            imgClassName="object-cover"
            size="(min-width: 1024px) 28vw, 100vw"
          />
        </div>

        <button
          type="button"
          onClick={() => onSplitChange(100)}
          className="absolute top-3 left-3 cursor-pointer rounded-full bg-background/92 px-3 py-1 text-[11px] font-semibold text-secondary transition-colors hover:bg-background"
        >
          Before
        </button>
        <button
          type="button"
          onClick={() => onSplitChange(0)}
          className="absolute top-3 right-3 cursor-pointer rounded-full bg-background/92 px-3 py-1 text-[11px] font-semibold text-secondary transition-colors hover:bg-background"
        >
          After
        </button>

        <div
          className="absolute inset-y-0 left-[var(--reveal-divider)] w-10 -translate-x-1/2 touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <span className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 border-l-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,0.3)]" />
          <button
            type="button"
            role="slider"
            aria-label="Before and after comparison slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(revealPercent)}
            aria-valuetext={`${Math.round(revealPercent)}% before`}
            onKeyDown={handleKeyDown}
            className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-white bg-white/95 text-[11px] font-semibold text-secondary shadow-[0_0_0_1px_rgba(15,23,42,0.3)] transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none"
          >
            ↔
          </button>
        </div>
      </div>
    </div>
  )
}

export function BeforeAfterCaseGallerySection({
  entries,
  variant = 'spotlightQueue',
  className,
  title = 'Before & After Case Gallery',
  metaConfig,
}: {
  entries: BeforeAfterCaseGalleryEntry[]
  variant?: BeforeAfterCaseGalleryVariant
  className?: string
  title?: string
  metaConfig?: BeforeAfterCaseGalleryMetaConfig
}) {
  const queueEntries = React.useMemo(() => withSpotlightMeta(entries, metaConfig), [entries, metaConfig])
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [activeSplit, setActiveSplit] = React.useState(DEFAULT_REVEAL_SPLIT)
  const activeEntry = queueEntries[activeIndex]
  const activeEntryId = activeEntry?.id

  React.useEffect(() => {
    setActiveIndex((current) => (current >= queueEntries.length ? 0 : current))
  }, [queueEntries.length])

  React.useEffect(() => {
    setActiveSplit(DEFAULT_REVEAL_SPLIT)
  }, [activeEntryId, variant])

  if (!activeEntry) {
    return (
      <section className={cn('space-y-4', className)}>
        <Heading as="h2" align="left" size="h4" className="text-secondary">
          {title}
        </Heading>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">No before and after stories published yet.</p>
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className={cn('space-y-5', className)}>
      <div className="space-y-2">
        <Heading as="h2" align="left" size="h4" className="text-secondary">
          {title}
        </Heading>
        <p className="max-w-3xl text-sm text-secondary/65">
          {variant === 'spotlightQueueReveal'
            ? 'Direct visual comparison with drag reveal and a side queue for case switching.'
            : 'Landing-like spotlight layout with side queue navigation for faster case scanning.'}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardContent className="space-y-4 p-4 md:p-6">
            <div className="space-y-1">
              <p className="text-xl font-semibold text-secondary">{activeEntry.title}</p>
              <p className="text-xs text-secondary/55">
                {activeEntry.category} • {activeEntry.durationLabel}
              </p>
              {activeEntry.description ? <p className="text-sm text-secondary/65">{activeEntry.description}</p> : null}
            </div>

            {variant === 'spotlightQueueReveal' ? (
              <BeforeAfterRevealCompare entry={activeEntry} split={activeSplit} onSplitChange={setActiveSplit} />
            ) : (
              <BeforeAfterPair entry={activeEntry} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardContent className="space-y-2 p-3">
            <p className="px-1 text-xs tracking-[0.12em] text-secondary/50 uppercase">Case Queue</p>
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {queueEntries.map((entry, index) => {
                const isActive = activeIndex === index
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      'grid w-full cursor-pointer grid-cols-[64px_1fr] gap-3 rounded-xl border p-2 text-left transition-colors',
                      isActive
                        ? 'border-primary bg-primary/10'
                        : 'border-primary/15 hover:border-primary/40 hover:bg-primary/5',
                    )}
                    aria-current={isActive ? 'true' : undefined}
                    aria-label={`Open case ${index + 1}: ${entry.title}`}
                  >
                    <div className="relative size-16 overflow-hidden rounded-lg">
                      <Media
                        htmlElement={null}
                        src={entry.after.src}
                        alt={entry.after.alt}
                        fill
                        imgClassName="object-cover"
                        size="64px"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-xs font-semibold text-secondary">{entry.title}</p>
                      <p className="mt-1 text-[11px] text-secondary/55">{entry.category}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <BeforeAfterResultDisclaimer />
    </section>
  )
}
