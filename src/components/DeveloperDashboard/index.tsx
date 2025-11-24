import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'

import { SeedingCard } from './Seeding/SeedingCard'

const DeveloperDashboard: React.FC = () => {
  return (
    <div className="mb-6">
      <Banner className="mb-0" type="success">
        <h4 className="m-0">Welcome to the Developer dashboard!</h4>
      </Banner>
      <div className="flex flex-col gap-4">
        <SeedingCard />
        <ul className="mb-2 list-decimal pl-5">
          <li className="w-full">
            Data model reference + error policy:{' '}
            <a
              href="/docs/seeding"
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

export default DeveloperDashboard
