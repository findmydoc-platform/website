import React from 'react'
import type { WidgetServerProps } from 'payload'
import { Banner } from '@payloadcms/ui/elements/Banner'

import { Heading } from '@/components/atoms/Heading'
import { SeedingCard } from './Seeding/SeedingCard'
import type { DashboardUserType } from './Seeding/SeedingCardView'

type DeveloperDashboardProps = {
  seedingSlot?: React.ReactNode
}

type DashboardUserLike = {
  collection?: unknown
  userType?: unknown
}

const isDashboardUserType = (value: unknown): value is DashboardUserType => {
  return value === 'platform' || value === 'clinic' || value === 'patient' || value === 'unknown'
}

const resolveDashboardUserType = (user: DashboardUserLike | null | undefined): DashboardUserType => {
  const rawUserType = user?.userType
  if (isDashboardUserType(rawUserType)) return rawUserType

  const rawCollection = user?.collection
  if (rawCollection === 'patients') return 'patient'
  if (rawCollection === 'clinicStaff') return 'clinic'
  return 'unknown'
}

export const DeveloperDashboardView: React.FC<DeveloperDashboardProps> = (props) => {
  return (
    <div className="mb-6">
      <Banner className="mb-0" type="success">
        <Heading as="h4" align="left" className="m-0">
          Welcome to the Developer dashboard!
        </Heading>
      </Banner>
      <div className="flex flex-col gap-4">
        {props.seedingSlot ?? <SeedingCard forcedUserType="platform" />}
        <ul className="mb-2 list-decimal pl-6">
          <li className="w-full">
            Data model reference + error policy:{' '}
            <a
              href="https://github.com/findmydoc-platform/website/blob/main/docs/seeding.md"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:opacity-85"
            >
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

const DeveloperDashboardWidget: React.FC<WidgetServerProps> = (props) => {
  const user = (props.req?.user as DashboardUserLike | null | undefined) ?? null
  const forcedUserType = resolveDashboardUserType(user)

  return <SeedingCard controls={props.widgetData} forcedUserType={forcedUserType} />
}

export default DeveloperDashboardWidget
