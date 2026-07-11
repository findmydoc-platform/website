import type { CollectionBeforeChangeHook } from 'payload'

import type { BasicUser } from '@/payload-types'
import {
  isFindmydocPlatformEmail,
  PLATFORM_STAFF_EMAIL_REQUIREMENT_MESSAGE,
} from '@/auth/utilities/platformStaffEmailPolicy'

export const enforcePlatformStaffEmailDomainHook: CollectionBeforeChangeHook<BasicUser> = ({
  data,
  operation,
  originalDoc,
}) => {
  if (operation !== 'create' && operation !== 'update') {
    return data
  }

  const nextUserType = data.userType ?? originalDoc?.userType
  if (nextUserType !== 'platform') {
    return data
  }

  const nextEmail = data.email ?? originalDoc?.email
  if (!isFindmydocPlatformEmail(nextEmail)) {
    throw new Error(PLATFORM_STAFF_EMAIL_REQUIREMENT_MESSAGE)
  }

  return data
}
