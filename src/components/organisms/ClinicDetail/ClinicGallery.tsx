'use client'

import * as React from 'react'
import { Images } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { Media } from '@/components/molecules/Media'

import type { ClinicDetailGalleryImage } from '@/components/templates/ClinicDetailConcepts/types'

const ClinicGalleryLightbox = React.lazy(() =>
  import('./ClinicGalleryLightbox').then((module) => ({ default: module.ClinicGalleryLightbox })),
)

type ClinicGalleryProps = {
  clinicName: string
  galleryImages: ClinicDetailGalleryImage[]
  heroImage: { src: string; alt: string }
}

export function ClinicGallery({ clinicName, galleryImages, heroImage }: ClinicGalleryProps) {
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const [hasRequestedLightbox, setHasRequestedLightbox] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const displayImage = galleryImages[0] ?? heroImage
  const imageCount = galleryImages.length
  const galleryAction = imageCount === 1 ? 'View photo' : `View all ${imageCount} photos`

  const preloadLightbox = () => {
    void import('./ClinicGalleryLightbox')
  }

  const openLightbox = () => {
    setHasRequestedLightbox(true)
    setOpen(true)
  }

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[24px] sm:aspect-[16/9] lg:aspect-[12/5] lg:rounded-[30px]">
        <Media
          htmlElement={null}
          src={displayImage.src}
          alt={displayImage.alt}
          fill
          priority
          imgClassName="object-cover"
          size="(min-width: 1280px) 1080px, (min-width: 1024px) calc(100vw - 12rem), (min-width: 640px) calc(100vw - 4rem), calc(100vw - 3rem)"
        />
      </div>

      {imageCount > 0 ? (
        <div className="mt-3 flex justify-end sm:mt-4">
          <Button
            ref={triggerRef}
            type="button"
            variant="secondary"
            className="min-h-11 rounded-full border-primary/20 bg-background px-5 text-primary shadow-brand-soft"
            aria-haspopup="dialog"
            aria-label={`${galleryAction} for ${clinicName}`}
            onClick={openLightbox}
            onFocus={preloadLightbox}
            onPointerEnter={preloadLightbox}
          >
            <Images className="size-5" aria-hidden={true} />
            {galleryAction}
          </Button>
        </div>
      ) : null}

      {hasRequestedLightbox ? (
        <React.Suspense fallback={null}>
          <ClinicGalleryLightbox
            clinicName={clinicName}
            galleryImages={galleryImages}
            open={open}
            onOpenChange={setOpen}
            triggerRef={triggerRef}
          />
        </React.Suspense>
      ) : null}
    </div>
  )
}
