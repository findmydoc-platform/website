// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PostsPagination } from '@/app/(frontend)/posts/_components/PostsPagination'

const copy = {
  label: 'Fixture pages',
  previous: { label: 'Fixture previous page', text: 'Fixture previous' },
  next: { label: 'Fixture next page', text: 'Fixture next' },
}

describe('blog archive page navigation', () => {
  it.each([
    { locale: 'de', previous: '/posts', next: '/posts/page/3' },
    { locale: 'en', previous: '/en/posts', next: '/en/posts/page/3' },
  ] as const)('links to adjacent $locale archive pages', ({ locale, previous, next }) => {
    render(<PostsPagination locale={locale} page={2} totalPages={3} copy={copy} />)
    const pagination = within(screen.getByRole('navigation', { name: copy.label }))

    expect(pagination.getByRole('link', { name: copy.previous.label })).toHaveAttribute('href', previous)
    expect(pagination.getByRole('link', { name: copy.next.label })).toHaveAttribute('href', next)
    expect(pagination.getByText('2')).toHaveAttribute('aria-current', 'page')
  })

  it('disables the previous page control on page one', () => {
    render(<PostsPagination locale="de" page={1} totalPages={2} copy={copy} />)

    expect(screen.getByRole('link', { name: copy.next.label })).toHaveAttribute('href', '/posts/page/2')
    expect(screen.getByRole('button', { name: copy.previous.label })).toBeDisabled()
  })
})
