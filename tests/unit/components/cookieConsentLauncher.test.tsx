// @vitest-environment jsdom

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CookieConsentLauncher } from '@/components/organisms/CookieConsent/CookieConsentLauncher.client'

describe('CookieConsentLauncher', () => {
  it('keeps the launcher fixed on auth routes', () => {
    render(<CookieConsentLauncher label="Cookie settings" onOpenSettings={() => {}} />)

    expect(screen.getByRole('button', { name: 'Cookie settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cookie settings' }).parentElement).toHaveClass('fixed')
    expect(screen.getByRole('button', { name: 'Cookie settings' }).parentElement).not.toHaveClass('relative')
  })
})
