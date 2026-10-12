'use client'

import { AdminNotice } from './index'

export function PlatformStaffAdminGuidance() {
  return (
    <AdminNotice
      variant="success"
      title="Managed platform account"
      description="Platform staff accounts are provisioned through trusted operations. Review identity details and change your own profile image here. Administrators can manage other staff roles; account creation and deletion are intentionally unavailable."
    />
  )
}
