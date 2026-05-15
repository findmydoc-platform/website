'use client'

import * as React from 'react'
import Link from 'next/link'
import { BookmarkCheck, CircleUserRound, Heart, MapPin, Star } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { Card, CardContent } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { VerificationBadge } from '@/components/atoms/verification-badge'
import { Media } from '@/components/molecules/Media'
import { cn } from '@/utilities/ui'

import { FavoriteClinicButton } from './FavoriteClinicButton'
import type { FavoriteClinicListItem } from './server'

const BROWSE_CLINICS_HREF = '/listing-comparison'

function formatSavedClinicLabel(count: number): string {
  return count === 1 ? 'saved clinic' : 'saved clinics'
}

function SavedClinicsHeader({ count }: { count: number }) {
  const hasSavedClinics = count > 0

  return (
    <div className="flex flex-col gap-5 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-3">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground sm:text-base">
          <CircleUserRound className="hidden size-5 sm:block" aria-hidden={true} />
          Patient account
        </p>
        <Heading id="saved-clinics-title" as="h1" align="left" size="h2" className="text-secondary">
          Saved clinics
        </Heading>
        <p className="text-base leading-7 text-muted-foreground">
          {count} {formatSavedClinicLabel(count)} in your patient account.
        </p>
      </div>

      {hasSavedClinics ? (
        <Button asChild variant="secondary" className="h-11 w-full sm:w-auto">
          <Link href={BROWSE_CLINICS_HREF}>Browse clinics</Link>
        </Button>
      ) : null}
    </div>
  )
}

function SavedClinicsEmptyState({ browseRef }: { browseRef?: React.Ref<HTMLAnchorElement> }) {
  return (
    <Card>
      <CardContent className="flex min-h-[25rem] flex-col items-center justify-center px-5 py-12 text-center sm:min-h-[28rem] sm:px-8 sm:py-16">
        <span
          className="mb-6 inline-flex size-24 items-center justify-center rounded-full bg-primary/10 text-muted-foreground sm:size-28"
          aria-hidden={true}
        >
          <Heart className="size-10 sm:size-12" strokeWidth={1.8} />
        </span>
        <Heading as="h2" align="center" size="h4" className="text-secondary">
          No saved clinics yet
        </Heading>
        <p className="mt-3 max-w-md text-base leading-7 text-muted-foreground">
          Save clinics from provider pages and they will appear here.
        </p>
        <Button asChild className="mt-7 h-11 w-full max-w-xs">
          <Link ref={browseRef} href={BROWSE_CLINICS_HREF}>
            Browse clinics
          </Link>
        </Button>
        <p className="mt-5 hidden max-w-sm border-t border-border/70 pt-5 text-sm leading-6 text-muted-foreground sm:block">
          Saved clinics appear here after you use the heart on a clinic.
        </p>
      </CardContent>
    </Card>
  )
}

