/*
 * Payload admin extension component.
 * This file is rendered inside `/admin` via Payload's `beforeDashboard` hook.
 */

'use client'

import { useAuth } from '@payloadcms/ui'
import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'

import { SeedingCard } from './Seeding/SeedingCard'

type DeveloperDashboardProps = {
  seedingSlot?: React.ReactNode
}

export const DeveloperDashboardView: React.FC<DeveloperDashboardProps> = (props) => {
  return (
    <div className="mb-6">
      <Banner className="mb-0" type="success">
        <h4 className="m-0">Welcome to the Developer dashboard!</h4>
      </Banner>
      <div className="flex flex-col gap-4">
        {props.seedingSlot ?? <SeedingCard />}
        <ul className="mb-2 list-decimal pl-6">
          <li className="w-full">
            Data model reference + error policy:{' '}
            <a href="/docs/seeding" target="_blank" rel="noreferrer noopener" className="hover:opacity-85">
              Seeding System Docs
            </a>
          </li>
          <li className="w-full">
            <a
              href="https://github.com/findmydoc-platform/architecture"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:opacity-85"
            >
              Check our Architecture Decision Records (ADRs)
            </a>
            {' to understand our architectural decisions and standards.'}
          </li>
        </ul>
      </div>
    </div>
  )
}

const DeveloperDashboard: React.FC<DeveloperDashboardProps> = (props) => {
  const { user } = useAuth()

  const userTypeRaw = (user as unknown as { userType?: unknown } | null)?.userType
  const userType = typeof userTypeRaw === 'string' ? userTypeRaw : 'unknown'

  if (userType === 'unknown') {
    return (
      <div className="mb-6">
        <Banner className="mb-0" type="info">
          <h4 className="m-0">Loading developer dashboard…</h4>
        </Banner>
      </div>
    )
  }

  if (userType !== 'platform') {
    return (
      <div className="mb-6">
        <Banner className="mb-0" type="default">
          <h4 className="m-0">Developer dashboard is available to platform staff only.</h4>
        </Banner>
      </div>
    )
  }

  return <DeveloperDashboardView {...props} />
}

export default DeveloperDashboard
