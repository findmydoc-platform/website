'use client'

import * as React from 'react'
import { Globe2, Heart, MapPin, Share2, ShieldCheck, Star } from 'lucide-react'
import { Heading } from '@/components/atoms/Heading'
import { Button } from '@/components/atoms/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/atoms/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover'
import { Breadcrumb } from '@/components/molecules/Breadcrumb'
import type { ClinicDetailData } from '@/features/clinicDetail/contracts'
import { ClinicProfileGallery } from './ClinicProfileGallery'

export type ClinicProfileProps = {
  data: ClinicDetailData
  favorite: {
    isPatient: boolean
    saved: boolean
    pending?: boolean
    error?: string
    onToggle: () => void
    onSignIn: () => void
  }
  share: { url: string; onCopy: () => Promise<void> }
  map: { allowed: boolean; embedHref?: string }
  navigation?: React.ReactNode
  children?: React.ReactNode
  inquiryAside?: React.ReactNode
  afterLocation?: React.ReactNode
}

export function ClinicProfile({
  data,
  favorite,
  share,
  map,
  navigation,
  children,
  inquiryAside,
  afterLocation,
}: ClinicProfileProps) {
  const [shareStatus, setShareStatus] = React.useState<'idle' | 'copied' | 'failed'>('idle')
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [mapOpen, setMapOpen] = React.useState(false)
  const locationRef = React.useRef<HTMLElement>(null)
  const detailsTrigger = React.useRef<HTMLButtonElement | null>(null)
  const mapTrigger = React.useRef<HTMLButtonElement | null>(null)
  const openDetails = (event: React.MouseEvent<HTMLButtonElement>) => {
    detailsTrigger.current = event.currentTarget
    setDetailsOpen(true)
  }
  React.useEffect(() => {
    if (!map.allowed) setMapOpen(false)
  }, [map.allowed])
  const hasEvidence =
    data.trust.reviewCount > 0 || data.trust.verification !== 'unverified' || data.trust.languages.length > 0
  const evidence = hasEvidence ? (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-secondary/85 px-2 py-2 text-xs text-white sm:gap-x-6 sm:px-6 sm:py-3 sm:text-sm">
      {data.trust.ratingValue !== null && data.trust.reviewCount > 0 ? (
        <span className="flex items-center gap-1 sm:gap-2">
          <Star aria-hidden="true" className="size-4 shrink-0 fill-current text-yellow-400 sm:size-5" />
          <span>
            <strong>{data.trust.ratingValue.toFixed(1)} / 5</strong>
            <small className="block">{data.trust.reviewCount} reviews</small>
          </span>
        </span>
      ) : null}
      {data.trust.verification !== 'unverified' ? (
        <button
          type="button"
          className="flex min-h-11 min-w-0 items-center gap-1 text-left focus-visible:ring-2 focus-visible:ring-white sm:gap-2"
          onClick={openDetails}
        >
          <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-yellow-400 sm:size-5" />
          <span>
            <strong className="capitalize">{data.trust.verification}</strong>
            <small className="block">Verification</small>
          </span>
        </button>
      ) : null}
      {data.trust.languages.length ? (
        <button
          type="button"
          className="flex min-h-11 min-w-0 items-center gap-1 text-left focus-visible:ring-2 focus-visible:ring-white sm:gap-2"
          onClick={openDetails}
        >
          <Globe2 aria-hidden="true" className="size-4 shrink-0 text-yellow-400 sm:size-5" />
          <span>
            <strong>
              {data.trust.languages.slice(0, 2).join(', ')}
              {data.trust.languages.length > 2 ? ` +${data.trust.languages.length - 2}` : ''}
            </strong>
            <small className="block">Clinic languages</small>
          </span>
        </button>
      ) : null}
    </div>
  ) : null
  const hasLocation = Boolean(data.location.fullAddress || data.location.coordinates)
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-8 text-secondary sm:px-8 lg:px-12">
      <Breadcrumb items={data.breadcrumbs} className="mb-6 text-xs" />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Heading as="h1" size="h2" align="left" className="break-words text-secondary">
            {data.clinicName}
          </Heading>
          {data.location.fullAddress ? (
            <Button
              type="button"
              variant="link"
              className="mt-2 h-auto max-w-full justify-start p-0 text-left whitespace-normal text-muted-foreground"
              onClick={() => {
                locationRef.current?.scrollIntoView()
                locationRef.current?.focus()
              }}
            >
              <MapPin aria-hidden="true" className="size-4 shrink-0" />
              {data.location.fullAddress}
              <span className="underline">View location</span>
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" className="min-h-11">
                <Share2 aria-hidden="true" className="size-4" />
                Share
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 w-full"
                onClick={() => {
                  void share.onCopy().then(
                    () => setShareStatus('copied'),
                    () => setShareStatus('failed'),
                  )
                }}
              >
                Copy link
              </Button>
              {shareStatus === 'failed' ? (
                <label className="mt-3 block text-sm">
                  Copy the clinic link manually
                  <input
                    className="mt-2 w-full rounded border p-2"
                    readOnly
                    value={share.url}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </label>
              ) : null}
              <p role="status" className="mt-2 text-sm">
                {shareStatus === 'copied'
                  ? 'Clinic link copied.'
                  : shareStatus === 'failed'
                    ? 'Automatic copying failed.'
                    : ''}
              </p>
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            aria-pressed={favorite.isPatient ? favorite.saved : undefined}
            disabled={favorite.pending}
            onClick={favorite.isPatient ? favorite.onToggle : favorite.onSignIn}
          >
            <Heart aria-hidden="true" className={favorite.saved ? 'size-4 fill-current' : 'size-4'} />
            {favorite.pending ? 'Saving…' : favorite.saved ? 'Saved' : 'Save'}
          </Button>
        </div>
      </div>
      <p role="status" className="text-sm text-destructive">
        {favorite.error}
      </p>
      <ClinicProfileGallery clinicName={data.clinicName} images={data.galleryImages} evidence={evidence} />
      {navigation}
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
        <div className="min-w-0 space-y-10">
          {data.description ? (
            <section>
              <Heading as="h2" size="h4" align="left" className="text-secondary">
                About {data.clinicName}
              </Heading>
              <p className="mt-4 leading-7 text-muted-foreground">{data.description}</p>
              <Button type="button" variant="link" className="mt-4 min-h-11 p-0" onClick={openDetails}>
                Get to know the clinic →
              </Button>
            </section>
          ) : null}
          {children}
        </div>
        {inquiryAside ? (
          <aside aria-label="Plan your inquiry" className="hidden lg:block">
            <div className="sticky top-6">{inquiryAside}</div>
          </aside>
        ) : null}
      </div>
      <section
        ref={locationRef}
        tabIndex={-1}
        className="mt-16 border-t pt-12 outline-none"
        aria-label="Clinic location"
      >
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Plan your visit</p>
        <Heading as="h2" size="h4" align="left" className="mt-3">
          Location
        </Heading>
        {data.location.fullAddress ? (
          <p className="mt-4 text-muted-foreground">{data.location.fullAddress}</p>
        ) : (
          <p className="mt-4 text-muted-foreground">
            {data.location.coordinates
              ? 'Address information has not been added to this profile.'
              : 'Location information has not been added to this profile.'}
          </p>
        )}
        {hasLocation && data.location.coordinates ? (
          <div className="relative mt-6 h-72 overflow-hidden rounded-3xl bg-muted sm:h-96">
            {map.allowed && map.embedHref ? (
              <iframe
                title={`Map of ${data.clinicName}`}
                src={map.embedHref}
                loading="lazy"
                className="h-full w-full border-0"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground">
                {map.allowed ? 'Map preview unavailable.' : 'Map is hidden until optional cookies are accepted.'}
              </div>
            )}
            {map.allowed && map.embedHref ? (
              <Button
                type="button"
                variant="secondary"
                className="absolute right-4 bottom-4 min-h-11 rounded-full"
                ref={mapTrigger}
                onClick={() => setMapOpen(true)}
              >
                View location
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>
      {afterLocation}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            detailsTrigger.current?.focus()
          }}
        >
          <DialogTitle>About {data.clinicName}</DialogTitle>
          <DialogDescription>Information supplied on this clinic profile.</DialogDescription>
          {data.description ? <p>{data.description}</p> : null}
          <div className="space-y-3 text-sm">
            <p>Verification is a findmydoc profile status. Accreditations are listed separately.</p>
            <p>
              Verification:{' '}
              <span className="capitalize">
                {data.trust.verification === 'unverified' ? 'Not verified' : data.trust.verification}
              </span>
            </p>
            {data.trust.accreditations.length ? <p>Accreditations: {data.trust.accreditations.join(', ')}</p> : null}
            {data.trust.languages.length ? <p>Languages: {data.trust.languages.join(', ')}</p> : null}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent
          className="flex h-[min(85dvh,800px)] max-w-5xl flex-col"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            mapTrigger.current?.focus()
          }}
        >
          <DialogTitle>Location of {data.clinicName}</DialogTitle>
          <DialogDescription>{data.location.fullAddress || 'Clinic location'}</DialogDescription>
          {map.allowed && map.embedHref ? (
            <iframe
              title={`Interactive map of ${data.clinicName}`}
              src={map.embedHref}
              className="min-h-0 w-full flex-1 border-0"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  )
}
