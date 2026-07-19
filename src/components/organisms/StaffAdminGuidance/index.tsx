'use client'

import { Banner } from '@payloadcms/ui/elements/Banner'
import { ShieldCheck } from 'lucide-react'
import React from 'react'

import './index.scss'

type StaffAdminGuidanceProps = {
  description: string
  title: string
}

const StaffAdminGuidance: React.FC<StaffAdminGuidanceProps> = ({ description, title }) => {
  return (
    <aside aria-label={title} className="mb-6">
      <Banner
        alignIcon="left"
        className="staff-admin-guidance__banner mb-0"
        icon={<ShieldCheck aria-hidden="true" size={22} />}
        type="success"
      >
        <div className="space-y-1">
          <p className="m-0 font-semibold">{title}</p>
          <p className="m-0 text-sm leading-6">{description}</p>
        </div>
      </Banner>
    </aside>
  )
}

export const PlatformStaffAdminGuidance: React.FC = () => (
  <StaffAdminGuidance
    title="Managed platform account"
    description="Platform staff accounts are provisioned through trusted operations. Review identity details here. Administrators can manage other staff roles; account creation and deletion are intentionally unavailable."
  />
)

export const ClinicStaffAdminGuidance: React.FC = () => (
  <StaffAdminGuidance
    title="Managed clinic account"
    description="Clinic staff accounts are not created or deleted in Payload Admin. Review identity details, clinic assignment, and approval status here."
  />
)
