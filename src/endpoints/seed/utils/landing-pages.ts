import type { Payload } from 'payload'

import { createStableIdResolvers } from './resolvers'

type SeedObject = Record<string, unknown>

function cloneSeedData(data: Record<string, unknown>): SeedObject {
  return JSON.parse(JSON.stringify(data)) as SeedObject
}

function isRecord(value: unknown): value is SeedObject {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function requireRecord(value: unknown, path: string): SeedObject {
  if (!isRecord(value)) {
    throw new Error(`Landing pages seed field ${path} must be an object`)
  }

  return value
}

function requireArray(value: unknown, path: string): SeedObject[] {
  if (!Array.isArray(value)) {
    throw new Error(`Landing pages seed field ${path} must be an array`)
  }

  return value.map((item, index) => requireRecord(item, `${path}.${index}`))
}

async function resolveRequiredMediaStableId(options: {
  resolveIdByStableId: ReturnType<typeof createStableIdResolvers>['resolveIdByStableId']
  target: SeedObject
  stableIdField: string
  mediaField: string
  fieldPath: string
}): Promise<void> {
  const { resolveIdByStableId, target, stableIdField, mediaField, fieldPath } = options
  const stableId = target[stableIdField]
  delete target[stableIdField]

  if (typeof stableId !== 'string' || stableId.trim().length === 0) {
    throw new Error(`Landing pages media stableId for ${fieldPath} is missing`)
  }

  const mediaId = await resolveIdByStableId('platformContentMedia', stableId)

  if (mediaId == null) {
    throw new Error(`Landing pages media stableId ${stableId} for ${fieldPath} was not found`)
  }

  target[mediaField] = mediaId
}

async function resolveArrayMediaStableIds(options: {
  resolveIdByStableId: ReturnType<typeof createStableIdResolvers>['resolveIdByStableId']
  items: SeedObject[]
  stableIdField: string
  mediaField: string
  fieldPath: string
}): Promise<void> {
  const { resolveIdByStableId, items, stableIdField, mediaField, fieldPath } = options

  for (const [index, item] of items.entries()) {
    await resolveRequiredMediaStableId({
      resolveIdByStableId,
      target: item,
      stableIdField,
      mediaField,
      fieldPath: `${fieldPath}.${index}.${mediaField}`,
    })
  }
}

export async function prepareLandingPagesSeedData(
  payload: Payload,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const draft = cloneSeedData(data)
  const home = requireRecord(draft.home, 'home')
  const clinicPartners = requireRecord(draft.clinicPartners, 'clinicPartners')
  const homeHero = requireRecord(home.hero, 'home.hero')
  const homeFeatures = requireRecord(home.features, 'home.features')
  const homeProcess = requireRecord(home.process, 'home.process')
  const clinicHero = requireRecord(clinicPartners.hero, 'clinicPartners.hero')
  const clinicProcess = requireRecord(clinicPartners.process, 'clinicPartners.process')
  const about = requireRecord(draft.about, 'about')
  const aboutHero = requireRecord(about.hero, 'about.hero')
  const { resolveIdByStableId } = createStableIdResolvers(payload)

  await resolveRequiredMediaStableId({
    resolveIdByStableId,
    target: homeHero,
    stableIdField: 'imageStableId',
    mediaField: 'image',
    fieldPath: 'home.hero.image',
  })
  await resolveRequiredMediaStableId({
    resolveIdByStableId,
    target: homeFeatures,
    stableIdField: 'backgroundImageStableId',
    mediaField: 'backgroundImage',
    fieldPath: 'home.features.backgroundImage',
  })
  await resolveArrayMediaStableIds({
    resolveIdByStableId,
    items: requireArray(home.testimonials, 'home.testimonials'),
    stableIdField: 'imageStableId',
    mediaField: 'image',
    fieldPath: 'home.testimonials',
  })
  await resolveArrayMediaStableIds({
    resolveIdByStableId,
    items: requireArray(homeProcess.steps, 'home.process.steps'),
    stableIdField: 'imageStableId',
    mediaField: 'image',
    fieldPath: 'home.process.steps',
  })
  await resolveRequiredMediaStableId({
    resolveIdByStableId,
    target: clinicHero,
    stableIdField: 'imageStableId',
    mediaField: 'image',
    fieldPath: 'clinicPartners.hero.image',
  })
  await resolveArrayMediaStableIds({
    resolveIdByStableId,
    items: requireArray(clinicProcess.steps, 'clinicPartners.process.steps'),
    stableIdField: 'imageStableId',
    mediaField: 'image',
    fieldPath: 'clinicPartners.process.steps',
  })
  await resolveArrayMediaStableIds({
    resolveIdByStableId,
    items: requireArray(clinicPartners.team, 'clinicPartners.team'),
    stableIdField: 'imageStableId',
    mediaField: 'image',
    fieldPath: 'clinicPartners.team',
  })
  await resolveArrayMediaStableIds({
    resolveIdByStableId,
    items: requireArray(clinicPartners.testimonials, 'clinicPartners.testimonials'),
    stableIdField: 'imageStableId',
    mediaField: 'image',
    fieldPath: 'clinicPartners.testimonials',
  })
  await resolveRequiredMediaStableId({
    resolveIdByStableId,
    target: aboutHero,
    stableIdField: 'imageStableId',
    mediaField: 'image',
    fieldPath: 'about.hero.image',
  })
  await resolveArrayMediaStableIds({
    resolveIdByStableId,
    items: requireArray(about.team, 'about.team'),
    stableIdField: 'imageStableId',
    mediaField: 'image',
    fieldPath: 'about.team',
  })

  return draft
}
