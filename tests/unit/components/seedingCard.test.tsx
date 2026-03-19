// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SeedRunSummary } from '@/components/organisms/DeveloperDashboard/Seeding/SeedingCardView'

const { toastSuccess, toastError, openModal } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  openModal: vi.fn(),
}))

const originalFetch = global.fetch

let lastSeedingCardViewProps: Record<string, unknown> | null = null

const createJsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

const flushMicrotasks = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

const createSeedSnapshot = (args: { status: SeedRunSummary['status']; activeJob?: boolean }): SeedRunSummary => {
  const now = '2026-03-19T09:00:00.000Z'
  const jobStatus = args.status === 'running' ? 'running' : args.status === 'completed' ? 'succeeded' : 'queued'

  return {
    runId: 'run-1',
    type: 'baseline',
    reset: false,
    queue: 'seed:run-1',
    title: 'Baseline seed',
    status: args.status,
    createdAt: now,
    startedAt: now,
    completedAt: args.status === 'completed' ? '2026-03-19T09:00:05.000Z' : undefined,
    totalJobs: 1,
    completedJobs: args.status === 'completed' ? 1 : 0,
    succeededJobs: args.status === 'completed' ? 1 : 0,
    failedJobs: 0,
    cancelledJobs: 0,
    activeJobId: args.activeJob ? 'job-1' : undefined,
    activeStepName: args.activeJob ? 'globals' : undefined,
    jobs: [
      {
        id: 'job-1',
        order: 1,
        status: jobStatus,
        input: {} as SeedRunSummary['jobs'][number]['input'],
        queue: 'seed:run-1',
        title: 'Globals',
        stepName: 'globals',
        kind: 'globals',
        createdAt: now,
        startedAt: args.activeJob || args.status === 'completed' ? now : undefined,
        completedAt: args.status === 'completed' ? '2026-03-19T09:00:05.000Z' : undefined,
        created: args.status === 'completed' ? 2 : 0,
        updated: args.status === 'completed' ? 1 : 0,
        warnings: [],
        failures: [],
      },
    ] as SeedRunSummary['jobs'],
    logs: [],
    warnings: [],
    failures: [],
    totals: {
      created: args.status === 'completed' ? 2 : 0,
      updated: args.status === 'completed' ? 1 : 0,
    },
    progress: {
      completed: args.status === 'completed' ? 1 : 0,
      total: 1,
      percent: args.status === 'completed' ? 100 : 0,
    },
    jobIds: ['job-1'],
    hasActiveJob: Boolean(args.activeJob),
  }
}

vi.mock('@payloadcms/ui', () => ({
  ConfirmationModal: ({ modalSlug }: { modalSlug: string }) => <div data-testid={`confirmation-${modalSlug}`} />,
  toast: {
    success: toastSuccess,
    error: toastError,
  },
  useAuth: () => ({
    user: { userType: 'platform' },
  }),
  useModal: () => ({
    openModal,
  }),
}))

vi.mock('@/components/organisms/DeveloperDashboard/Seeding/SeedingCardView', async () => {
  return {
    normalizeSeedingWidgetControls: () => ({
      maxLines: 500,
      showUnits: true,
      wrapLines: false,
    }),
    modeFromRuntimeEnv: ({ nodeEnv }: { nodeEnv?: string }) => {
      if (nodeEnv === 'production') return 'production'
      if (nodeEnv === 'test') return 'test'
      return 'development'
    },
    SeedingCardView: (props: Record<string, unknown>) => {
      lastSeedingCardViewProps = props
      const status =
        typeof props.run === 'object' && props.run !== null && 'status' in props.run
          ? String((props.run as { status?: unknown }).status ?? 'none')
          : 'none'

      return <div data-testid="seed-view">{status}</div>
    },
  }
})

import { SeedingCard } from '@/components/organisms/DeveloperDashboard/Seeding/SeedingCard'

describe('SeedingCard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    window.localStorage.clear()
    global.fetch = vi.fn()
    lastSeedingCardViewProps = null
  })

  afterEach(() => {
    vi.useRealTimers()
    global.fetch = originalFetch
  })

  it('shows running state while the current chunk is still advancing', async () => {
    const queuedSnapshot = createSeedSnapshot({ status: 'queued' })
    const runningSnapshot = createSeedSnapshot({ status: 'running', activeJob: true })
    const completedSnapshot = createSeedSnapshot({ status: 'completed' })
    const advanceDeferred = createDeferred<Response>()
    let advanceInFlight = false

    const fetchMock = vi.mocked(global.fetch)
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()

      if (url === '/api/seed?runId=run-1' && method === 'GET') {
        return createJsonResponse(advanceInFlight ? runningSnapshot : queuedSnapshot)
      }

      if (url === '/api/seed/advance?runId=run-1' && method === 'GET') {
        advanceInFlight = true
        return advanceDeferred.promise
      }

      throw new Error(`Unexpected request: ${method} ${url}`)
    })

    window.localStorage.setItem('developer-dashboard:seed-run-id', 'run-1')

    render(<SeedingCard forcedUserType="platform" />)

    await flushMicrotasks()
    expect(screen.getByTestId('seed-view')).toHaveTextContent('queued')
    expect(lastSeedingCardViewProps).not.toBeNull()
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/seed/advance?runId=run-1')).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    await flushMicrotasks()
    expect(screen.getByTestId('seed-view')).toHaveTextContent('running')

    await act(async () => {
      advanceInFlight = false
      advanceDeferred.resolve(createJsonResponse(completedSnapshot))
    })

    await flushMicrotasks()
    expect(screen.getByTestId('seed-view')).toHaveTextContent('completed')
  })

  it('does not restore a finished run after reload', async () => {
    const completedSnapshot = createSeedSnapshot({ status: 'completed' })

    const fetchMock = vi.mocked(global.fetch)
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()

      if (url === '/api/seed?runId=run-1' && method === 'GET') {
        return createJsonResponse(completedSnapshot)
      }

      throw new Error(`Unexpected request: ${method} ${url}`)
    })

    window.localStorage.setItem('developer-dashboard:seed-run-id', 'run-1')

    const { unmount } = render(<SeedingCard forcedUserType="platform" />)

    await flushMicrotasks()
    expect(screen.getByTestId('seed-view')).toHaveTextContent('none')
    expect(window.localStorage.getItem('developer-dashboard:seed-run-id')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    unmount()
    fetchMock.mockClear()

    render(<SeedingCard forcedUserType="platform" />)

    await flushMicrotasks()
    expect(screen.getByTestId('seed-view')).toHaveTextContent('none')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
