'use client'

import { AdminNotice } from './index'

export function ClinicStaffAdminGuidance() {
  return (
    <AdminNotice
      variant="success"
      title="Managed clinic account"
      description="Clinic staff accounts are not created or deleted in Payload Admin. Review identity details, clinic assignment, and approval status here."
    />
  )
}
