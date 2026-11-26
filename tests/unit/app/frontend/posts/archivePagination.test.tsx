// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PostsPagination } from '@/app/(frontend)/posts/_components/PostsPagination'

describe('blog archive page navigation', () => {
  it('puts the next and previous German archive destinations directly in the initial HTML', () => {
    const html = renderToStaticMarkup(<PostsPagination contentLocale={{ locale: 'de' }} page={2} totalPages={3} />)
    const container = document.createElement('div')
    container.innerHTML = html
    const pagination = within(container).getByRole('navigation', { name: 'pagination' })

    expect(within(pagination).getByRole('link', { name: 'Go to previous page' })).toHaveAttribute(
      'href',
      '/posts?locale=de',
    )
    expect(within(pagination).getByRole('link', { name: 'Go to next page' })).toHaveAttribute(
      'href',
      '/posts/page/3?locale=de',
    )
    expect(within(pagination).getByText('2')).toHaveAttribute('aria-current', 'page')
  })

  it('links directly to page two in the standard archive', () => {
    render(<PostsPagination contentLocale={{}} page={1} totalPages={2} />)

    expect(screen.getByRole('link', { name: 'Go to next page' })).toHaveAttribute('href', '/posts/page/2')
    expect(screen.getByRole('button', { name: 'Go to previous page' })).toBeDisabled()
  })
})
