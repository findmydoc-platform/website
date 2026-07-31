import {
  commitTransaction,
  initTransaction,
  killTransaction,
  type PayloadRequest,
  type RequiredDataFromCollectionSlug,
} from 'payload'

import type { City, Clinic, ClinicProfileDraft, Country } from '@/payload-types'
import { validateOpeningHours } from '@/collections/clinics/openingHours'
import { dispatchClinicChangeRevalidation } from '@/hooks/revalidateClinicSurfaces'
import {
  clinicProfileCountry,
  clinicProfileSourceFieldLimits,
  clinicProfileSupportedLanguageValues,
  clinicProfileWeekdayValues,
  type ClinicProfileCityDTO,
  type ClinicProfileDraftCreateInput,
  type ClinicProfileDraftDiscardInput,
  type ClinicProfileDraftSaveInput,
  type ClinicProfileOpeningHours,
  type ClinicProfilePublishInput,
  type ClinicProfileSnapshotDTO,
  type ClinicProfileSourceFieldsDTO,
  type ClinicProfileSupportedLanguage,
} from './contracts'
import { preserveOrCanonicalizeDescription, richTextToPlainText } from './richText'

export type ClinicProfileServiceErrorKind = 'conflict' | 'invalid-input' | 'not-found' | 'unavailable'

export class ClinicProfileServiceError extends Error {
  constructor(
    readonly kind: ClinicProfileServiceErrorKind,
    message: string,
  ) {
    super(message)
    this.name = 'ClinicProfileServiceError'
  }
}

type RelationId = number | string

type ProfileReadContext = {
  availableCities: ClinicProfileCityDTO[]
  citiesById: Map<string, City>
  clinic: Clinic
  country: Country
  draft?: ClinicProfileDraft
}

const relationId = (value: unknown): RelationId | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object' && 'id' in value) return relationId((value as { id?: unknown }).id)
  return null
}

const stringValue = (value: unknown): string => (typeof value === 'string' ? value : '')

const supportedLanguages = (value: unknown): ClinicProfileSupportedLanguage[] => {
  if (!Array.isArray(value)) return []

  const known = new Set<string>(clinicProfileSupportedLanguageValues)
  return value.filter(
    (language): language is ClinicProfileSupportedLanguage => typeof language === 'string' && known.has(language),
  )
}

const openingHoursDTO = (value: Clinic['openingHours'] | ClinicProfileDraft['openingHours']) => {
  if (!value) return undefined

  const hasConfiguredDay = clinicProfileWeekdayValues.some((weekday) => {
    const day = value[weekday]
    return Boolean(day?.isClosed || day?.opensAt || day?.closesAt)
  })
  if (!hasConfiguredDay) return undefined

  return Object.fromEntries(
    clinicProfileWeekdayValues.map((weekday) => {
      const day = value[weekday]
      return [
        weekday,
        {
          closesAt: day?.isClosed ? '' : stringValue(day?.closesAt),
          isClosed: day?.isClosed === true,
          opensAt: day?.isClosed ? '' : stringValue(day?.opensAt),
        },
      ]
    }),
  ) as ClinicProfileOpeningHours
}

const addressDTO = (
  value: Clinic['address'] | ClinicProfileDraft['address'],
  citiesById: Map<string, City>,
): ClinicProfileSourceFieldsDTO['address'] => {
  const cityId = relationId(value?.city)
  const city = cityId === null ? undefined : citiesById.get(String(cityId))

  return {
    ...(city
      ? {
          city: {
            id: String(city.id),
            name: city.name.trim(),
          },
        }
      : {}),
    country: clinicProfileCountry,
    houseNumber: stringValue(value?.houseNumber),
    street: stringValue(value?.street),
    zipCode: stringValue(value?.zipCode),
  }
}

const sourceFieldsDTO = (
  profile: Clinic | ClinicProfileDraft,
  citiesById: Map<string, City>,
): ClinicProfileSourceFieldsDTO => ({
  address: addressDTO(profile.address, citiesById),
  descriptionText: richTextToPlainText(profile.description),
  name: stringValue(profile.name),
  ...(openingHoursDTO(profile.openingHours) ? { openingHours: openingHoursDTO(profile.openingHours) } : {}),
  supportedLanguages: supportedLanguages(profile.supportedLanguages),
})

