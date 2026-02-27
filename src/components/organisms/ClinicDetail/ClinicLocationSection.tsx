import * as React from 'react'
import { Expand, MapPin, X } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import { Button } from '@/components/atoms/button'
import { Card, CardContent } from '@/components/atoms/card'
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
  onContactClick?: () => void
}

export function ClinicLocationSection({ clinicName, location, mapHref, onContactClick }: ClinicLocationSectionProps) {
  const [isMapOverlayOpen, setIsMapOverlayOpen] = React.useState(false)
  const openStreetMapViewHref = React.useMemo(
    () => mapHref ?? buildOpenStreetMapViewHref(location),
    [location, mapHref],
  )
  const openStreetMapEmbedHref = React.useMemo(() => buildOpenStreetMapEmbedHref(location), [location])
  const openStreetMapDirectionsHref = React.useMemo(() => buildOpenStreetMapDirectionsHref(location), [location])

  React.useEffect(() => {
    if (!isMapOverlayOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMapOverlayOpen])

  React.useEffect(() => {
    if (!isMapOverlayOpen) return undefined

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMapOverlayOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isMapOverlayOpen])

  if (!openStreetMapViewHref && !location.fullAddress) return null

  const mapFrame = openStreetMapEmbedHref ? (
    <>
      <iframe
        title={`Map of ${clinicName}`}
        src={openStreetMapEmbedHref}
        className="h-full w-full border-0 contrast-90 saturate-75"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-primary/7 via-transparent to-primary/10 mix-blend-multiply"
        aria-hidden="true"
      />
    </>
  ) : (
    <div className="flex h-full items-center justify-center bg-linear-to-br from-primary/12 via-background to-primary/20">
      <div className="inline-flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-sm font-medium text-secondary">
        <MapPin className="size-4 text-primary" aria-hidden="true" />
        Map preview unavailable
      </div>
    </div>
  )

  return (
    <section className="space-y-4" aria-label="Clinic Location">
      <div className="space-y-1">
        <Heading as="h2" align="left" size="h4" className="text-secondary">
          Clinic Location
        </Heading>
      </div>

      <div className="relative">
        <Card className="overflow-hidden">
          <CardContent className={cn('relative h-72 p-0 lg:h-80')}>{mapFrame}</CardContent>
        </Card>

        <Card className="absolute right-6 bottom-6 left-6 border-primary/25 bg-background/94 backdrop-blur-sm lg:left-auto lg:w-96">
          <CardContent className="space-y-3 p-4">
            <p className="text-xs tracking-[0.12em] text-secondary/55 uppercase">Address</p>
            <p className="text-sm font-medium text-secondary">
              {location.fullAddress ?? 'Address available on request'}
            </p>

            <div className="flex flex-wrap gap-2">
              {openStreetMapDirectionsHref || openStreetMapViewHref ? (
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
              <Button type="button" size="sm" variant="secondary" onClick={() => setIsMapOverlayOpen(true)}>
                <Expand className="size-3.5" aria-hidden="true" />
                Expand map
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {isMapOverlayOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary/35 p-4 backdrop-blur-sm sm:p-8">
          <Card className="flex h-[88vh] w-full max-w-[1400px] flex-col overflow-hidden border-primary/25 bg-background/96 shadow-brand-soft">
            <CardContent className="flex items-center justify-between gap-4 border-b border-primary/15 p-4 sm:p-6">
              <div className="space-y-1">
                <Heading as="h3" align="left" size="h5" className="text-secondary">
                  Expanded Map View
                </Heading>
                <p className="text-sm text-secondary/70">{location.fullAddress ?? 'Address available on request'}</p>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                {openStreetMapDirectionsHref || openStreetMapViewHref ? (
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
                <Button type="button" size="sm" variant="secondary" onClick={() => setIsMapOverlayOpen(false)}>
                  <X className="size-3.5" aria-hidden="true" />
                  Close map
                </Button>
              </div>
            </CardContent>

            <div className="relative min-h-0 flex-1 p-4 sm:p-6">
              <div className="relative h-full overflow-hidden rounded-2xl border border-primary/20">{mapFrame}</div>
            </div>

            <div className="px-4 pb-4 sm:px-6 sm:pb-6">
              <p className="text-xs text-secondary/55">Map data © OpenStreetMap contributors</p>
            </div>
          </Card>
        </div>
      ) : null}

      <p className="text-xs text-secondary/55">Map data © OpenStreetMap contributors</p>
    </section>
  )
}
