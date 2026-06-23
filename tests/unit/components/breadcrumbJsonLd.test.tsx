// @vitest-environment jsdom
import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BreadcrumbJsonLd } from '@/components/molecules/Breadcrumb/BreadcrumbJsonLd'

describe('BreadcrumbJsonLd', () => {
  it('renders a BreadcrumbList script from breadcrumb items', () => {
    const { container } = render(
      <BreadcrumbJsonLd
        items={[
          { label: 'Home', href: '/' },
          { label: 'Clinics', href: '/listing-comparison' },
        ]}
      />,
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).not.toBeNull()
    expect(JSON.parse(script?.textContent ?? '')).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        expect.objectContaining({ name: 'Home', position: 1 }),
        expect.objectContaining({ name: 'Clinics', position: 2 }),
      ],
    })
  })
})
