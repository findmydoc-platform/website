'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { Card, CardContent } from '@/components/atoms/card'
import { Container } from '@/components/molecules/Container'
import { cn } from '@/utilities/ui'

export type TreatmentsStripItem = {
  title: string
  description: string
  icon?: React.ReactNode
}

const tileVariants = cva(
  [
    'group relative flex h-full w-full flex-col items-center justify-center text-center',
    'px-6 py-10 md:px-8 md:py-12',
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
  onActiveIndexChange?: (nextIndex: number) => void
  className?: string
}

export const TreatmentsStrip: React.FC<TreatmentsStripProps> = ({
  eyebrow = 'MORE TYPE OF',
  heading,
  items,
  activeIndex,
  onActiveIndexChange,
  className,
}) => {
  const titleId = React.useId()
  const isInteractive = Boolean(onActiveIndexChange)

  return (
    <section className={cn('w-full', className)} aria-labelledby={titleId}>
      <Container className="py-16">
        <header className="max-w-3xl">
          <h5 className="text-primary text-left">{eyebrow}</h5>
          <h2 id={titleId} className="text-secondary text-size-72 text-left font-bold">
            {heading}
          </h2>
        </header>

        <div className="mt-10">
          <div className={cn('bg-primary relative overflow-visible', 'rounded-3xl px-2 py-2 md:px-4 md:py-4')}>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4 md:gap-0">
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
                          'md:-translate-y-10',
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
          <h3 className="text-primary-foreground text-size-32 mt-6 line-clamp-2 font-semibold">{title}</h3>
          <p className="text-primary-foreground/85 text-normal mt-4 line-clamp-4">{description}</p>
        </div>
      ) : (
        <>
          <IconCircle state="inactive">{icon}</IconCircle>
          <h3 className="text-primary-foreground text-size-32 mt-6 line-clamp-2 font-semibold">{title}</h3>
          <p className="text-primary-foreground/85 text-normal mt-4 line-clamp-4" title={description}>
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
        'bg-card text-card-foreground h-full w-full rounded-2xl border border-black/5',
        lifted
          ? // Figma shadow: 6px 4px 70px 8px rgba(48,123,196,0.09)
            // Using an arbitrary shadow here is intentional for pixel-match.
            'shadow-[6px_4px_70px_8px_rgb(48_123_196_/0.09)]'
          : 'shadow-brand-soft',
      )}
    >
      <CardContent className="flex h-full flex-col items-center justify-center px-8 py-10 text-center">
        <IconCircle state="active">{item.icon}</IconCircle>
        <h3 className="text-secondary text-size-32 mt-6 line-clamp-2 font-semibold">{item.title}</h3>
        <p className="text-secondary/90 text-normal mt-4 line-clamp-4" title={item.description}>
          {item.description}
        </p>
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
