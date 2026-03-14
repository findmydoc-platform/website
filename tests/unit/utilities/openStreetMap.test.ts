import { describe, expect, it } from 'vitest'

import {
  buildOpenStreetMapDirectionsHref,
  buildOpenStreetMapEmbedHref,
  buildOpenStreetMapViewHref,
} from '@/utilities/openStreetMap'

describe('openStreetMap utilities', () => {
  it('prefers direct map coordinates for view and directions URLs', () => {
    const location = {
      coordinates: {
        lat: 52.5168332,
        lng: 13.4264519,
      },
      fullAddress: 'Lichtenberger Strasse 24, 10179 Berlin, Germany',
    }

    const viewHref = buildOpenStreetMapViewHref(location)
    const directionsHref = buildOpenStreetMapDirectionsHref(location)

    expect(viewHref).toContain('openstreetmap.org/?mlat=52.5168332')
    expect(directionsHref).toContain('openstreetmap.org/directions?to=52.5168332%2C13.4264519')
  })

  it('builds embed URL only when coordinates are available', () => {
    const embedHref = buildOpenStreetMapEmbedHref({
      coordinates: {
        lat: 52.5168332,
        lng: 13.4264519,
      },
    })

    expect(embedHref).toContain('openstreetmap.org/export/embed.html?bbox=')
    expect(embedHref).toContain('&marker=52.5168332%2C13.4264519')
    expect(buildOpenStreetMapEmbedHref({ fullAddress: 'Berlin' })).toBeUndefined()
  })

  it('falls back to search URL when only address is available', () => {
    const addressOnly = {
      fullAddress: 'Lichtenberger Strasse 24, 10179 Berlin, Germany',
    }

    expect(buildOpenStreetMapViewHref(addressOnly)).toContain('openstreetmap.org/search?query=')
    expect(buildOpenStreetMapDirectionsHref(addressOnly)).toContain('openstreetmap.org/search?query=')
  })

  it('ignores blank explicit OSM href values and uses coordinate fallback', () => {
    const location = {
      openStreetMapHref: '   ',
      coordinates: {
        lat: 52.5168332,
        lng: 13.4264519,
      },
    }

    const viewHref = buildOpenStreetMapViewHref(location)

    expect(viewHref).toContain('openstreetmap.org/?mlat=52.5168332')
  })

  it('returns undefined when neither coordinates nor address exist', () => {
    expect(buildOpenStreetMapViewHref({})).toBeUndefined()
    expect(buildOpenStreetMapDirectionsHref({})).toBeUndefined()
    expect(buildOpenStreetMapEmbedHref({})).toBeUndefined()
  })
})
