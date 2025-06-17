import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import type { PlattformStaff } from '../payload-types'
import { getClientSideURL } from './getURL'

export const getMePlattformStaffUser = async (args?: {
  nullPlattformStaffUserRedirect?: string
  validPlattformStaffUserRedirect?: string
}): Promise<{
  token: string
  user: PlattformStaff
}> => {
  const {
    nullPlattformStaffUserRedirect: nullPlattformStaffUserRedirect,
    validPlattformStaffUserRedirect: validPlattformStaffUserRedirect,
  } = args || {}
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value

  const meUserReq = await fetch(`${getClientSideURL()}/api/plattformStaff/me`, {
    headers: {
      Authorization: `JWT ${token}`,
    },
  })

  const {
    user,
  }: {
    user: PlattformStaff
  } = await meUserReq.json()

  if (validPlattformStaffUserRedirect && meUserReq.ok && user) {
    redirect(validPlattformStaffUserRedirect)
  }

  if (nullPlattformStaffUserRedirect && (!meUserReq.ok || !user)) {
    redirect(nullPlattformStaffUserRedirect)
  }

  // Token will exist here because if it doesn't the user will be redirected
  return {
    token: token!,
    user,
  }
}
