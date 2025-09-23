import type { CollectionAfterChangeHook } from 'payload'
import type { BasicUser } from '@/payload-types'

const PROFILE_CONFIG = {
  clinic: { collection: 'clinicStaff', defaultData: { status: 'pending' } },
  platform: { collection: 'platformStaff', defaultData: { role: 'admin' } },
} as const

async function createUserProfile(userDoc: BasicUser, userType: 'clinic' | 'platform', payload: any, req: any) {
  const config = PROFILE_CONFIG[userType]
  const existing = await payload.find({
    collection: config.collection,
    where: { user: { equals: userDoc.id } },
    limit: 1,
    req,
  })
  if (existing.docs.length) {
    payload.logger.info(`Profile already exists for ${userType} user: ${userDoc.id}`)
    return
  }
  const data: any = { user: userDoc.id, ...config.defaultData }
  if (userType === 'clinic') data.email = userDoc.email
  try {
    await payload.create({ collection: config.collection, data, req, overrideAccess: true })
  } catch (e: any) {
    // Log and swallow to keep hook graceful per tests
    payload.logger.error(`Failed to create ${userType} profile for user: ${userDoc.id}`, {
      error: e?.message ?? String(e),
      userType,
      collection: config.collection,
    })
  }
}

export const createUserProfileHook: CollectionAfterChangeHook<BasicUser> = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc
  if (req.context?.skipProfileCreation) return doc
  const { payload } = req
  const userType = doc.userType
  if (userType === 'clinic' || userType === 'platform') {
    await createUserProfile(doc, userType, payload, req)
  }
  return doc
}
