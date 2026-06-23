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

  it('escapes less-than characters before rendering JSON-LD script text', () => {
    const { container } = render(
      <BreadcrumbJsonLd
        items={[
          { label: 'Home', href: '/' },
          { label: '</script><img src=x onerror=alert(1)>', href: '/clinics' },
        ]}
      />,
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script?.textContent).toContain('\\u003c/script>')
    expect(JSON.parse(script?.textContent ?? '').itemListElement[1]).toMatchObject({
      name: '</script><img src=x onerror=alert(1)>',
    })
  })
})
