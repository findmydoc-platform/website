type OpenStreetMapCoordinates = {
  lat: number
  lng: number
}

type OpenStreetMapLocation = {
  fullAddress?: string
  coordinates?: OpenStreetMapCoordinates
  openStreetMapHref?: string
}

function normalizeExplicitHref(href: string | undefined): string | undefined {
  const trimmed = href?.trim()
  return trimmed ? trimmed : undefined
}

function hasValidCoordinates(location: OpenStreetMapLocation): location is OpenStreetMapLocation & {
  coordinates: OpenStreetMapCoordinates
} {
  return Boolean(
    location.coordinates && Number.isFinite(location.coordinates.lat) && Number.isFinite(location.coordinates.lng),
  )
}

function buildSearchHref(address: string): string {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`
}

export function buildOpenStreetMapViewHref(location: OpenStreetMapLocation, zoom = 14): string | undefined {
  const explicitHref = normalizeExplicitHref(location.openStreetMapHref)
  if (explicitHref) return explicitHref

  if (hasValidCoordinates(location)) {
    const { lat, lng } = location.coordinates
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`
  }

  const address = location.fullAddress?.trim()
  if (address) return buildSearchHref(address)

  return undefined
}

export function buildOpenStreetMapDirectionsHref(location: OpenStreetMapLocation): string | undefined {
  if (hasValidCoordinates(location)) {
    const { lat, lng } = location.coordinates
    return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}`
  }

  const address = location.fullAddress?.trim()
  if (address) return buildSearchHref(address)

  return undefined
}

export function buildOpenStreetMapEmbedHref(location: OpenStreetMapLocation, delta = 0.015): string | undefined {
  if (!hasValidCoordinates(location)) return undefined

  const { lat, lng } = location.coordinates
  const left = lng - delta
  const right = lng + delta
  const top = lat + delta
  const bottom = lat - delta

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`
}
