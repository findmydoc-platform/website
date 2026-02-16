'use client'

import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'

const MedicalSpecialtiesAdminGuidance: React.FC = () => {
  return (
    <div className="mb-4">
      <Banner type="info">
        <p className="m-0 text-sm leading-6">
          Use this collection for specialty taxonomy only. Keep entries at specialty/category level; concrete treatment
          procedures are managed separately.{' '}
          <a href="/docs/seeding" target="_blank" rel="noreferrer noopener" className="underline hover:opacity-85">
            See seeding documentation
          </a>
          .
        </p>
      </Banner>
    </div>
  )
}

export default MedicalSpecialtiesAdminGuidance
