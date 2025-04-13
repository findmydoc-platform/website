import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'

import { SeedButton } from './SeedButton'
import './index.scss'

const baseClass = 'developer-dashboard'

const DeveloperDashboard: React.FC = () => {
  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Welcome to the Developer dashboard!</h4>
      </Banner>
      <ul className={`${baseClass}__instructions`}>
        <li>
          <SeedButton />
          {' with example data, then '}
          <a href="/" target="_blank">
            visit your website
          </a>
          {' to see the results.'}
        </li>
        <li>
          <a
            href="https://github.com/Ueff24/architecture-decision-records"
            target="_blank"
            rel="noreferrer noopener"
          >
            Check our Architecture Decision Records (ADRs)
          </a>
          {' to understand our architectural decisions and standards.'}
        </li>
      </ul>
    </div>
  )
}

export default DeveloperDashboard
