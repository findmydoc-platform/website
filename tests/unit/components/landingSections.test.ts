import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { LandingFeatures } from '@/components/organisms/Landing'

describe('landing sections', () => {
  it('renders LandingFeatures headings and descriptions', () => {
    const Icon = (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', props)
    const features = [
      {
        title: 'Fast onboarding',
        subtitle: 'Quick Start',
        description: 'Get set up in minutes.',
        icon: Icon,
      },
      {
        title: 'Global reach',
        subtitle: 'Worldwide',
        description: 'Reach patients everywhere.',
        icon: Icon,
      },
    ]

    const markup = renderToStaticMarkup(
      React.createElement(LandingFeatures, {
        features,
        title: 'Why choose us',
        description: 'Benefits for clinics and patients.',
      }),
    )

    expect(markup).toContain('Fast onboarding')
    expect(markup).toContain('Quick Start')
    expect(markup).toContain('Get set up in minutes.')
    expect(markup).toContain('Global reach')
    expect(markup).toContain('Worldwide')
    expect(markup).toContain('Reach patients everywhere.')
  })
})
