import type { PayloadRequest, Where } from 'payload'

export const TURKIYE_ISO_CODE = 'TR'

export const CLINIC_ADDRESS_RELATIONSHIP_MESSAGES = {
  cityCountryMismatch: 'Selected clinic city must belong to Türkiye.',
  cityUnavailable: 'Selected clinic city is unavailable.',
  countryRequiredForCity: 'Clinic country is required when a city is selected.',
  countryUnavailable: 'Clinic country must reference Türkiye (ISO TR).',
} as const

type RelationId = string | number

type ClinicAddressRelationshipIssue = {
  message: string
  path: 'address.city' | 'address.country'
}

const getRelationshipId = (value: unknown): RelationId | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()

  if (value && typeof value === 'object' && 'id' in value) {
    return getRelationshipId((value as { id?: unknown }).id)
  }

  return null
}

export const buildTurkiyeCountryFilter = (): Where => ({
  isoCode: {
    equals: TURKIYE_ISO_CODE,
  },
})

export const buildTurkiyeCityFilter = async (req: PayloadRequest): Promise<Where | false> => {
  const countries = await req.payload.find({
    collection: 'countries',
    depth: 0,
    limit: 100,
    pagination: false,
    overrideAccess: true,
    req,
    where: buildTurkiyeCountryFilter(),
  })

  const countryIds = countries.docs.map((country) => country.id)
  if (countryIds.length === 0) return false

  return {
    country: {
      in: countryIds,
    },
  }
}

export const validateTurkiyeClinicAddressRelationships = async ({
  address,
  req,
}: {
  address: unknown
  req: PayloadRequest
}): Promise<ClinicAddressRelationshipIssue[]> => {
  const addressRecord =
    address && typeof address === 'object' && !Array.isArray(address) ? (address as Record<string, unknown>) : {}
  const countryId = getRelationshipId(addressRecord.country)
  const cityId = getRelationshipId(addressRecord.city)

  if (countryId === null && cityId === null) return []

  if (countryId === null) {
    return [
      {
        message: CLINIC_ADDRESS_RELATIONSHIP_MESSAGES.countryRequiredForCity,
        path: 'address.country',
      },
    ]
  }

  const [countries, cities] = await Promise.all([
    req.payload.find({
      collection: 'countries',
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      req,
      select: {
        isoCode: true,
      },
      where: {
        id: {
          equals: countryId,
        },
      },
    }),
    cityId === null
      ? Promise.resolve(null)
      : req.payload.find({
          collection: 'cities',
          depth: 0,
          limit: 1,
          pagination: false,
          overrideAccess: true,
          req,
          select: {
            country: true,
          },
          where: {
            id: {
              equals: cityId,
            },
          },
        }),
  ])

  const issues: ClinicAddressRelationshipIssue[] = []
  const country = countries.docs[0]

  if (!country || country.isoCode.trim().toUpperCase() !== TURKIYE_ISO_CODE) {
    issues.push({
      message: CLINIC_ADDRESS_RELATIONSHIP_MESSAGES.countryUnavailable,
      path: 'address.country',
    })
  }

  if (cityId !== null) {
    const city = cities?.docs[0]

    if (!city) {
      issues.push({
        message: CLINIC_ADDRESS_RELATIONSHIP_MESSAGES.cityUnavailable,
        path: 'address.city',
      })
    } else if (String(getRelationshipId(city.country)) !== String(countryId)) {
      issues.push({
        message: CLINIC_ADDRESS_RELATIONSHIP_MESSAGES.cityCountryMismatch,
        path: 'address.city',
      })
    }
  }

  return issues
}
