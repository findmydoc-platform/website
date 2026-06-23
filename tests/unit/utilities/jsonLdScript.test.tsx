// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { JsonLdScript } from '@/utilities/structuredData'

describe('JsonLdScript', () => {
  it('renders a single JSON-LD script', () => {
    const { container } = render(<JsonLdScript data={{ '@context': 'https://schema.org', '@type': 'WebSite' }} />)

    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).not.toBeNull()
    expect(JSON.parse(script?.textContent ?? '')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
    })
  })

  it('renders a list of JSON-LD nodes and removes empty fields', () => {
    const { container } = render(
      <JsonLdScript
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'findmydoc',
            description: '',
            image: undefined,
          },
          { '@context': 'https://schema.org', '@type': 'WebSite', name: 'findmydoc' },
        ]}
      />,
    )

    const script = container.querySelector('script[type="application/ld+json"]')
    expect(JSON.parse(script?.textContent ?? '')).toEqual([
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'findmydoc',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'findmydoc',
      },
    ])
  })

  it('escapes less-than characters before rendering script text', () => {
    const { container } = render(
      <JsonLdScript data={{ '@context': 'https://schema.org', '@type': 'Thing', name: '</script><img>' }} />,
    )

    const scriptText = container.querySelector('script[type="application/ld+json"]')?.textContent ?? ''
    expect(scriptText).toContain('\\u003c/script>')
    expect(scriptText).not.toContain('</script>')
    expect(JSON.parse(scriptText).name).toBe('</script><img>')
  })

  it('renders nothing for empty input', () => {
    const { container } = render(<JsonLdScript data={null} />)

    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull()
  })
})
