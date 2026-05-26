// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Header } from '@/components/templates/Header/Component'
import type { HeaderNavItem } from '@/utilities/normalizeNavItems'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('Header template', () => {
  const navItems: HeaderNavItem[] = [{ href: '/about', label: 'About', newTab: false }]

  it('renders menu items', () => {
    render(<Header navItems={navItems} />)

    expect(screen.getByRole('link', { name: 'About' })).toBeInTheDocument()
  })

  it('does not render the mobile menu button without nav items', () => {
    render(<Header navItems={[]} />)

    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
  })

  it('opens the mobile navigation when nav items are available', () => {
    render(<Header navItems={navItems} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    const mobileNavigation = screen.getByRole('navigation', { name: 'Mobile navigation' })
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument()
    expect(within(mobileNavigation).getByRole('link', { name: 'About' })).toBeInTheDocument()
  })

  it('clears mobile scroll lock and moves focus to the logo when nav items become unavailable', async () => {
    document.body.style.overflow = ''
    const { rerender } = render(<Header navItems={navItems} />)
    const logoLink = screen.getByRole('link', { name: 'findmydoc' })

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    const mobileLink = within(screen.getByRole('navigation', { name: 'Mobile navigation' })).getByRole('link', {
      name: 'About',
    })
    mobileLink.focus()
    expect(mobileLink).toHaveFocus()

    await waitFor(() => expect(document.body.style.overflow).toBe('hidden'))

    rerender(<Header navItems={[]} />)

    await waitFor(() => expect(document.body.style.overflow).toBe(''))
    await waitFor(() => expect(logoLink).toHaveFocus())
    expect(screen.queryByRole('button', { name: 'Close menu' })).not.toBeInTheDocument()
  })

  it('returns focus to the mobile menu button after Escape closes the menu', async () => {
    render(<Header navItems={navItems} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const mobileLink = within(screen.getByRole('navigation', { name: 'Mobile navigation' })).getByRole('link', {
      name: 'About',
    })
    mobileLink.focus()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus()
  })

  it('applies custom logo source', () => {
    render(<Header navItems={navItems} logoSrc="/preview-logo.png" />)

    const logo = screen.getByRole('img', { name: 'findmydoc' })
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('src', '/preview-logo.png')
  })
})
