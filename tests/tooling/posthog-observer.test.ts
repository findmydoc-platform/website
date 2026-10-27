import { gzipSync } from 'node:zlib'
import { describe, expect, it, vi } from 'vitest'
import { createPostHogObserver, decodeCaptureRequest } from '../../scripts/testing/posthog-observer'

const target = {
  event: 'clinic_profile_viewed',
  properties: { clinic_id: '42', $session_id: 'private-session', email: 'private@example.test' },
}

describe('passive PostHog transport evidence', () => {
  it.each(['/e/', '/i/v0/e/'])('recognizes JSON batches on %s without exporting properties', (pathname) => {
    const result = decodeCaptureRequest(
      {
        url: `https://analytics.example.test${pathname}`,
        method: 'POST',
        body: JSON.stringify([{ event: '$pageview' }, target]),
      },
      '42',
    )
    expect(result).toMatchObject({
      captureRequest: true,
      decoded: true,
      reason: 'decoded',
      eventNames: ['clinic_profile_viewed'],
      targetCount: 1,
    })
    expect(JSON.stringify(result)).not.toMatch(/private-session|email|42/)
  })
  it('decodes installed SDK gzip and base64 form bodies', () => {
    const json = JSON.stringify([target])
    for (const body of [gzipSync(json), `data=${encodeURIComponent(Buffer.from(json).toString('base64'))}`]) {
      expect(
        decodeCaptureRequest({ url: 'https://analytics.example.test/i/v0/e/', method: 'POST', body }, '42').targetCount,
      ).toBe(1)
    }
  })
})

const event = (sequence: number, method: string, params: Record<string, unknown>) => ({
  sequence,
  method,
  params,
  source: {},
})

describe('CDP observation continuity', () => {
  it('starts NOW once, then drains explicit cursors, joins transport and verifies a non-business probe', async () => {
    const readEvents = vi
      .fn()
      .mockResolvedValueOnce({ cursor: 10, events: [], hasMore: false, truncated: false })
      .mockResolvedValueOnce({
        cursor: 12,
        events: [
          event(11, 'Network.requestWillBeSent', {
            requestId: 'private-probe',
            request: { url: 'https://site.example.test/favicon.ico', method: 'GET' },
          }),
          event(12, 'Network.responseReceived', { requestId: 'private-probe', response: { status: 200 } }),
        ],
        hasMore: true,
        truncated: false,
      })
      .mockResolvedValueOnce({
        cursor: 16,
        events: [
          event(13, 'Network.loadingFinished', { requestId: 'private-probe' }),
          event(14, 'Network.requestWillBeSent', {
            requestId: 'private-id',
            request: { url: 'https://analytics.example.test/i/v0/e/', method: 'POST', hasPostData: true },
          }),
          event(15, 'Network.responseReceived', { requestId: 'private-id', response: { status: 200 } }),
          event(16, 'Network.loadingFinished', { requestId: 'private-id' }),
        ],
        hasMore: false,
        truncated: false,
      })
    const send = vi.fn(async (method: string) =>
      method === 'Network.getRequestPostData' ? { postData: JSON.stringify([target]) } : {},
    )
    const observer = await createPostHogObserver(
      { send, readEvents },
      { clinicId: '42', probeUrl: 'https://site.example.test/favicon.ico', deadline: Date.now() + 10000 },
    )
    const result = await observer.drain()
    expect(readEvents.mock.calls.map((call) => call[0].afterSequence)).toEqual([undefined, 10, 12])
    expect(result).toMatchObject({
      complete: true,
      probeProven: true,
      targetSentCount: 1,
      requests: [{ targetCount: 1, status: 200, finished: true, failed: false }],
    })
    expect(JSON.stringify(result)).not.toMatch(/private-session|private-id|example|42/)
  })
  it('processes retained truncated events but invalidates proof, including transport failure', async () => {
    const readEvents = vi
      .fn()
      .mockResolvedValueOnce({ cursor: 0, events: [], hasMore: false, truncated: false })
      .mockResolvedValueOnce({
        cursor: 3,
        events: [
          event(2, 'Network.requestWillBeSent', {
            requestId: 'x',
            request: { url: 'https://analytics.example.test/e/', method: 'POST', postData: JSON.stringify(target) },
          }),
          event(3, 'Network.loadingFailed', { requestId: 'x', errorText: 'private error' }),
        ],
        hasMore: false,
        truncated: true,
      })
    const observer = await createPostHogObserver(
      { send: vi.fn(async () => ({})), readEvents },
      { clinicId: '42', probeUrl: 'https://site.example.test/favicon.ico', deadline: Date.now() + 10000 },
    )
    expect(await observer.drain()).toMatchObject({
      complete: false,
      reasons: ['buffer_truncated'],
      targetSentCount: 0,
      requests: [{ decoded: true, targetCount: 1, failed: true, reason: 'transport_failed' }],
    })
  })
})

