// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LandingHeroSearchBarClient } from '@/components/organisms/Heroes/LandingHero/LandingHeroSearchBar.client'

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}))

vi.mock('@/components/molecules/ClinicSearchBar', () => ({
  ClinicSearchBar: ({
    onSearch,
  }: {
    onSearch?: (values: { service: string; location: string; budget: string }) => void
  }) => (
    <button type="button" onClick={() => onSearch?.({ service: ' 2 ', location: ' 10 ', budget: ' 5000 ' })}>
      Run homepage search
    </button>
  ),
}))

describe('LandingHeroSearchBarClient', () => {
  beforeEach(() => {
    mocks.routerPush.mockReset()
  })

  it('serializes the homepage service selection as the canonical specialty parameter', () => {
    render(<LandingHeroSearchBarClient />)

    fireEvent.click(screen.getByRole('button', { name: 'Run homepage search' }))

    expect(mocks.routerPush).toHaveBeenCalledWith('/listing-comparison?specialty=2&location=10&budget=5000')
    expect(mocks.routerPush.mock.calls[0]?.[0]).not.toContain('service=')
  })
})
