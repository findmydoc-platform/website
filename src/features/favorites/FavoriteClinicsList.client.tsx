'use client'

import * as React from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { Card, CardContent } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { VerificationBadge } from '@/components/atoms/verification-badge'
import { Media } from '@/components/molecules/Media'
import { cn } from '@/utilities/ui'

import { FavoriteClinicButton } from './FavoriteClinicButton'
import type { FavoriteClinicListItem } from './server'

export function FavoriteClinicsList({ initialItems }: { initialItems: FavoriteClinicListItem[] }) {
  const [items, setItems] = React.useState(initialItems)

  if (items.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center px-5 py-12 text-center sm:px-8">
          <span className="mb-5 inline-flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Heart className="size-5" aria-hidden={true} />
          </span>
          <Heading as="h2" align="center" size="h4" className="text-secondary">
            No saved clinics yet
          </Heading>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Save clinics while comparing options and they will appear here for quick access.
          </p>
          <Button asChild className="mt-6">
            <Link href="/listing-comparison">Browse clinics</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3" aria-label="Saved clinics list">
      {items.map((item) => (
        <article
          key={item.favoriteId}
          className={cn(
            'rounded-2xl border border-border bg-card p-4 shadow-xs',
            'sm:grid sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-center sm:gap-5',
          )}
        >
          <div className="relative mb-4 aspect-[16/10] overflow-hidden rounded-xl sm:mb-0 sm:aspect-square">
            <Media
              htmlElement={null}
              src={item.media.src}
              alt={item.media.alt}
              fill
              imgClassName="object-cover"
              size="(min-width: 640px) 96px, 100vw"
            />
          </div>

          <div className="min-w-0 space-y-2">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <Heading
                as="h2"
                align="left"
                size="h5"
                className="text-xl leading-tight font-semibold [overflow-wrap:anywhere] text-foreground"
              >
                {item.name}
              </Heading>
              <VerificationBadge variant={item.verification.variant} className="shrink-0" />
            </div>
            <p className="text-sm text-muted-foreground">{item.location}</p>
            {typeof item.ratingValue === 'number' ? (
              <p className="text-sm font-medium text-foreground">{item.ratingValue.toFixed(1)} average rating</p>
            ) : null}
          </div>

          <div className="mt-4 grid gap-2 sm:mt-0 sm:min-w-36">
            <Button asChild className="h-10 w-full text-sm font-semibold">
              <Link href={item.href}>Details</Link>
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
              onFavoriteChange={(change) => {
                if (!change.isFavorite) {
                  setItems((current) => current.filter((entry) => entry.favoriteId !== item.favoriteId))
                }
              }}
            />
          </div>
        </article>
      ))}
    </div>
  )
}
