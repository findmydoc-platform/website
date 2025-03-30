import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import type { Staff } from '../payload-types'
import { getClientSideURL } from './getURL'

export const getMeStaffUser = async (args?: {
  nullStaffUserRedirect?: string
  validStaffUserRedirect?: string
}): Promise<{
  token: string
  user: Staff
}> => {
  const {
    nullStaffUserRedirect: nullStaffUserRedirect,
    validStaffUserRedirect: validStaffUserRedirect,
  } = args || {}
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value

  const meUserReq = await fetch(`${getClientSideURL()}/api/staff/me`, {
    headers: {
      Authorization: `JWT ${token}`,
    },
  })

  const {
    user,
  }: {
    user: Staff
  } = await meUserReq.json()

  if (validStaffUserRedirect && meUserReq.ok && user) {
    redirect(validStaffUserRedirect)
  }

  if (nullStaffUserRedirect && (!meUserReq.ok || !user)) {
    redirect(nullStaffUserRedirect)
  }

  // Token will exist here because if it doesn't the user will be redirected
  return {
    token: token!,
    user,
  }
}
