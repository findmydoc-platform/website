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

  it('renders each JSON-LD node in its own script and removes empty fields', () => {
    const { container } = render(
      <JsonLdScript
        data={[
          {
            '@context': 'https://schema.org',
            '@id': 'https://findmydoc.eu/#organization',
            '@type': 'Organization',
            name: 'findmydoc',
            description: '',
            image: undefined,
          },
          {
            '@context': 'https://schema.org',
            '@id': 'https://findmydoc.eu/#website',
            '@type': 'WebSite',
            name: 'findmydoc',
          },
        ]}
      />,
    )

    const scripts = Array.from(container.querySelectorAll('script[type="application/ld+json"]'))
    const nodes = scripts.map((script) => JSON.parse(script.textContent ?? ''))

    expect(scripts).toHaveLength(2)
    expect(nodes.every((node) => !Array.isArray(node))).toBe(true)
    expect(nodes).toEqual([
      {
        '@context': 'https://schema.org',
        '@id': 'https://findmydoc.eu/#organization',
        '@type': 'Organization',
        name: 'findmydoc',
      },
      {
        '@context': 'https://schema.org',
        '@id': 'https://findmydoc.eu/#website',
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
