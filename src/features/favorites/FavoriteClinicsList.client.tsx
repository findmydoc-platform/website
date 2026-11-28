'use client'

import * as React from 'react'
import Link from 'next/link'
import { BookmarkCheck, CircleUserRound, Heart, MapPin, Star } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { Card, CardContent } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { VerificationBadge } from '@/components/atoms/verification-badge'
import { Media } from '@/components/molecules/Media'
import { LISTING_COMPARISON_PATHS } from '@/i18n/listingComparisonPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { SAVED_CLINICS_PATHS } from '@/i18n/savedClinicsPath'
import { cn } from '@/utilities/ui'

import { getSavedClinicsTranslator } from './copy'
import { FavoriteClinicAction } from './FavoriteClinicAction.client'
import type { FavoriteClinicButtonApi } from './FavoriteClinicButton'
import { buildPatientLoginHref } from './redirects'
import type { FavoriteClinicListItem } from './server'

type SavedClinicsTranslator = ReturnType<typeof getSavedClinicsTranslator>

function SavedClinicsHeader({
  count,
  browseHref,
  translate,
}: {
  count: number
  browseHref: string
  translate: SavedClinicsTranslator
}) {
  const hasSavedClinics = count > 0

  return (
    <div className="flex flex-col gap-5 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-3">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground sm:text-base">
          <CircleUserRound className="hidden size-5 sm:block" aria-hidden={true} />
          {translate('account')}
        </p>
        <Heading id="saved-clinics-title" as="h1" align="left" size="h2" className="text-secondary">
          {translate('title')}
        </Heading>
        <p className="text-base leading-7 text-muted-foreground">{translate('accountCount', { count })}</p>
      </div>

      {hasSavedClinics ? (
        <Button asChild variant="secondary" className="h-11 w-full sm:w-auto">
          <Link href={browseHref}>{translate('browse')}</Link>
        </Button>
      ) : null}
    </div>
  )
}

