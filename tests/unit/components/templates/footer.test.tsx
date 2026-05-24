// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
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
      title: 'Services',
      items: [{ href: '/service', label: 'Services', appearance: 'inline', newTab: false }],
    },
    {
      title: 'Information',
      items: [{ href: '/info', label: 'Information', appearance: 'inline', newTab: false }],
    },
  ]

  const footerGroupsWithLegalLink: FooterNavGroup[] = [
    footerGroups[0]!,
    footerGroups[1]!,
    {
      title: 'Information',
      items: [
        { href: '/privacy-settings', label: 'Privacy settings', appearance: 'inline', newTab: false },
        { href: '/privacy-policy', label: 'Privacy Policy', appearance: 'inline', newTab: false },
      ],
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

  it('only promotes canonical legal footer links into the quick links group', () => {
    render(<Footer footerGroups={footerGroupsWithLegalLink} />)

    const legalQuickLinks = screen.getByRole('navigation', { name: 'Footer legal quick links' })

    expect(within(legalQuickLinks).getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument()
    expect(within(legalQuickLinks).queryByRole('link', { name: 'Privacy settings' })).not.toBeInTheDocument()
  })

  it('does not render empty mobile accordion groups when only legal quick links are available', () => {
    render(
      <Footer
        footerGroups={[
          { title: 'About', items: [] },
          { title: 'Services', items: [] },
          {
            title: 'Information',
            items: [{ href: '/privacy-policy', label: 'Privacy Policy', appearance: 'inline', newTab: false }],
          },
        ]}
      />,
    )

    const legalQuickLinks = screen.getByRole('navigation', { name: 'Footer legal quick links' })

    expect(screen.queryByRole('button', { name: 'About' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Services' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Information' })).not.toBeInTheDocument()
    expect(within(legalQuickLinks).getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument()
  })
})
