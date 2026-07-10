// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CacheRevalidationVisibilitySnapshot } from '@/utilities/cacheRevalidation/visibility'

type MockPayloadButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  icon?: React.ReactNode
  tooltip?: string
}

vi.mock('@payloadcms/ui/elements/Button', () => ({
  Button: ({
    children,
    icon,
    tooltip,
    buttonStyle: _buttonStyle,
    margin: _margin,
    size: _size,
    ...buttonProps
  }: MockPayloadButtonProps & {
    buttonStyle?: string
    margin?: boolean
    size?: string
  }) => (
    <button title={tooltip} {...buttonProps}>
      {icon}
      {children}
    </button>
  ),
}))

import { CacheRevalidationVisibilityCard } from '@/components/organisms/CacheRevalidationVisibility'
import { CacheRevalidationVisibilityCardView } from '@/components/organisms/CacheRevalidationVisibility/CacheRevalidationVisibilityCardView'

const originalFetch = global.fetch

const createJsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })

const createSnapshot = (
  overrides: Partial<CacheRevalidationVisibilitySnapshot> = {},
): CacheRevalidationVisibilitySnapshot => ({
  limit: overrides.limit ?? 200,
  count: overrides.count ?? 1,
  totalRecorded: overrides.totalRecorded ?? 1,
  droppedOldestCount: overrides.droppedOldestCount ?? 0,
  events: overrides.events ?? [
    {
      id: 'event-1',
      timestamp: '2026-07-08T10:00:00.000Z',
      event: 'cache.revalidation.failed',
      operation: 'update',
      source: { kind: 'payload-hook', id: 'posts:123' },
      subject: { kind: 'collection', id: '123', collection: 'posts' },
      cacheClasses: ['aggregated-public'],
      surfaceIds: ['posts-list'],
      tagCount: 2,
      pathCount: 1,
      failureCount: 1,
      tagsPreview: ['collection:posts', 'surface:posts-list'],
      pathsPreview: ['/posts'],
      failuresPreview: [{ kind: 'tag', identifier: 'collection:posts', message: 'redacted' }],
      tagsTruncated: false,
      pathsTruncated: false,
      failuresTruncated: false,
    },
  ],
})

describe('CacheRevalidationVisibilityCardView', () => {
  it('renders empty, denied, loading, and error states without cache action controls', () => {
    const onRefresh = vi.fn()

    const { rerender } = render(
      <CacheRevalidationVisibilityCardView
        accessDenied={false}
        error={null}
        loading={true}
        snapshot={null}
        onRefresh={onRefresh}
      />,
    )
    expect(screen.getByText('Loading recent cache events.')).toBeInTheDocument()

    rerender(
      <CacheRevalidationVisibilityCardView
        accessDenied
        error={null}
        loading={false}
        snapshot={null}
        onRefresh={onRefresh}
      />,
    )
    expect(screen.getByText('Access denied.')).toBeInTheDocument()

    rerender(
      <CacheRevalidationVisibilityCardView
        accessDenied={false}
        error="Unexpected response"
        loading={false}
        snapshot={null}
        onRefresh={onRefresh}
      />,
    )
    expect(screen.getByText('Error: Unexpected response')).toBeInTheDocument()

    rerender(
      <CacheRevalidationVisibilityCardView
        accessDenied={false}
        error={null}
        loading={false}
        snapshot={createSnapshot({ count: 0, totalRecorded: 0, events: [] })}
        onRefresh={onRefresh}
      />,
    )
    expect(screen.getByText('No cache revalidation events recorded yet.')).toBeInTheDocument()
    expect(screen.getByText('No cache revalidation events recorded yet.').parentElement).toHaveAttribute(
      'aria-live',
      'polite',
    )
    expect(screen.queryByRole('button', { name: /revalidate/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /flush/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /purge/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
  })

  it('renders redacted success and failure summaries and supports manual refresh', () => {
    const onRefresh = vi.fn()
    render(
      <CacheRevalidationVisibilityCardView
        accessDenied={false}
        error={null}
        loading={false}
        snapshot={createSnapshot()}
        onRefresh={onRefresh}
      />,
    )

    expect(screen.getByText('Cache revalidation visibility')).toBeInTheDocument()
    expect(screen.getByText('cache.revalidation.failed')).toBeInTheDocument()
    expect(screen.getByText(/Operation:/)).toHaveTextContent('update')
    expect(screen.getByText(/Failures:/)).toHaveTextContent('1')
    expect(screen.getByText(/Surfaces:/)).toHaveTextContent('posts-list')
    expect(screen.getByText(/Failure preview:/)).toHaveTextContent('tag:collection:posts')
    expect(screen.queryByText(/raw backend stack/i)).not.toBeInTheDocument()

    const refreshButton = screen.getByRole('button', { name: 'Refresh cache revalidation visibility' })
    expect(refreshButton).toHaveClass('cache-visibility-touch-action')

    fireEvent.click(refreshButton)
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('keeps event history outside the live region and wraps long source subjects', () => {
    render(
      <CacheRevalidationVisibilityCardView
        accessDenied={false}
        error={null}
        loading={false}
        snapshot={createSnapshot({
          events: [
            {
              ...createSnapshot().events[0]!,
              source: {
                kind: 'payload-hook',
                id: 'source-with-a-very-long-unbroken-identifier-that-must-wrap-on-mobile-viewports',
              },
              subject: {
                kind: 'collection',
                collection: 'posts',
                id: 'subject-with-a-very-long-unbroken-identifier-that-must-wrap-on-mobile-viewports',
              },
            },
          ],
        })}
        onRefresh={vi.fn()}
      />,
    )

    const eventName = screen.getByText('cache.revalidation.failed')
    const operationLine = screen.getByText(/Operation:/)

    expect(eventName.closest('[aria-live]')).toBeNull()
    expect(operationLine).toHaveStyle({ overflowWrap: 'anywhere' })
  })
})

describe('CacheRevalidationVisibilityCard', () => {
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('loads the protected endpoint and refreshes on demand', async () => {
    const fetchMock = vi.fn(async () => createJsonResponse(createSnapshot({ count: 0, events: [] })))
    global.fetch = fetchMock

    render(<CacheRevalidationVisibilityCard />)

    expect(await screen.findByText('No cache revalidation events recorded yet.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/cache-revalidation/visibility', { credentials: 'include' })

    fireEvent.click(screen.getByRole('button', { name: 'Refresh cache revalidation visibility' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('shows denied state without exposing event data', async () => {
    global.fetch = vi.fn(async () => createJsonResponse({ error: 'Access denied' }, 403))

    render(<CacheRevalidationVisibilityCard />)

    expect(await screen.findByText('Access denied.')).toBeInTheDocument()
    expect(screen.queryByText('cache.revalidation.failed')).not.toBeInTheDocument()
  })
})