function SavedClinicsEmptyState({
  browseHref,
  browseRef,
  translate,
}: {
  browseHref: string
  browseRef: React.Ref<HTMLAnchorElement>
  translate: SavedClinicsTranslator
}) {
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
          {translate('emptyTitle')}
        </Heading>
        <p className="mt-3 max-w-md text-base leading-7 text-muted-foreground">{translate('emptyDescription')}</p>
        <Button asChild className="mt-7 h-11 w-full max-w-xs">
          <Link ref={browseRef} href={browseHref}>
            {translate('browse')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function SavedListSummary({
  count,
  formattedCount,
  translate,
  className,
}: {
  count: number
  formattedCount: string
  translate: SavedClinicsTranslator
  className?: string
}) {
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
            {translate('summaryTitle')}
          </Heading>
          <div className="mt-2 flex items-baseline gap-2 xl:mt-5 xl:block">
            <span className="text-3xl font-bold text-secondary xl:block xl:text-5xl">{formattedCount}</span>
            <span className="text-sm font-semibold text-muted-foreground xl:mt-1 xl:block">
              {translate('clinicCount', { count })}
            </span>
          </div>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground xl:mx-auto xl:mt-5 xl:border-t xl:border-border/70 xl:pt-5">
            {translate('summaryDescription')}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function SavedClinicCard({
  item,
  locale,
  translate,
  loginHref,
  mediaPriority,
  favoriteApi,
  onRemove,
}: {
  favoriteApi?: FavoriteClinicButtonApi
  item: FavoriteClinicListItem
  locale: UiCopyLocale
  translate: SavedClinicsTranslator
  loginHref: string
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
            <VerificationBadge
              variant={item.verification.variant}
              label={translate(item.verification.variant)}
              className="w-auto max-w-full shrink-0 whitespace-normal"
            />
          </div>

          <div className="space-y-2 text-sm leading-6 text-muted-foreground">
            <p className="flex min-w-0 items-center gap-2">
              <MapPin className="size-4 shrink-0" aria-hidden={true} />
              <span className="min-w-0 [overflow-wrap:anywhere]">{item.location ?? translate('unknownLocation')}</span>
            </p>
            {typeof item.ratingValue === 'number' ? (
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Star className="size-4 shrink-0 fill-primary text-primary" aria-hidden={true} />
                <span>
                  {translate('rating', {
                    rating: new Intl.NumberFormat(locale, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }).format(item.ratingValue),
                  })}
                </span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:mt-0 sm:min-w-0">
          <Button asChild className="h-11 w-full text-sm font-semibold">
            <Link href={item.href} aria-label={translate('detailsFor', { clinic: item.name })}>
              {translate('details')}
            </Link>
          </Button>
          <FavoriteClinicAction
            clinicId={item.clinicId}
            clinicName={item.name}
            locale={locale}
            initialFavoriteId={item.favoriteId}
            isPatient={true}
            loginHref={loginHref}
            variant="list"
            favoriteApi={favoriteApi}
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

export function FavoriteClinicsList({
  favoriteApi,
  initialItems,
  locale = 'en',
}: {
  favoriteApi?: FavoriteClinicButtonApi
  initialItems: FavoriteClinicListItem[]
  locale?: UiCopyLocale
}) {
  const [items, setItems] = React.useState(initialItems)
  const [removedClinicName, setRemovedClinicName] = React.useState<string | null>(null)
  const translate = getSavedClinicsTranslator(locale)
  const browseHref = LISTING_COMPARISON_PATHS[locale]
  const loginHref = buildPatientLoginHref(SAVED_CLINICS_PATHS[locale], locale)
  const emptyBrowseRef = React.useRef<HTMLAnchorElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const nextFocusFavoriteIdRef = React.useRef<number | null>(null)
  const shouldFocusEmptyBrowseRef = React.useRef(false)
  const count = items.length
  const formattedCount = new Intl.NumberFormat(locale).format(count)

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
    setRemovedClinicName(clinicName)
    setItems((current) => {
      const removedIndex = current.findIndex((entry) => entry.favoriteId === favoriteId)
      const nextFocusItem = removedIndex >= 0 ? (current[removedIndex + 1] ?? current[removedIndex - 1] ?? null) : null
      nextFocusFavoriteIdRef.current = nextFocusItem?.favoriteId ?? null
      shouldFocusEmptyBrowseRef.current = current.length === 1

      return current.filter((entry) => entry.favoriteId !== favoriteId)
    })
  }, [])

  return (
    <section className="space-y-6 [--muted-foreground:#666666]" aria-labelledby="saved-clinics-title">
      <SavedClinicsHeader count={count} browseHref={browseHref} translate={translate} />
      <p role="status" aria-live="polite" className="sr-only">
        {removedClinicName ? translate('clinicRemoved', { clinic: removedClinicName }) : null}
      </p>

      {count === 0 ? (
        <SavedClinicsEmptyState browseHref={browseHref} browseRef={emptyBrowseRef} translate={translate} />
      ) : (
        <div className="space-y-5">
          <SavedListSummary
            count={count}
            formattedCount={formattedCount}
            translate={translate}
            className="hidden md:block xl:hidden"
          />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
            <ul ref={listRef} className="space-y-3" aria-label={translate('listLabel')}>
              {items.map((item, index) => (
                <SavedClinicCard
                  key={item.favoriteId}
                  favoriteApi={favoriteApi}
                  item={item}
                  locale={locale}
                  translate={translate}
                  loginHref={loginHref}
                  onRemove={handleRemove}
                  mediaPriority={index === 0}
                />
              ))}
            </ul>

            <SavedListSummary
              count={count}
              formattedCount={formattedCount}
              translate={translate}
              className="hidden xl:sticky xl:top-24 xl:block"
            />
          </div>
        </div>
      )}
    </section>
  )
}
