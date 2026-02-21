// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
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

  it('applies custom logo source', () => {
    render(<Header navItems={navItems} logoSrc="/preview-logo.png" />)

    const logo = screen.getByRole('img', { name: 'findmydoc' })
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('src', '/preview-logo.png')
  })
})
