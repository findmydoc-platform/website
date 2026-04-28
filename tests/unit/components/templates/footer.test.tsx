// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Footer } from '@/components/templates/Footer/Component'
import type { FooterNavGroup } from '@/utilities/normalizeNavItems'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('Footer template', () => {
  const footerGroups: FooterNavGroup[] = [
    {
      title: 'About',
      items: [{ href: '/about', label: 'About us', appearance: 'inline', newTab: false }],
    },
    {
      title: 'Service',
      items: [{ href: '/service', label: 'Service', appearance: 'inline', newTab: false }],
    },
    {
      title: 'Information',
      items: [{ href: '/info', label: 'Information', appearance: 'inline', newTab: false }],
    },
  ]

  it('renders nav and social links', () => {
    render(<Footer footerGroups={footerGroups} />)

    expect(screen.getAllByRole('link', { name: 'About us' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Meta' }).length).toBeGreaterThan(0)
  })

  it('applies custom logo source', () => {
    render(<Footer footerGroups={footerGroups} logoSrc="/preview-logo.png" />)

    const logos = screen.getAllByRole('img', { name: 'findmydoc' })

    expect(logos.length).toBeGreaterThan(0)
    logos.forEach((logo) => {
      expect(logo).toHaveAttribute('src', '/preview-logo.png')
    })
  })
})
