'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { Button } from '@/components/atoms/button'
import { Card, CardContent } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'
import { cn } from '@/utilities/ui'

export type TreatmentsStripItem = {
  title: string
  description: string
  icon?: React.ReactNode
  cta?: {
    label: string
    onClick: () => void
  }
}

const tileVariants = cva(
  [
    'group relative flex h-full w-full flex-col items-center justify-center text-center',
    'min-h-[260px] px-6 py-8 md:min-h-[320px] md:px-8 md:py-10',
    'transition-transform',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-primary',
  ],
  {
    variants: {
      state: {
        inactive: 'text-primary-foreground/95 hover:-translate-y-0.5',
        activeSlot: 'text-primary-foreground/95',
      },
      isInteractive: {
        true: 'cursor-pointer',
        false: 'cursor-default',
      },
    },
    defaultVariants: {
      state: 'inactive',
      isInteractive: false,
    },
  },
)

type TileVariantProps = VariantProps<typeof tileVariants>

type TreatmentsStripProps = {
  eyebrow?: string
  heading: string
  items: TreatmentsStripItem[]
  activeIndex: number
  layoutMode?: 'auto' | 'fixed' | 'adaptive'
  onActiveIndexChange?: (nextIndex: number) => void
  className?: string
}

export const TreatmentsStrip: React.FC<TreatmentsStripProps> = ({
  eyebrow = 'MORE TYPE OF',
  heading,
  items,
  activeIndex,
  layoutMode = 'auto',
  onActiveIndexChange,
  className,
}) => {
  const titleId = React.useId()
  const isInteractive = Boolean(onActiveIndexChange)
  const isAdaptiveLayout = layoutMode === 'adaptive' || (layoutMode === 'auto' && items.length < 4)
  const adaptiveColumnCount = Math.min(Math.max(items.length, 1), 4)
  const mdGridColumnsClass = isAdaptiveLayout
    ? ({
        1: 'md:grid-cols-1',
        2: 'md:grid-cols-2',
        3: 'md:grid-cols-3',
        4: 'md:grid-cols-4',
      }[adaptiveColumnCount] ?? 'md:grid-cols-4')
    : 'md:grid-cols-4'
  const mdGapClass = isAdaptiveLayout ? 'md:gap-2' : 'md:gap-0'

  return (
    <section className={cn('w-full', className)} aria-labelledby={titleId}>
      <Container className="py-16">
        <header className="max-w-3xl">
          <p className="text-left text-base font-normal tracking-[5px] text-primary uppercase">{eyebrow}</p>
          <Heading id={titleId} as="h2" align="left" className="text-size-72 text-secondary">
            {heading}
          </Heading>
        </header>

        <div className="mt-10">
          <div className={cn('relative overflow-visible bg-primary', 'rounded-3xl px-2 py-3 md:px-4 md:py-6')}>
            <div
              className={cn('grid grid-cols-1 gap-2', mdGridColumnsClass, mdGapClass)}
              data-layout-mode={isAdaptiveLayout ? 'adaptive' : 'fixed'}
              data-column-count={isAdaptiveLayout ? adaptiveColumnCount : 4}
            >
              {items.map((item, index) => {
                const isActive = index === activeIndex

                if (isActive) {
                  return (
                    <div key={`${item.title}-${index}`} className="relative">
                      {/* Mobile: render the active card inline (no lift). */}
                      <div className="md:hidden">
                        <ActiveCard item={item} />
                      </div>

                      {/* Desktop: reserve space for the lifted overlay card. */}
                      <Tile
                        className="hidden md:flex"
                        title={item.title}
                        description={item.description}
                        icon={item.icon}
                        hasCta={Boolean(item.cta)}
                        isInteractive={isInteractive}
                        onSelect={onActiveIndexChange}
                        index={index}
                        isActive={true}
                        state="activeSlot"
                      />

                      {/* Desktop: lifted overlay card. */}
                      <div
                        className={cn(
                          'pointer-events-none absolute inset-2 hidden md:flex',
                          'items-stretch justify-center',
                          'md:-translate-y-6',
                        )}
                      >
                        <div className="pointer-events-auto h-full w-full">
                          <ActiveCard item={item} lifted={true} />
                        </div>
                      </div>
                    </div>
                  )
                }

                return (
                  <Tile
                    key={`${item.title}-${index}`}
                    title={item.title}
                    description={item.description}
                    icon={item.icon}
                    hasCta={Boolean(item.cta)}
                    isInteractive={isInteractive}
                    onSelect={onActiveIndexChange}
                    index={index}
                    isActive={false}
                    state="inactive"
                  />
                )
              })}
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}

function Tile({
  className,
  title,
  description,
  icon,
  hasCta = false,
  isInteractive,
  onSelect,
  index,
  isActive,
  state,
}: {
  className?: string
  title: string
  description: string
  icon?: React.ReactNode
  hasCta?: boolean
  isInteractive: boolean
  onSelect?: (idx: number) => void
  index: number
  isActive: boolean
  state: NonNullable<TileVariantProps['state']>
}) {
  const Comp: React.ElementType = isInteractive ? 'button' : 'div'

  return (
    <Comp
      type={isInteractive ? 'button' : undefined}
      className={cn(tileVariants({ state, isInteractive }), className)}
      onClick={isInteractive ? () => onSelect?.(index) : undefined}
      aria-pressed={isInteractive ? isActive : undefined}
      aria-label={isInteractive ? title : undefined}
    >
      {/*
        Active slot: reserve identical layout space so the overlay card lift
        does not change the grid row height.
      */}
      {state === 'activeSlot' ? (
        <div className="opacity-0" aria-hidden={true}>
          <IconCircle state="inactive">{icon}</IconCircle>
          <Heading
            as="h3"
            align="center"
            className="text-size-32 mt-5 line-clamp-3 leading-[1.2] font-semibold text-primary-foreground"
          >
            {title}
          </Heading>
          <p className="text-normal mt-3 line-clamp-3 text-primary-foreground/85">{description}</p>
          {hasCta ? (
            <div className="mt-5 inline-flex h-10 w-[172px] rounded-full border border-primary-foreground/20" />
          ) : null}
        </div>
      ) : (
        <>
          <IconCircle state="inactive">{icon}</IconCircle>
          <Heading
            as="h3"
            align="center"
            className="text-size-32 mt-5 line-clamp-3 leading-[1.2] font-semibold text-primary-foreground"
          >
            {title}
          </Heading>
          <p className="text-normal mt-3 line-clamp-3 text-primary-foreground/85" title={description}>
            {description}
          </p>
        </>
      )}
    </Comp>
  )
}

function ActiveCard({ item, lifted = false }: { item: TreatmentsStripItem; lifted?: boolean }) {
  return (
    <Card
      className={cn(
        'h-full w-full overflow-hidden rounded-2xl border border-black/5 bg-card text-card-foreground',
        lifted
          ? // Figma shadow: 6px 4px 70px 8px rgba(48,123,196,0.09)
            // Using an arbitrary shadow here is intentional for pixel-match.
            'shadow-[6px_4px_70px_8px_rgb(48_123_196_/0.09)]'
          : 'shadow-brand-soft',
      )}
    >
      <CardContent className="grid h-full min-h-[260px] grid-rows-[auto_auto_1fr_auto] place-items-center px-6 py-6 text-center md:min-h-[320px] md:px-8 md:py-8">
        <div className="shrink-0">
          <IconCircle state="active">{item.icon}</IconCircle>
        </div>
        <Heading
          as="h3"
          align="center"
          className="text-size-32 mt-5 line-clamp-3 leading-[1.2] font-semibold text-secondary"
        >
          {item.title}
        </Heading>
        <p className="text-normal mt-3 line-clamp-3 self-start text-secondary/90" title={item.description}>
          {item.description}
        </p>
        {item.cta ? (
          <Button type="button" className="mt-5 rounded-full px-6" onClick={item.cta.onClick}>
            {item.cta.label}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

function IconCircle({ children, state }: { children?: React.ReactNode; state: 'inactive' | 'active' }) {
  return (
    <div
      className={cn(
        // Figma icon container is a fixed 72px circle.
        'flex size-18 items-center justify-center rounded-full border',
        state === 'inactive'
          ? 'border-primary-foreground/35 text-primary-foreground'
          : 'border-primary/30 text-primary',
      )}
      aria-hidden={true}
    >
      {children ? <span className="flex items-center justify-center">{children}</span> : null}
    </div>
  )
}
