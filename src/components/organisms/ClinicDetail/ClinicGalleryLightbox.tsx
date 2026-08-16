'use client'

import * as React from 'react'

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/atoms/carousel'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/atoms/dialog'
import { Media } from '@/components/molecules/Media'

import type { ClinicDetailGalleryImage } from '@/components/templates/ClinicDetailConcepts/types'

type ClinicGalleryLightboxProps = {
  clinicName: string
  galleryImages: ClinicDetailGalleryImage[]
  onOpenChange: (open: boolean) => void
  open: boolean
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

export function ClinicGalleryLightbox({
  clinicName,
  galleryImages,
  onOpenChange,
  open,
  triggerRef,
}: ClinicGalleryLightboxProps) {
  const descriptionId = React.useId()
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi>()
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const carouselRef = React.useRef<HTMLDivElement>(null)
  const imageCount = galleryImages.length

  React.useEffect(() => {
    if (!carouselApi) return

    const updateCurrentIndex = () => setCurrentIndex(carouselApi.selectedScrollSnap())
    updateCurrentIndex()
    carouselApi.on('select', updateCurrentIndex)
    carouselApi.on('reInit', updateCurrentIndex)

    return () => {
      carouselApi.off('select', updateCurrentIndex)
      carouselApi.off('reInit', updateCurrentIndex)
    }
  }, [carouselApi])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={descriptionId}
        className="h-dvh max-h-none min-h-svh w-screen max-w-none min-w-0 gap-0 overflow-hidden border-0 bg-[rgba(11,13,16,0.91)] p-0 text-white shadow-none backdrop-blur-sm sm:rounded-none [&>button]:top-[calc(1rem+env(safe-area-inset-top))] [&>button]:right-[calc(1rem+env(safe-area-inset-right))] [&>button]:z-20 [&>button]:size-11 [&>button]:rounded-full [&>button]:bg-transparent [&>button]:text-white/85 [&>button]:opacity-100 [&>button]:shadow-none [&>button]:hover:bg-white/10 [&>button]:hover:text-white [&>button]:focus-visible:bg-white/10 [&>button]:focus-visible:ring-1 [&>button]:focus-visible:ring-white/60 [&>button]:focus-visible:ring-offset-0 sm:[&>button]:top-[calc(1.5rem+env(safe-area-inset-top))] sm:[&>button]:right-[calc(1.5rem+env(safe-area-inset-right))] [&>button>svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]"
        overlayClassName="bg-black/10"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          window.requestAnimationFrame(() => triggerRef.current?.focus())
        }}
        onOpenAutoFocus={(event) => {
          if (!triggerRef.current?.matches(':focus-visible')) return

          event.preventDefault()
          window.requestAnimationFrame(() => carouselRef.current?.focus())
        }}
      >
        <DialogTitle className="sr-only">{clinicName} photo gallery</DialogTitle>
        <DialogDescription id={descriptionId} className="sr-only">
          Browse {imageCount} clinic {imageCount === 1 ? 'photo' : 'photos'}. Use the arrow keys or swipe to move
          between photos.
        </DialogDescription>

        <div className="flex h-full min-h-0 w-full min-w-0 flex-col px-[max(0.5rem,env(safe-area-inset-left))] pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-[max(2rem,env(safe-area-inset-left))] sm:pt-[calc(5rem+env(safe-area-inset-top))] sm:pb-[calc(2rem+env(safe-area-inset-bottom))]">
          <p className="mb-2 shrink-0 text-center text-sm font-medium text-white/80" aria-live="polite">
            Photo {currentIndex + 1} of {imageCount}
          </p>

          <Carousel
            ref={carouselRef}
            opts={{ align: 'center', loop: imageCount > 1 }}
            setApi={setCarouselApi}
            className="mx-auto min-h-0 w-full max-w-7xl min-w-0 flex-1 focus-visible:ring-1 focus-visible:ring-white/50 focus-visible:outline-hidden focus-visible:ring-inset"
            aria-label={`${clinicName} photos`}
          >
            <CarouselContent className="ml-0 w-full">
              {galleryImages.map((image, index) => {
                const isActive = index === currentIndex

                return (
                  <CarouselItem
                    key={image.id}
                    className="pl-0"
                    aria-hidden={!isActive}
                    aria-label={`Photo ${index + 1} of ${imageCount}`}
                  >
                    <figure className="flex h-[calc(100dvh-7.75rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-0 flex-col items-center justify-center gap-3 sm:h-[calc(100dvh-9.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] sm:gap-4">
                      <div className="relative aspect-[4/3] min-h-0 w-full shrink sm:aspect-auto sm:flex-1">
                        <Media
                          htmlElement={null}
                          src={image.src}
                          alt={image.alt}
                          fill
                          imgClassName="object-contain"
                          size="(min-width: 1280px) 1280px, 100vw"
                        />
                      </div>
                      {image.caption ? (
                        <figcaption
                          className="max-h-[min(32dvh,12rem)] w-full max-w-3xl shrink-0 overflow-y-auto overscroll-contain px-4 text-center text-sm leading-6 text-white/85 focus-visible:ring-1 focus-visible:ring-white/60 focus-visible:outline-hidden sm:text-base"
                          tabIndex={0}
                        >
                          {image.caption}
                        </figcaption>
                      ) : null}
                    </figure>
                  </CarouselItem>
                )
              })}
            </CarouselContent>

            {imageCount > 1 ? (
              <>
                <CarouselPrevious className="left-1 size-11 border-white/30 bg-black/45 text-white hover:bg-black/65 hover:text-white sm:left-3" />
                <CarouselNext className="right-1 size-11 border-white/30 bg-black/45 text-white hover:bg-black/65 hover:text-white sm:right-3" />
              </>
            ) : null}
          </Carousel>
        </div>
      </DialogContent>
    </Dialog>
  )
}
