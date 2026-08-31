// @vitest-environment jsdom
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useSelectedLayoutSegments: () => [],
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
  }),
}))

vi.mock('payload-admin-bar', () => ({
  PayloadAdminBar: ({
    onAuthChange,
    onPreviewExit,
  }: {
    onAuthChange?: (user: { id: string } | null) => void
    onPreviewExit?: () => void | Promise<void>
  }) => {
    React.useEffect(() => {
      onAuthChange?.({ id: 'user-1' })
    }, [onAuthChange])

    return (
      <button type="button" onClick={() => void onPreviewExit?.()}>
        Exit preview
      </button>
    )
  },
}))

import { AdminBarClientAdapter } from '@/app/(frontend)/AdminBarClientAdapter.client'

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
  vi.clearAllMocks()
})

describe('AdminBarClientAdapter', () => {
  it('exits preview through the route endpoint before returning home', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    global.fetch = fetchMock

    render(<AdminBarClientAdapter preview />)

    fireEvent.click(await screen.findByRole('button', { name: 'Exit preview' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/next/exit-preview')
      expect(mocks.push).toHaveBeenCalledWith('/')
      expect(mocks.refresh).toHaveBeenCalledTimes(1)
    })
  })
})