function SavedListSummary({ count, className }: { count: number; className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-4 p-5 xl:flex-col xl:items-center xl:px-6 xl:py-8 xl:text-center">
        <span
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary xl:size-14"
          aria-hidden={true}
        >
          <BookmarkCheck className="size-6" />
        </span>
        <div className="min-w-0 flex-1 xl:w-full xl:flex-none">
          <Heading as="h2" align="left" size="h5" className="text-secondary xl:text-center">
            Saved list
          </Heading>
          <div className="mt-2 flex items-baseline gap-2 xl:mt-5 xl:block">
            <span className="text-3xl font-bold text-secondary xl:block xl:text-5xl">{count}</span>
            <span className="text-sm font-semibold text-muted-foreground xl:mt-1 xl:block">
              {count === 1 ? 'clinic' : 'clinics'}
            </span>
          </div>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground xl:mx-auto xl:mt-5 xl:border-t xl:border-border/70 xl:pt-5">
            Clinics you saved are shown here.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function SavedClinicCard({
  item,
  mediaPriority,
  onRemove,
}: {
  item: FavoriteClinicListItem
  mediaPriority?: boolean
  onRemove: (favoriteId: number, clinicName: string) => void
}) {
  return (
    <li data-favorite-id={item.favoriteId}>
      <article
        className={cn(
          'rounded-lg border border-border bg-card p-3 shadow-xs',
          'sm:grid sm:grid-cols-[9rem_minmax(0,1fr)_10rem] sm:items-center sm:gap-5 sm:p-4',
          'lg:grid-cols-[14rem_minmax(0,1fr)_12rem]',
        )}
      >
        <div className="relative mb-4 aspect-[16/10] overflow-hidden rounded-lg bg-muted sm:mb-0 sm:aspect-square lg:aspect-[16/10]">
          <Media
            htmlElement={null}
            src={item.media.src}
            alt={item.media.alt}
            fill
            imgClassName="object-cover"
            priority={mediaPriority}
            size="(min-width: 1024px) 224px, (min-width: 640px) 144px, calc(100vw - 4rem)"
          />
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-col items-start gap-2 lg:flex-row lg:items-center">
            <Heading
              as="h2"
              align="left"
              size="h5"
              className="leading-tight font-semibold [overflow-wrap:anywhere] text-foreground"
            >
              {item.name}
            </Heading>
            <VerificationBadge variant={item.verification.variant} className="shrink-0" />
          </div>

          <div className="space-y-2 text-sm leading-6 text-muted-foreground">
            <p className="flex min-w-0 items-center gap-2">
              <MapPin className="size-4 shrink-0" aria-hidden={true} />
              <span className="min-w-0 [overflow-wrap:anywhere]">{item.location}</span>
            </p>
            {typeof item.ratingValue === 'number' ? (
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Star className="size-4 shrink-0 fill-primary text-primary" aria-hidden={true} />
                <span>{item.ratingValue.toFixed(1)} average rating</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:mt-0 sm:min-w-0">
          <Button asChild className="h-11 w-full text-sm font-semibold">
            <Link href={item.href} aria-label={`View details for ${item.name}`}>
              Details
            </Link>
          </Button>
          <FavoriteClinicButton
            clinicId={item.clinicId}
            initialFavoriteId={item.favoriteId}
            isPatient={true}
            loginHref="/login/patient?next=%2Fpatient%2Ffavorites"
            variant="list"
            savedLabel="Remove"
            unsavedLabel="Save"
            pendingLabel="Removing..."
            buttonAriaLabel={`Remove ${item.name} from saved clinics`}
            pendingAriaLabel={`Removing ${item.name} from saved clinics`}
            showIcon={false}
            onFavoriteChange={(change) => {
              if (!change.isFavorite) {
                onRemove(item.favoriteId, item.name)
              }
            }}
          />
        </div>
      </article>
    </li>
  )
}

export function FavoriteClinicsList({ initialItems }: { initialItems: FavoriteClinicListItem[] }) {
  const [items, setItems] = React.useState(initialItems)
  const [statusMessage, setStatusMessage] = React.useState('')
  const emptyBrowseRef = React.useRef<HTMLAnchorElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const nextFocusFavoriteIdRef = React.useRef<number | null>(null)
  const shouldFocusEmptyBrowseRef = React.useRef(false)
  const count = items.length

  React.useEffect(() => {
    const nextFocusFavoriteId = nextFocusFavoriteIdRef.current
    const shouldFocusEmptyBrowse = shouldFocusEmptyBrowseRef.current
    nextFocusFavoriteIdRef.current = null
    shouldFocusEmptyBrowseRef.current = false

    if (nextFocusFavoriteId) {
      const nextItem = listRef.current?.querySelector<HTMLElement>(
        `[data-favorite-id="${nextFocusFavoriteId}"] a, [data-favorite-id="${nextFocusFavoriteId}"] button`,
      )
      nextItem?.focus()
      return
    }

    if (shouldFocusEmptyBrowse) {
      emptyBrowseRef.current?.focus()
    }
  }, [items])

  const handleRemove = React.useCallback((favoriteId: number, clinicName: string) => {
    setStatusMessage(`Removed ${clinicName} from saved clinics.`)
    setItems((current) => {
      const removedIndex = current.findIndex((entry) => entry.favoriteId === favoriteId)
      const nextFocusItem = removedIndex >= 0 ? (current[removedIndex + 1] ?? current[removedIndex - 1] ?? null) : null
      nextFocusFavoriteIdRef.current = nextFocusItem?.favoriteId ?? null
      shouldFocusEmptyBrowseRef.current = current.length === 1

      return current.filter((entry) => entry.favoriteId !== favoriteId)
    })
  }, [])

  return (
    <section className="space-y-6" aria-labelledby="saved-clinics-title">
      <SavedClinicsHeader count={count} />
      <p role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </p>

      {count === 0 ? (
        <SavedClinicsEmptyState browseRef={emptyBrowseRef} />
      ) : (
        <div className="space-y-5">
          <SavedListSummary count={count} className="hidden md:block xl:hidden" />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
            <ul ref={listRef} className="space-y-3" aria-label="Saved clinics list">
              {items.map((item, index) => (
                <SavedClinicCard
                  key={item.favoriteId}
                  item={item}
                  onRemove={handleRemove}
                  mediaPriority={index === 0}
                />
              ))}
            </ul>

            <SavedListSummary count={count} className="hidden xl:sticky xl:top-24 xl:block" />
          </div>
        </div>
      )}
    </section>
  )
}
