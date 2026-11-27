'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, Grid2X2, ImageOff } from 'lucide-react'
import { Button } from '@/components/atoms/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/atoms/dialog'
import { Media } from '@/components/molecules/Media'
import type { ClinicDetailGalleryImage } from '@/features/clinicDetail/contracts'

function Photo({ image, contain = false }: { image: ClinicDetailGalleryImage; contain?: boolean }) {
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => setFailed(false), [image.src])
  if (failed)
    return (
      <span
        role="img"
        aria-label="Photo unavailable"
        className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted p-4 text-center text-sm text-muted-foreground"
      >
        <ImageOff aria-hidden="true" />
        Photo unavailable
      </span>
    )
  return (
    <Media
      htmlElement={null}
      src={image.src}
      alt={image.alt}
      fill
      onError={() => setFailed(true)}
      imgClassName={contain ? 'object-contain' : 'object-cover'}
      size="(min-width: 1280px) 800px, 100vw"
    />
  )
}

export function ClinicProfileGallery({
  clinicName,
  images,
  evidence,
}: {
  clinicName: string
  images: ClinicDetailGalleryImage[]
  evidence: React.ReactNode
}) {
  const [index, setIndex] = React.useState<number | null>(null)
  const trigger = React.useRef<HTMLButtonElement | null>(null)
  const visible = images.slice(0, 5)
  const open = (event: React.MouseEvent<HTMLButtonElement>, next: number) => {
    trigger.current = event.currentTarget
    setIndex(next)
  }
  if (!images.length) return <section aria-label="Clinic information">{evidence}</section>
  return (
    <>
      <section aria-label="Clinic photo gallery" className="relative overflow-hidden rounded-3xl">
        <div
          className={
            visible.length > 1
              ? 'grid h-72 grid-cols-1 gap-2 sm:h-96 lg:h-[410px] lg:grid-cols-[3fr_2fr]'
              : 'grid h-72 grid-cols-1 sm:h-96 lg:h-[410px]'
          }
        >
          <div className="relative min-w-0 overflow-hidden">
            <button
              type="button"
              className="absolute inset-0 w-full focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
              aria-label="Open clinic photo gallery"
              onClick={(event) => open(event, 0)}
            >
              <Photo image={visible[0]!} />
            </button>
            <div className="absolute inset-x-0 bottom-0 z-10">{evidence}</div>
          </div>
          {visible.length > 1 ? (
            <div
              className={
                visible.length === 2
                  ? 'hidden grid-cols-1 grid-rows-1 gap-2 lg:grid'
                  : visible.length === 3
                    ? 'hidden grid-cols-1 grid-rows-2 gap-2 lg:grid'
                    : 'hidden grid-cols-2 grid-rows-2 gap-2 lg:grid'
              }
            >
              {visible.slice(1).map((image, i) => (
                <button
                  key={image.id}
                  type="button"
                  className="relative min-h-0 overflow-hidden focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  aria-label={`View ${image.alt}`}
                  onClick={(event) => open(event, i + 1)}
                >
                  <Photo image={image} />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="absolute top-4 right-4 z-20 min-h-11 rounded-full lg:top-auto lg:bottom-4"
          onClick={(event) => open(event, 0)}
        >
          <Grid2X2 aria-hidden="true" className="size-4" />
          {images.length === 1 ? 'View photo' : 'View all photos'}
        </Button>
      </section>
      <Dialog
        open={index !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setIndex(null)
        }}
      >
        <DialogContent
          className="h-dvh max-h-none w-screen max-w-none gap-0 border-0 bg-secondary p-4 text-white sm:rounded-none"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            trigger.current?.focus()
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight')
              setIndex((current) => (current === null ? null : (current + 1) % images.length))
            if (event.key === 'ArrowLeft')
              setIndex((current) => (current === null ? null : (current + images.length - 1) % images.length))
          }}
        >
          <DialogTitle className="sr-only">{clinicName} photo gallery</DialogTitle>
          <DialogDescription className="sr-only">
            Browse the clinic photos using the arrow buttons or arrow keys.
          </DialogDescription>
          {index !== null ? (
            <div className="flex min-h-0 flex-col items-center gap-3 pt-12 pb-4">
              <p aria-live="polite" className="text-sm">
                Photo {index + 1} of {images.length}
              </p>
              <div className="relative min-h-0 w-full flex-1">
                <Photo image={images[index]!} contain />
              </div>
              {images[index]?.caption ? <p className="text-center text-sm">{images[index].caption}</p> : null}
              {images.length > 1 ? (
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIndex((index + images.length - 1) % images.length)}
                    aria-label="Previous photo"
                  >
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIndex((index + 1) % images.length)}
                    aria-label="Next photo"
                  >
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