const readProfileContext = async (req: PayloadRequest, clinicId: RelationId): Promise<ProfileReadContext> => {
  const clinic = await req.payload.findByID({
    collection: 'clinics',
    id: clinicId,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const countries = await req.payload.find({
    collection: 'countries',
    depth: 0,
    limit: 2,
    pagination: false,
    overrideAccess: true,
    req,
    where: {
      isoCode: {
        equals: clinicProfileCountry.code,
      },
    },
  })
  const drafts = await req.payload.find({
    collection: 'clinicProfileDrafts',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    req,
    where: {
      clinic: {
        equals: clinicId,
      },
    },
  })

  const country = countries.docs[0]
  if (!country) {
    throw new ClinicProfileServiceError('unavailable', 'Türkiye country data is unavailable.')
  }

  const cities = await req.payload.find({
    collection: 'cities',
    depth: 0,
    limit: 5_000,
    pagination: false,
    overrideAccess: true,
    req,
    sort: 'name',
    where: {
      country: {
        equals: country.id,
      },
    },
  })

  const safeCities = cities.docs.filter(
    (city) => city.name.trim().length > 0 && city.name.trim().length <= clinicProfileSourceFieldLimits.cityNameLength,
  )

  return {
    availableCities: safeCities.map((city) => ({ id: String(city.id), name: city.name.trim() })),
    citiesById: new Map(safeCities.map((city) => [String(city.id), city])),
    clinic,
    country,
    ...(drafts.docs[0] ? { draft: drafts.docs[0] } : {}),
  }
}

const snapshotFromContext = (context: ProfileReadContext): ClinicProfileSnapshotDTO => ({
  availableCities: context.availableCities,
  ...(context.draft
    ? {
        draft: {
          ...sourceFieldsDTO(context.draft, context.citiesById),
          basePublishedRevision: context.draft.basePublishedRevision,
          revision: context.draft.revision,
        },
      }
    : {}),
  published: {
    ...sourceFieldsDTO(context.clinic, context.citiesById),
    revision: context.clinic.profileRevision ?? 0,
  },
})

export const readClinicProfileSnapshot = async (
  req: PayloadRequest,
  clinicId: RelationId,
): Promise<ClinicProfileSnapshotDTO> => snapshotFromContext(await readProfileContext(req, clinicId))

const beginOwnedTransaction = async (req: PayloadRequest): Promise<void> => {
  const started = await initTransaction(req)
  if (!started) {
    throw new ClinicProfileServiceError('unavailable', 'A database transaction could not be started.')
  }
}

const rollback = async (req: PayloadRequest): Promise<void> => {
  await killTransaction(req)
}

const duplicateConstraint = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const record = error as { code?: unknown; cause?: { code?: unknown }; message?: unknown }
  return (
    record.code === '23505' ||
    record.cause?.code === '23505' ||
    (typeof record.message === 'string' && /duplicate|unique/iu.test(record.message))
  )
}

const requireCurrentPublishedRevision = (clinic: Clinic, expected: number): void => {
  if ((clinic.profileRevision ?? 0) !== expected) {
    throw new ClinicProfileServiceError('conflict', 'The published clinic profile changed.')
  }
}

const requireCity = (context: ProfileReadContext, cityId: string | undefined): City | undefined => {
  if (!cityId) return undefined
  const city = context.citiesById.get(cityId)
  if (!city) {
    throw new ClinicProfileServiceError('invalid-input', 'The selected city is not an available Türkiye city.')
  }
  return city
}

const draftData = ({
  context,
  input,
  revision,
}: {
  context: ProfileReadContext
  input: ClinicProfileDraftSaveInput
  revision: number
}): RequiredDataFromCollectionSlug<'clinicProfileDrafts'> => {
  const city = requireCity(context, input.draft.address.cityId)
  const previousDescription = context.draft?.description ?? context.clinic.description

  return {
    clinic: context.clinic.id,
    basePublishedRevision: context.draft?.basePublishedRevision ?? context.clinic.profileRevision ?? 0,
    revision,
    name: input.draft.name,
    description: preserveOrCanonicalizeDescription({
      existing: previousDescription,
      nextText: input.draft.descriptionText,
    }) as ClinicProfileDraft['description'],
    supportedLanguages: input.draft.supportedLanguages,
    address: {
      country: context.country.id,
      street: input.draft.address.street,
      houseNumber: input.draft.address.houseNumber,
      zipCode: input.draft.address.zipCode,
      ...(city ? { city: city.id } : {}),
    },
    openingHours: input.draft.openingHours,
  }
}

const draftDataFromPublished = (context: ProfileReadContext): RequiredDataFromCollectionSlug<'clinicProfileDrafts'> => {
  const cityId = relationId(context.clinic.address?.city)
  const city = cityId === null ? undefined : context.citiesById.get(String(cityId))

  if (cityId !== null && !city) {
    throw new ClinicProfileServiceError('unavailable', 'The published clinic city is unavailable.')
  }

  return {
    clinic: context.clinic.id,
    basePublishedRevision: context.clinic.profileRevision ?? 0,
    revision: 1,
    name: context.clinic.name,
    description: structuredClone(context.clinic.description) as ClinicProfileDraft['description'],
    supportedLanguages: context.clinic.supportedLanguages ?? [],
    address: {
      country: context.country.id,
      street: stringValue(context.clinic.address?.street),
      houseNumber: stringValue(context.clinic.address?.houseNumber),
      zipCode: stringValue(context.clinic.address?.zipCode),
      ...(city ? { city: city.id } : {}),
    },
    openingHours: context.clinic.openingHours
      ? (structuredClone(context.clinic.openingHours) as ClinicProfileDraft['openingHours'])
      : undefined,
  }
}

export const createClinicProfileDraft = async (
  req: PayloadRequest,
  clinicId: RelationId,
  input: ClinicProfileDraftCreateInput,
): Promise<ClinicProfileSnapshotDTO> => {
  await beginOwnedTransaction(req)

  try {
    const context = await readProfileContext(req, clinicId)
    requireCurrentPublishedRevision(context.clinic, input.expectedPublishedRevision)

    if (context.draft) {
      throw new ClinicProfileServiceError('conflict', 'A clinic profile draft already exists.')
    }

    await req.payload.create({
      collection: 'clinicProfileDrafts',
      data: draftDataFromPublished(context),
      depth: 0,
      overrideAccess: true,
      req,
    })

    await commitTransaction(req)
  } catch (error: unknown) {
    await rollback(req)
    if (duplicateConstraint(error)) {
      throw new ClinicProfileServiceError('conflict', 'A clinic profile draft already exists.')
    }
    throw error
  }

  return readClinicProfileSnapshot(req, clinicId)
}

export const saveClinicProfileDraft = async (
  req: PayloadRequest,
  clinicId: RelationId,
  input: ClinicProfileDraftSaveInput,
): Promise<ClinicProfileSnapshotDTO> => {
  await beginOwnedTransaction(req)

  try {
    const context = await readProfileContext(req, clinicId)
    requireCurrentPublishedRevision(context.clinic, input.expectedPublishedRevision)

    if (!context.draft) {
      throw new ClinicProfileServiceError('not-found', 'The clinic profile draft does not exist.')
    }
    if (
      context.draft.revision !== input.expectedDraftRevision ||
      context.draft.basePublishedRevision !== input.expectedPublishedRevision
    ) {
      throw new ClinicProfileServiceError('conflict', 'The clinic profile draft changed.')
    }

    const result = await req.payload.update({
      collection: 'clinicProfileDrafts',
      data: draftData({ context, input, revision: context.draft.revision + 1 }),
      depth: 0,
      overrideAccess: true,
      req,
      where: {
        and: [
          { id: { equals: context.draft.id } },
          { revision: { equals: context.draft.revision } },
          { clinic: { equals: context.clinic.id } },
        ],
      },
    })

    if (result.docs.length !== 1) {
      throw new ClinicProfileServiceError('conflict', 'The clinic profile draft changed.')
    }

    await commitTransaction(req)
  } catch (error: unknown) {
    await rollback(req)
    if (duplicateConstraint(error)) {
      throw new ClinicProfileServiceError('conflict', 'A clinic profile draft already exists.')
    }
    throw error
  }

  return readClinicProfileSnapshot(req, clinicId)
}

export const discardClinicProfileDraft = async (
  req: PayloadRequest,
  clinicId: RelationId,
  input: ClinicProfileDraftDiscardInput,
): Promise<ClinicProfileSnapshotDTO> => {
  await beginOwnedTransaction(req)

  try {
    const context = await readProfileContext(req, clinicId)
    if (!context.draft) {
      throw new ClinicProfileServiceError('not-found', 'The clinic profile draft does not exist.')
    }
    if (context.draft.revision !== input.expectedDraftRevision) {
      throw new ClinicProfileServiceError('conflict', 'The clinic profile draft changed.')
    }

    const result = await req.payload.delete({
      collection: 'clinicProfileDrafts',
      depth: 0,
      overrideAccess: true,
      req,
      where: {
        and: [
          { id: { equals: context.draft.id } },
          { revision: { equals: input.expectedDraftRevision } },
          { clinic: { equals: context.clinic.id } },
        ],
      },
    })
    if (result.docs.length !== 1) {
      throw new ClinicProfileServiceError('conflict', 'The clinic profile draft changed.')
    }

    await commitTransaction(req)
  } catch (error: unknown) {
    await rollback(req)
    throw error
  }

  return readClinicProfileSnapshot(req, clinicId)
}

const validateDraftForPublication = (draft: ClinicProfileDraft, citiesById: Map<string, City>): City => {
  const cityId = relationId(draft.address.city)
  const city = cityId === null ? undefined : citiesById.get(String(cityId))
  const errors: string[] = []

  if (!draft.name?.trim()) errors.push('name')
  if (!draft.address.street?.trim()) errors.push('address.street')
  if (!draft.address.houseNumber?.trim()) errors.push('address.houseNumber')
  if (!draft.address.zipCode?.trim()) errors.push('address.zipCode')
  if (!city) errors.push('address.city')
  if (!draft.supportedLanguages?.length) errors.push('supportedLanguages')

  const openingHoursValidation = validateOpeningHours(draft.openingHours)
  if (openingHoursValidation !== true) errors.push('openingHours')

  if (errors.length > 0 || !city) {
    throw new ClinicProfileServiceError(
      'invalid-input',
      `The clinic profile draft is not publishable: ${errors.join(', ')}.`,
    )
  }

  return city
}

export const publishClinicProfileDraft = async (
  req: PayloadRequest,
  clinicId: RelationId,
  input: ClinicProfilePublishInput,
): Promise<ClinicProfileSnapshotDTO> => {
  await beginOwnedTransaction(req)
  let previousClinic: Clinic | undefined
  let publishedClinic: Clinic | undefined

  try {
    const context = await readProfileContext(req, clinicId)
    previousClinic = context.clinic
    requireCurrentPublishedRevision(context.clinic, input.expectedPublishedRevision)

    if (!context.draft) {
      throw new ClinicProfileServiceError('not-found', 'The clinic profile draft does not exist.')
    }
    if (
      context.draft.revision !== input.expectedDraftRevision ||
      context.draft.basePublishedRevision !== input.expectedPublishedRevision
    ) {
      throw new ClinicProfileServiceError('conflict', 'The clinic profile draft changed.')
    }

    const city = validateDraftForPublication(context.draft, context.citiesById)
    const clinicUpdate = await req.payload.update({
      collection: 'clinics',
      context: {
        disableRevalidate: true,
      },
      data: {
        name: context.draft.name ?? '',
        description: context.draft.description,
        supportedLanguages: context.draft.supportedLanguages ?? [],
        address: {
          country: context.country.id,
          street: context.draft.address.street,
          houseNumber: context.draft.address.houseNumber,
          zipCode: context.draft.address.zipCode,
          city: city.id,
        },
        openingHours: context.draft.openingHours,
      },
      depth: 0,
      overrideAccess: true,
      req,
      where: {
        and: [{ id: { equals: context.clinic.id } }, { profileRevision: { equals: input.expectedPublishedRevision } }],
      },
    })
    if (clinicUpdate.docs.length !== 1) {
      throw new ClinicProfileServiceError('conflict', 'The published clinic profile changed.')
    }
    publishedClinic = clinicUpdate.docs[0]

    const draftDelete = await req.payload.delete({
      collection: 'clinicProfileDrafts',
      depth: 0,
      overrideAccess: true,
      req,
      where: {
        and: [
          { id: { equals: context.draft.id } },
          { revision: { equals: input.expectedDraftRevision } },
          { clinic: { equals: context.clinic.id } },
        ],
      },
    })
    if (draftDelete.docs.length !== 1) {
      throw new ClinicProfileServiceError('conflict', 'The clinic profile draft changed.')
    }

    await commitTransaction(req)
  } catch (error: unknown) {
    await rollback(req)
    throw error
  }

  if (!previousClinic || !publishedClinic) {
    throw new ClinicProfileServiceError('unavailable', 'The published clinic profile could not be resolved.')
  }

  dispatchClinicChangeRevalidation({
    doc: publishedClinic,
    previousDoc: previousClinic,
    req,
  })

  return readClinicProfileSnapshot(req, clinicId)
}
