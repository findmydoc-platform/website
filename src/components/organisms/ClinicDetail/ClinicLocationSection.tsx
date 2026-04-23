import * as React from 'react'
import { Expand, MapPin, X } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import { Button } from '@/components/atoms/button'
import { Card, CardContent } from '@/components/atoms/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/atoms/dialog'
import {
  buildOpenStreetMapDirectionsHref,
  buildOpenStreetMapEmbedHref,
  buildOpenStreetMapViewHref,
} from '@/utilities/openStreetMap'
import { cn } from '@/utilities/ui'

type ClinicLocation = {
  fullAddress?: string
  coordinates?: { lat: number; lng: number }
}

type ClinicLocationSectionProps = {
  clinicName: string
  location: ClinicLocation
  mapHref?: string
  isOpenStreetMapAllowed?: boolean
  onContactClick?: () => void
}

export function ClinicLocationSection({
  clinicName,
  location,
  mapHref,
  isOpenStreetMapAllowed = true,
  onContactClick,
}: ClinicLocationSectionProps) {
  const [isMapOverlayOpen, setIsMapOverlayOpen] = React.useState(false)
  const expandMapButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const wasMapOverlayOpen = React.useRef(false)
  const overlayAddressText = location.fullAddress ?? 'Address available on request'
  const openStreetMapViewHref = React.useMemo(
    () => (isOpenStreetMapAllowed ? (mapHref ?? buildOpenStreetMapViewHref(location)) : undefined),
    [isOpenStreetMapAllowed, location, mapHref],
  )
  const openStreetMapEmbedHref = React.useMemo(
    () => (isOpenStreetMapAllowed ? buildOpenStreetMapEmbedHref(location) : undefined),
    [isOpenStreetMapAllowed, location],
  )
  const openStreetMapDirectionsHref = React.useMemo(
    () => (isOpenStreetMapAllowed ? buildOpenStreetMapDirectionsHref(location) : undefined),
    [isOpenStreetMapAllowed, location],
  )

  const renderMapFrame = React.useCallback(
    (interactive: boolean) => {
      if (!isOpenStreetMapAllowed) {
        return (
          <div className="flex h-full items-center justify-center bg-linear-to-br from-primary/12 via-background to-primary/20">
            <div className="mx-auto max-w-md rounded-2xl border border-primary/15 bg-background/90 px-4 py-3 text-center text-sm text-secondary">
              OpenStreetMap is hidden until optional cookies are accepted.
            </div>
          </div>
        )
      }

      if (openStreetMapEmbedHref) {
        return (
          <>
            <iframe
              title={`Map of ${clinicName}`}
              src={openStreetMapEmbedHref}
              className={cn('h-full w-full border-0 contrast-90 saturate-75', !interactive && 'pointer-events-none')}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-linear-to-b from-primary/7 via-transparent to-primary/10 mix-blend-multiply"
              aria-hidden="true"
            />
          </>
        )
      }

      return (
        <div className="flex h-full items-center justify-center bg-linear-to-br from-primary/12 via-background to-primary/20">
          <div className="inline-flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-sm font-medium text-secondary">
            <MapPin className="size-4 text-primary" aria-hidden="true" />
            Map preview unavailable
          </div>
        </div>
      )
    },
    [clinicName, isOpenStreetMapAllowed, openStreetMapEmbedHref],
  )

  React.useEffect(() => {
    if (!isOpenStreetMapAllowed) {
      setIsMapOverlayOpen(false)
    }
  }, [isOpenStreetMapAllowed])

  React.useEffect(() => {
    if (wasMapOverlayOpen.current && !isMapOverlayOpen && isOpenStreetMapAllowed) {
      expandMapButtonRef.current?.focus()
    }

    wasMapOverlayOpen.current = isMapOverlayOpen
  }, [isMapOverlayOpen, isOpenStreetMapAllowed])

  if (!openStreetMapViewHref && !location.fullAddress) return null

  const previewMapFrame = renderMapFrame(false)
  const expandedMapFrame = renderMapFrame(true)

  return (
    <Dialog open={isMapOverlayOpen} onOpenChange={setIsMapOverlayOpen}>
      <section className="space-y-4" aria-label="Clinic Location">
        <div className="space-y-1">
          <Heading as="h2" align="left" size="h4" className="text-secondary">
            Clinic Location
          </Heading>
        </div>

        <div className="relative">
          <Card className="overflow-hidden">
            <CardContent className={cn('relative h-[27rem] p-0 lg:h-[30rem]')}>{previewMapFrame}</CardContent>
          </Card>

          <Card className="absolute right-6 bottom-6 left-6 z-10 border-primary/25 bg-background/94 backdrop-blur-sm lg:left-auto lg:w-96">
            <CardContent className="space-y-3 p-4">
              <p className="text-xs tracking-[0.12em] text-secondary/55 uppercase">Address</p>
              <p className="text-sm font-medium text-secondary">{overlayAddressText}</p>

              <div className="flex flex-wrap gap-2">
                {isOpenStreetMapAllowed && (openStreetMapDirectionsHref || openStreetMapViewHref) ? (
                  <Button asChild size="sm">
                    <a
                      href={openStreetMapDirectionsHref ?? openStreetMapViewHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Directions
                    </a>
                  </Button>
                ) : null}
                {onContactClick ? (
                  <Button type="button" size="sm" variant="secondary" onClick={onContactClick}>
                    Contact
                  </Button>
                ) : null}
                {isOpenStreetMapAllowed ? (
                  <Button
                    ref={expandMapButtonRef}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsMapOverlayOpen(true)}
                  >
                    <Expand className="size-3.5" aria-hidden="true" />
                    Expand map
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogContent
          className="flex h-[88vh] w-[min(calc(100vw-2rem),1400px)] max-w-[1400px] flex-col overflow-hidden border-primary/25 bg-background/96 p-0 shadow-brand-soft sm:w-[min(calc(100vw-4rem),1400px)]"
          overlayClassName="bg-secondary/35 backdrop-blur-sm"
        >
          <DialogHeader className="gap-4 border-b border-primary/15 p-4 text-left sm:p-6">
            <div className="space-y-1">
              <DialogTitle asChild>
                <Heading as="h3" align="left" size="h5" className="text-secondary">
                  Expanded Map View
                </Heading>
              </DialogTitle>
              <DialogDescription asChild>
                <p className="text-sm text-secondary/70">{overlayAddressText}</p>
              </DialogDescription>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pr-10">
              {isOpenStreetMapAllowed && (openStreetMapDirectionsHref || openStreetMapViewHref) ? (
                <Button asChild size="sm">
                  <a
                    href={openStreetMapDirectionsHref ?? openStreetMapViewHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Directions
                  </a>
                </Button>
              ) : null}
              {onContactClick ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setIsMapOverlayOpen(false)
                    onContactClick()
                  }}
                >
                  Contact
                </Button>
              ) : null}
              {isOpenStreetMapAllowed ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => setIsMapOverlayOpen(false)}>
                  <X className="size-3.5" aria-hidden="true" />
                  Close map
                </Button>
              ) : null}
            </div>
          </DialogHeader>

          <div className="relative min-h-0 flex-1 p-4 sm:p-6">
            <div className="relative h-full overflow-hidden rounded-2xl border border-primary/20">
              {expandedMapFrame}
            </div>
          </div>

          <div className="px-4 pb-4 sm:px-6 sm:pb-6">
            <p className="text-xs text-secondary/55">Map data © OpenStreetMap contributors</p>
          </div>
        </DialogContent>

        <p className="text-xs text-secondary/55">Map data © OpenStreetMap contributors</p>
      </section>
    </Dialog>
  )
}
