// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import AdminLoginLogo from '@/components/organisms/AdminBranding/AdminLoginLogo'
import AdminNavIcon from '@/components/organisms/AdminBranding/AdminNavIcon'
import AdminThemeProvider from '@/components/organisms/AdminBranding/AdminThemeProvider'

describe('Admin branding components', () => {
  it('renders the admin nav icon with expected asset and dimensions', () => {
    render(<AdminNavIcon />)

    const icon = screen.getByRole('img', { name: 'findmydoc icon' })
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveAttribute('src', '/fmd-icon-1-white.png')
    expect(icon).toHaveAttribute('width', '18')
    expect(icon).toHaveAttribute('height', '18')
    expect(icon.getAttribute('style')).not.toContain('background-color')
    expect(icon.getAttribute('style')).not.toContain('padding')
  })

  it('renders the admin login branding with the white icon asset', () => {
    render(<AdminLoginLogo />)

    const logo = screen.getByRole('img', { name: 'findmydoc icon' })
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('src', '/fmd-icon-1-white.png')
    expect(logo).toHaveAttribute('width', '56')
    expect(logo).toHaveAttribute('height', '56')
  })

  it('injects conservative admin theme overrides and preserves children', () => {
    render(
      <AdminThemeProvider>
        <div>Admin Theme Child</div>
      </AdminThemeProvider>,
    )

    expect(screen.getByText('Admin Theme Child')).toBeInTheDocument()

    const styleTag = document.querySelector('style[data-fmd-admin-theme="true"]')
    expect(styleTag).toBeInTheDocument()
    expect(styleTag?.textContent).toContain('--fmd-admin-accent-500')
    expect(styleTag?.textContent).toContain('--theme-success-500: var(--fmd-admin-accent-500);')
    expect(styleTag?.textContent).toContain("html[data-theme='light'] .btn--style-primary")
    expect(styleTag?.textContent).toContain("html[data-theme='light'] .nav__link-indicator")
    expect(styleTag?.textContent).toContain("html[data-theme='light'] .collections__card-list .card--has-onclick:hover")
    expect(styleTag?.textContent).toContain('.fmd-admin-account-avatar--active')
  })
})