describe('measurement refusal boundaries', () => {
  it.each([
    ['GET', '/e/', JSON.stringify(target), 'not_capture'],
    ['POST', '/flags/', JSON.stringify(target), 'not_capture'],
    ['POST', '/e/', undefined, 'body_unavailable'],
    ['POST', '/e/', 'data=broken', 'malformed_body'],
    ['POST', '/e/', '{broken', 'malformed_body'],
  ])('classifies %s %s without exposing payloads', (method, pathname, body, reason) => {
    expect(
      decodeCaptureRequest({ url: `https://analytics.example.test${pathname}`, method: method!, body }, '42'),
    ).toMatchObject({ reason, targetCount: 0 })
  })
  it('does not count unrelated events, another clinic or a numeric clinic ID', () => {
    for (const event of [
      { event: '$pageview', properties: target.properties },
      { ...target, properties: { clinic_id: '43' } },
      { ...target, properties: { clinic_id: 42 } },
    ]) {
      expect(
        decodeCaptureRequest(
          { url: 'https://analytics.example.test/e/', method: 'POST', body: JSON.stringify(event) },
          '42',
        ).targetCount,
      ).toBe(0)
    }
  })
  it('does not turn HTTP 200 or probe traffic into profile evidence; full documents invalidate continuity', async () => {
    const readEvents = vi
      .fn()
      .mockResolvedValueOnce({ cursor: 0, events: [], hasMore: false, truncated: false })
      .mockResolvedValueOnce({
        cursor: 5,
        events: [
          event(1, 'Network.requestWillBeSent', {
            requestId: 'x',
            request: {
              url: 'https://analytics.example.test/e/',
              method: 'POST',
              postData: JSON.stringify({ event: '$pageview' }),
            },
          }),
          event(2, 'Network.responseReceived', { requestId: 'x', response: { status: 200 } }),
          event(3, 'Network.loadingFinished', { requestId: 'x' }),
          event(4, 'Network.responseReceived', { requestId: 'orphan', response: { status: 200 } }),
          event(5, 'Network.requestWillBeSent', {
            requestId: 'document',
            type: 'Document',
            request: { url: 'https://site.example.test/', method: 'GET' },
          }),
        ],
        hasMore: false,
        truncated: false,
      })
    const observer = await createPostHogObserver(
      { send: vi.fn(async () => ({})), readEvents },
      { clinicId: '42', probeUrl: 'https://site.example.test/favicon.ico', deadline: Date.now() + 10000 },
    )
    expect(await observer.drain()).toMatchObject({
      complete: false,
      probeProven: false,
      targetSentCount: 0,
      reasons: ['document_replaced'],
    })
  })
  it('does not issue reads or body requests after the shared deadline', async () => {
    vi.useFakeTimers()
    try {
      const readEvents = vi.fn(async () => ({ cursor: 0, events: [], hasMore: false, truncated: false }))
      const send = vi.fn(async () => ({}))
      const observer = await createPostHogObserver(
        { send, readEvents },
        { clinicId: '42', probeUrl: 'https://site.example.test/favicon.ico', deadline: Date.now() + 100 },
      )
      vi.advanceTimersByTime(101)
      expect(await observer.drain()).toMatchObject({ complete: false, reasons: ['observer_deadline'] })
      expect(readEvents).toHaveBeenCalledTimes(1)
      expect(send).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('CDP body and cursor limits', () => {
  it('decodes Base64 CDP binary entries without retaining bytes or fetching them again', async () => {
    const readEvents = vi
      .fn()
      .mockResolvedValueOnce({ cursor: 0, events: [], hasMore: false, truncated: false })
      .mockResolvedValueOnce({
        cursor: 3,
        events: [
          event(1, 'Network.requestWillBeSent', {
            requestId: 'private-id',
            request: {
              url: 'https://analytics.example.test/e/',
              method: 'POST',
              postDataEntries: [{ bytes: gzipSync(JSON.stringify(target)).toString('base64') }],
            },
          }),
          event(2, 'Network.responseReceived', { requestId: 'private-id', response: { status: 200 } }),
          event(3, 'Network.loadingFinished', { requestId: 'private-id' }),
        ],
        hasMore: false,
        truncated: false,
      })
    const send = vi.fn(async () => ({}))
    const observer = await createPostHogObserver(
      { send, readEvents },
      { clinicId: '42', probeUrl: 'https://site.example.test/favicon.ico', deadline: Date.now() + 10000 },
    )
    expect(await observer.drain()).toMatchObject({ complete: true, targetSentCount: 1 })
    expect(send).toHaveBeenCalledTimes(1)
  })
  it('fails closed when body retrieval fails and a page cursor cannot advance', async () => {
    const readEvents = vi
      .fn()
      .mockResolvedValueOnce({ cursor: 10, events: [], hasMore: false, truncated: false })
      .mockResolvedValueOnce({
        cursor: 10,
        events: [
          event(11, 'Network.requestWillBeSent', {
            requestId: 'private-id',
            request: { url: 'https://analytics.example.test/e/', method: 'POST', hasPostData: true },
          }),
        ],
        hasMore: true,
        truncated: false,
      })
    const send = vi.fn(async (method: string) => {
      if (method === 'Network.getRequestPostData') throw new Error('private protocol payload')
      return {}
    })
    const observer = await createPostHogObserver(
      { send, readEvents },
      { clinicId: '42', probeUrl: 'https://site.example.test/favicon.ico', deadline: Date.now() + 10000 },
    )
    const result = await observer.drain()
    expect(result).toMatchObject({
      complete: false,
      reasons: ['capture_body_unavailable', 'cursor_discontinuity'],
      targetSentCount: 0,
    })
    expect(JSON.stringify(result)).not.toContain('private')
    expect(readEvents).toHaveBeenCalledTimes(2)
  })
})

const expectedProfile = {
  clinicSlug: 'synthetic-clinic',
  pagePath: '/clinics/synthetic-clinic',
  projectToken: 'phc_synthetic_project',
}
const correlatedTarget = {
  event: 'clinic_profile_viewed',
  properties: {
    ...target.properties,
    clinic_slug: expectedProfile.clinicSlug,
    page_path: expectedProfile.pagePath,
    token: expectedProfile.projectToken,
  },
}

describe('strict inquiry prerequisite evidence', () => {
  it('requires all profile dimensions and a valid session without returning their values', () => {
    const evidence = decodeCaptureRequest(
      { url: 'https://analytics.example.test/e/', method: 'POST', body: JSON.stringify(correlatedTarget) },
      '42',
      expectedProfile,
    )
    expect(evidence).toMatchObject({
      clinicMatched: true,
      slugMatched: true,
      pathMatched: true,
      projectMatched: true,
      sessionPresent: true,
      sessionValid: true,
      targetCount: 1,
    })
    expect(JSON.stringify(evidence)).not.toMatch(/synthetic|private|phc_|42/)
  })
  it.each([
    ['clinic_id', '43', 'clinicMatched'],
    ['clinic_slug', 'other-clinic', 'slugMatched'],
    ['page_path', '/clinics/other-clinic', 'pathMatched'],
    ['token', 'phc_other_project', 'projectMatched'],
    ['$session_id', undefined, 'sessionPresent'],
    ['$session_id', 'invalid session!', 'sessionValid'],
    ['$session_id', '', 'sessionPresent'],
    ['$session_id', 'a'.repeat(129), 'sessionValid'],
  ])('refuses a mismatching %s without exposing the mismatch', (field, value, flag) => {
    const evidence = decodeCaptureRequest(
      {
        url: 'https://analytics.example.test/i/v0/e/',
        method: 'POST',
        body: JSON.stringify({ ...correlatedTarget, properties: { ...correlatedTarget.properties, [field]: value } }),
      },
      '42',
      expectedProfile,
    )
    expect(evidence.targetCount).toBe(0)
    expect(evidence[flag as keyof typeof evidence]).toBe(false)
    expect(JSON.stringify(evidence)).not.toMatch(/other-clinic|phc_|invalid session|private/)
  })
  it('does not assemble a strict match from different members of a batch', () => {
    const events = [
      { ...correlatedTarget, properties: { ...correlatedTarget.properties, token: 'wrong' } },
      { ...correlatedTarget, properties: { ...correlatedTarget.properties, page_path: '/wrong' } },
    ]
    expect(
      decodeCaptureRequest(
        { url: 'https://analytics.example.test/e/', method: 'POST', body: JSON.stringify(events) },
        '42',
        expectedProfile,
      ).targetCount,
    ).toBe(0)
  })
  it('compares only fully delivered matching sessions internally, then erases them on stop', async () => {
    const readEvents = vi
      .fn()
      .mockResolvedValueOnce({ cursor: 0, events: [], hasMore: false, truncated: false })
      .mockResolvedValueOnce({
        cursor: 2,
        events: [
          event(1, 'Network.requestWillBeSent', {
            requestId: 'private-id',
            request: {
              url: 'https://analytics.example.test/e/',
              method: 'POST',
              postData: JSON.stringify(correlatedTarget),
            },
          }),
          event(2, 'Network.responseReceived', { requestId: 'private-id', response: { status: 200 } }),
        ],
        hasMore: false,
        truncated: false,
      })
      .mockResolvedValueOnce({
        cursor: 3,
        events: [event(3, 'Network.loadingFinished', { requestId: 'private-id' })],
        hasMore: false,
        truncated: false,
      })
    const observer = await createPostHogObserver(
      { send: vi.fn(async () => ({})), readEvents },
      {
        clinicId: '42',
        expected: expectedProfile,
        probeUrl: 'https://site.example.test/favicon.ico',
        deadline: Date.now() + 10000,
      },
    )
    expect(await observer.drain()).toMatchObject({ strictTargetConfigured: true, targetSentCount: 0 })
    expect(observer.matchesDeliveredSession('private-session')).toBe(false)
    const result = await observer.drain()
    expect(result.targetSentCount).toBe(1)
    expect(observer.matchesDeliveredSession('private-session')).toBe(true)
    expect(observer.matchesDeliveredSession('different-session')).toBe(false)
    expect(observer.matchesDeliveredSession(undefined)).toBe(false)
    expect(JSON.stringify(result)).not.toMatch(/private|synthetic|phc_/)
    observer.stop()
    expect(observer.matchesDeliveredSession('private-session')).toBe(false)
  })
})

describe('strict configuration and failed delivery', () => {
  it('refuses an incomplete strict expectation instead of treating missing values as matches', () => {
    expect(
      decodeCaptureRequest(
        { url: 'https://analytics.example.test/e/', method: 'POST', body: JSON.stringify(correlatedTarget) },
        '42',
        { ...expectedProfile, projectToken: '' },
      ),
    ).toMatchObject({ projectMatched: false, targetCount: 0 })
  })
  it.each([
    ['http_failure', 503, false],
    ['truncated', 200, true],
  ] as const)('does not correlate a session after %s', async (_reason, status, truncated) => {
    const readEvents = vi
      .fn()
      .mockResolvedValueOnce({ cursor: 0, events: [], hasMore: false, truncated: false })
      .mockResolvedValueOnce({
        cursor: 3,
        events: [
          event(1, 'Network.requestWillBeSent', {
            requestId: 'private-id',
            request: {
              url: 'https://analytics.example.test/e/',
              method: 'POST',
              postData: JSON.stringify(correlatedTarget),
            },
          }),
          event(2, 'Network.responseReceived', { requestId: 'private-id', response: { status } }),
          event(3, 'Network.loadingFinished', { requestId: 'private-id' }),
        ],
        hasMore: false,
        truncated,
      })
    const observer = await createPostHogObserver(
      { send: vi.fn(async () => ({})), readEvents },
      {
        clinicId: '42',
        expected: expectedProfile,
        probeUrl: 'https://site.example.test/favicon.ico',
        deadline: Date.now() + 10000,
      },
    )
    await observer.drain()
    expect(observer.matchesDeliveredSession('private-session')).toBe(false)
  })
})
