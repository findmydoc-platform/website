import type { CollectionSlug, Payload } from 'payload'
import { resolveSeedRuntimeEnv } from './runtime'
import { resolveSeedRuntimePolicy } from '@/features/runtimePolicy'

function toSnakeCaseKey(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase()
}

const demoResetOrder: CollectionSlug[] = [
  'search',
  'reviews',
  'patientClinicInquiries',
  'favoriteclinics',
  'patients',
  'doctortreatments',
  'doctorspecialties',
  'clinictreatments',
  'clinicMedia',
  'doctorMedia',
  'doctors',
  'clinics',
  'posts',
  'platformStaff',
  'clinicStaff',
  'userProfileMedia',
  'basicUsers',
]

const baselineResetOrder: CollectionSlug[] = [
  'treatments',
  'categories',
  'tags',
  'accreditation',
  'medical-specialties',
  'cities',
  'countries',
]

async function deleteCollection(payload: Payload, collection: CollectionSlug) {
  const req = { payload }

  await payload.db.deleteMany({
    collection,
    req,
    where: {
      id: {
        exists: true,
      },
    },
  })

  const versionTableName = payload.db.tableNameMap.get(`_${toSnakeCaseKey(collection)}${payload.db.versionsSuffix}`)
  if (!versionTableName) {
    return
  }

  await payload.db.deleteVersions({
    collection,
    req,
    where: {
      id: {
        exists: true,
      },
    },
  })
}

export async function resetCollections(payload: Payload, kind: 'baseline' | 'demo') {
  const runtimeEnv = resolveSeedRuntimeEnv(undefined, process.env)
  const policy = resolveSeedRuntimePolicy(runtimeEnv)

  if (kind === 'demo' && !policy.allowDemo) {
    throw new Error('Demo reset is disabled in production runtime')
  }

  if (kind === 'baseline' && !policy.allowBaseline) {
    throw new Error('Baseline reset is disabled in this runtime')
  }

  if (!policy.allowReset) {
    throw new Error('Seed reset is disabled in this runtime')
  }

  // Baseline reference data is commonly referenced by demo data (e.g. treatments
  // referenced by clinictreatments). To avoid FK / NOT NULL violations during
  // deletion, baseline resets must clear demo collections first.
  const order = kind === 'demo' ? demoResetOrder : [...demoResetOrder, ...baselineResetOrder]
  for (const collection of order) {
    payload.logger.info(`Resetting ${collection} (${kind})`)
    await deleteCollection(payload, collection)
  }
}
