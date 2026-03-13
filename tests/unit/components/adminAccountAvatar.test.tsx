// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminAccountAvatar from '@/components/organisms/AdminBranding/AdminAccountAvatar'

const { mockUseAuth, mockUseConfig, mockUsePayloadAPI, mockUsePathname } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseConfig: vi.fn(),
  mockUsePayloadAPI: vi.fn(),
  mockUsePathname: vi.fn(),
}))

vi.mock('@payloadcms/ui', () => ({
  useAuth: mockUseAuth,
  useConfig: mockUseConfig,
  usePayloadAPI: mockUsePayloadAPI,
}))

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
}))

vi.mock('payload/shared', () => ({
  formatAdminURL: ({ adminRoute, apiRoute, path }: { adminRoute?: string; apiRoute?: string; path: string }) =>
    `${adminRoute ?? apiRoute ?? ''}${path}`,
}))

const setDefaultMocks = () => {
  mockUseAuth.mockReturnValue({
    user: {
      collection: 'basicUsers',
      profileImage: null,
    },
  })

  mockUseConfig.mockReturnValue({
    config: {
      admin: {
        routes: {
          account: '/account',
        },
        user: 'basicUsers',
      },
      routes: {
        admin: '/admin',
        api: '/api',
      },
    },
  })

  mockUsePathname.mockReturnValue('/admin')
}

const buildAPIReturn = (data: unknown) => [{ data, isError: false, isLoading: false }, { setParams: vi.fn() }]

describe('AdminAccountAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDefaultMocks()
  })

  it('renders profile image from /me response when available', () => {
    mockUsePayloadAPI.mockImplementation((url: string) => {
      if (url === '/api/basicUsers/me') {
        return buildAPIReturn({
          user: {
            profileImage: {
              url: '/api/userProfileMedia/file/profile.jpg',
            },
          },
        })
      }

      return buildAPIReturn({})
    })

    render(<AdminAccountAvatar />)

    const avatarImage = screen.getByRole('img', { name: 'account avatar' })
    expect(avatarImage).toBeInTheDocument()
    expect(avatarImage).toHaveAttribute('src', '/api/userProfileMedia/file/profile.jpg')
    expect(avatarImage).not.toHaveClass('fmd-admin-account-avatar--active')
  })

  it('fetches media document when relation is id-only and renders the image', () => {
    mockUsePayloadAPI.mockImplementation((url: string) => {
      if (url === '/api/basicUsers/me') {
        return buildAPIReturn({
          user: {
            profileImage: 42,
          },
        })
      }

      if (url === '/api/userProfileMedia/42') {
        return buildAPIReturn({
          url: '/api/userProfileMedia/file/profile-from-media.jpg',
        })
      }

      return buildAPIReturn({})
    })

    render(<AdminAccountAvatar />)

    const avatarImage = screen.getByRole('img', { name: 'account avatar' })
    expect(avatarImage).toHaveAttribute('src', '/api/userProfileMedia/file/profile-from-media.jpg')
  })

  it('renders default account icon when no profile image is configured', () => {
    mockUsePayloadAPI.mockImplementation(() => buildAPIReturn({ user: { profileImage: null } }))

    const { container } = render(<AdminAccountAvatar />)

    expect(screen.queryByRole('img', { name: 'account avatar' })).not.toBeInTheDocument()
    const fallbackIcon = container.querySelector('svg.graphic-account')
    expect(fallbackIcon).toBeInTheDocument()
  })

  it('applies active state style when current route is account view', () => {
    mockUsePathname.mockReturnValue('/admin/account')
    mockUsePayloadAPI.mockImplementation(() =>
      buildAPIReturn({
        user: {
          profileImage: {
            thumbnailURL: '/api/userProfileMedia/file/profile-thumb.jpg',
          },
        },
      }),
    )

    render(<AdminAccountAvatar />)

    const avatarImage = screen.getByRole('img', { name: 'account avatar' })
    expect(avatarImage).toHaveClass('fmd-admin-account-avatar--active')
  })
})
