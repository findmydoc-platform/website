import type { CollectionAfterChangeHook, Payload, PayloadRequest } from 'payload'
import type { BasicUser, ClinicStaff, PlatformStaff } from '@/payload-types'

const PROFILE_CONFIG = {
  clinic: { collection: 'clinicStaff', defaultData: { status: 'pending' } },
  platform: { collection: 'platformStaff', defaultData: { role: 'admin' } },
} as const

async function createUserProfile(
  userDoc: BasicUser,
  userType: 'clinic' | 'platform',
  payload: Payload,
  req: PayloadRequest,
) {
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
  const data: Pick<ClinicStaff, 'user' | 'status'> | Pick<PlatformStaff, 'user' | 'role'> =
    userType === 'clinic' ? { user: userDoc.id, status: 'pending' } : { user: userDoc.id, role: 'admin' }
  try {
    await payload.create({ collection: config.collection, data, req, overrideAccess: true, draft: false })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    // Log and swallow to keep hook graceful per tests
    payload.logger.error(
      {
        error: msg,
        userType,
        collection: config.collection,
      },
      `Failed to create ${userType} profile for user: ${userDoc.id}`,
    )
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
