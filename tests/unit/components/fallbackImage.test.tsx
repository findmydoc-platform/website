// @vitest-environment jsdom

import '@testing-library/jest-dom'

import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/image', () => ({
  default: (props: unknown) => {
    const {
      blurDataURL: _blurDataURL,
      fill: _fill,
      loader: _loader,
      placeholder: _placeholder,
      priority: _priority,
      quality: _quality,
      sizes: _sizes,
      ...rest
    } = props as Record<string, unknown>

    return React.createElement('img', rest)
  },
}))

import { FallbackImage } from '@/components/atoms/FallbackImage'

describe('FallbackImage', () => {
  it('tries each fallback source before settling on the placeholder', () => {
    render(
      <FallbackImage
        src="/generated.webp"
        fallbackSrc={['/original.webp', '/placeholder.svg']}
        alt="Blog hero"
        width={1600}
        height={900}
      />,
    )

    const image = screen.getByRole('img', { name: 'Blog hero' })

    expect(image).toHaveAttribute('src', '/generated.webp')

    fireEvent.error(image)
    expect(image).toHaveAttribute('src', '/original.webp')

    fireEvent.error(image)
    expect(image).toHaveAttribute('src', '/placeholder.svg')
  })
})
