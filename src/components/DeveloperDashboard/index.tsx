import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'

import { SeedingCard } from './Seeding/SeedingCard'
import './index.scss'

const baseClass = 'developer-dashboard'

const DeveloperDashboard: React.FC = () => {
  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Welcome to the Developer dashboard!</h4>
      </Banner>
      <div className={`${baseClass}__layoutStack`}>
        <SeedingCard />
        <ul className={`${baseClass}__instructions`}>
          <li>
            Data model reference + error policy:{' '}
            <a href="/docs/seeding" target="_blank" rel="noreferrer noopener">
              Seeding System Docs
            </a>
          </li>
          <li>
            <a href="https://github.com/findmydoc-platform/architecture" target="_blank" rel="noreferrer noopener">
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
