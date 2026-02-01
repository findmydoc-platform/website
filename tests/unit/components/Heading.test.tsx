// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Heading } from '@/components/atoms/Heading'

describe('Heading', () => {
  it('renders the correct semantic heading level', () => {
    render(
      <Heading as="h1" align="left">
        Test heading
      </Heading>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('applies left alignment classes', () => {
    const { container } = render(
      <Heading as="h2" align="left">
        Aligned heading
      </Heading>,
    )

    expect(container.firstChild).toHaveClass('text-left')
  })

  it('applies center alignment classes', () => {
    const { container } = render(
      <Heading as="h2" align="center">
        Aligned heading
      </Heading>,
    )

    expect(container.firstChild).toHaveClass('text-center')
  })

  it('uses the semantic level size when size is not provided', () => {
    const { container } = render(
      <Heading as="h1" align="left">
        Sized heading
      </Heading>,
    )

    expect(container.firstChild).toHaveClass('text-4xl')
  })

  it('supports the section size mapping', () => {
    const { container } = render(
      <Heading as="h2" size="section" align="left">
        Section sized
      </Heading>,
    )

    expect(container.firstChild).toHaveClass('text-size-56')
  })

  it('applies default tracking class', () => {
    const { container } = render(
      <Heading as="h2" align="left">
        Tracked heading
      </Heading>,
    )

    expect(container.firstChild).toHaveClass('tracking-tight')
  })

  it('applies normal-case and tracking to h5 to override global uppercase', () => {
    const { container } = render(
      <Heading as="h5" align="left">
        Small heading
      </Heading>,
    )

    expect(container.firstChild).toHaveClass('tracking-tight')
    expect(container.firstChild).toHaveClass('normal-case')
  })

  it('allows size overrides independent of semantic level', () => {
    render(
      <Heading as="h3" size="h1" align="left">
        Overridden size
      </Heading>,
    )

    expect(screen.getByRole('heading', { level: 3 })).toHaveClass('text-4xl')
  })
})
