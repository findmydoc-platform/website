import { gzipSync } from 'node:zlib'
import { describe, expect, it, vi } from 'vitest'
import { createPostHogObserver, decodeCaptureRequest, type ObserverCDP } from '../../scripts/testing/posthog-observer'

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
  source: { sessionId: 'private-source' },
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
      const send = vi.fn(async (_method: string) => ({}))
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
    const send = vi.fn(async (_method: string) => ({}))
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
    expect(observer.snapshot()).toMatchObject({ complete: false, targetSentCount: 0, requests: [] })
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

const navigation = {
  frameId: 'private-top-frame',
  loaderId: 'private-old-loader',
  documentUrl: 'https://site.example.test/clinics/synthetic-clinic',
  postNavigationProbeUrl: 'https://site.example.test/favicon.ico?after=synthetic',
}
const rootSource = { sessionId: 'private-root-source', targetId: 'private-root-target', tabId: 7 }
const documentPacket = (sequence: number, method: string, params: Record<string, unknown>) => ({
  ...event(sequence, method, params),
  source: rootSource,
})
const preNavigationPackets = [
  documentPacket(1, 'Network.requestWillBeSent', {
    requestId: 'private-pre-probe',
    frameId: navigation.frameId,
    loaderId: navigation.loaderId,
    request: { url: 'https://site.example.test/favicon.ico', method: 'GET' },
  }),
  documentPacket(2, 'Network.responseReceived', { requestId: 'private-pre-probe', response: { status: 200 } }),
  documentPacket(3, 'Network.loadingFinished', { requestId: 'private-pre-probe' }),
]
const navigationPackets = [
  documentPacket(4, 'Network.requestWillBeSent', {
    requestId: 'private-document',
    type: 'Document',
    frameId: navigation.frameId,
    loaderId: 'private-new-loader',
    request: { url: navigation.documentUrl, method: 'GET' },
  }),
  documentPacket(5, 'Network.responseReceived', { requestId: 'private-document', response: { status: 200 } }),
  documentPacket(6, 'Network.loadingFinished', { requestId: 'private-document' }),
  documentPacket(7, 'Network.requestWillBeSent', {
    requestId: 'private-capture',
    frameId: navigation.frameId,
    loaderId: 'private-new-loader',
    request: { url: 'https://analytics.example.test/e/', method: 'POST', postData: JSON.stringify(correlatedTarget) },
  }),
  documentPacket(8, 'Network.responseReceived', { requestId: 'private-capture', response: { status: 200 } }),
  documentPacket(9, 'Network.loadingFinished', { requestId: 'private-capture' }),
]
const postNavigationPackets = [
  documentPacket(10, 'Network.requestWillBeSent', {
    requestId: 'private-post-probe',
    frameId: navigation.frameId,
    loaderId: 'private-new-loader',
    request: { url: navigation.postNavigationProbeUrl, method: 'GET' },
  }),
  documentPacket(11, 'Network.responseReceived', { requestId: 'private-post-probe', response: { status: 200 } }),
  documentPacket(12, 'Network.loadingFinished', { requestId: 'private-post-probe' }),
]
const packetPage = (
  cursor: number,
  events: Awaited<ReturnType<ObserverCDP['readEvents']>>['events'],
  truncated = false,
) => ({
  cursor,
  events,
  truncated,
  hasMore: false,
})

describe('opt-in same-origin document continuity', () => {
  it('retains a strict capture until the new document and its separate probe prove continuity without reenabling Network', async () => {
    const readEvents = vi
      .fn()
      .mockResolvedValueOnce(packetPage(0, []))
      .mockResolvedValueOnce(packetPage(3, preNavigationPackets))
      .mockResolvedValueOnce(packetPage(9, navigationPackets))
      .mockResolvedValueOnce(packetPage(12, postNavigationPackets))
    const send = vi.fn(async (_method: string) => ({}))
    const observer = await createPostHogObserver(
      { send, readEvents },
      {
        clinicId: '42',
        expected: expectedProfile,
        probeUrl: 'https://site.example.test/favicon.ico',
        deadline: Date.now() + 10000,
        documentNavigation: navigation,
      },
    )
    expect(await observer.drain()).toMatchObject({ complete: true, probeProven: true, targetSentCount: 0 })
    expect(await observer.drain()).toMatchObject({
      complete: true,
      targetSentCount: 0,
      documentNavigation: { documentSeen: true, documentStatus: 200, documentFinished: true, proven: false },
    })
    expect(observer.matchesDeliveredSession('private-session')).toBe(false)
    const result = await observer.drain()
    expect(result).toMatchObject({
      complete: true,
      targetSentCount: 1,
      documentNavigation: {
        proven: true,
        postProbeSeen: true,
        postProbeStatus: 200,
        postProbeFinished: true,
        sameTopFrame: true,
        newLoader: true,
        sameSource: true,
        postProbeSameTopFrame: true,
        postProbeSameLoader: true,
        postProbeSameSource: true,
      },
    })
    expect(observer.matchesDeliveredSession('private-session')).toBe(true)
    expect(readEvents.mock.calls.map((call) => call[0].afterSequence)).toEqual([undefined, 0, 3, 9])
    expect(send).toHaveBeenCalledExactlyOnceWith('Network.enable', {}, expect.anything())
    expect(JSON.stringify(result)).not.toMatch(/private|example|synthetic|phc_/)
  })
})

describe('document continuity refusal boundaries', () => {
  it.each([
    'unexpected_document',
    'redirect',
    'old_loader',
    'missing_loader',
    'wrong_top_frame',
    'changed_source',
    'missing_document_source',
    'missing_post_probe_source',
    'missing_capture_source',
    'missing_initial_source',
    'post_probe_wrong_frame',
    'post_probe_wrong_loader',
    'post_probe_changed_source',
    'post_probe_failure',
    'document_failure',
    'document_unfinished',
    'post_probe_unfinished',
    'detached',
    'truncated',
    'body_loss',
    'capture_wrong_loader',
    'capture_missing_loader',
    'capture_changed_source',
    'second_document',
    'missing_initial_probe',
  ])('does not release retained capture or session after %s', async (failure) => {
    let documents = structuredClone(navigationPackets)
    let probes = structuredClone(postNavigationPackets)
    const initialProbes = structuredClone(preNavigationPackets)
    if (failure === 'unexpected_document')
      documents[0]!.params.request = { url: 'https://site.example.test/other', method: 'GET' }
    if (failure === 'redirect') documents[0]!.params.redirectResponse = { status: 302 }
    if (failure === 'old_loader') documents[0]!.params.loaderId = navigation.loaderId
    if (failure === 'missing_loader') delete documents[0]!.params.loaderId
    if (failure === 'wrong_top_frame') documents[0]!.params.frameId = 'private-subframe'
    if (failure === 'changed_source') documents[0]!.source.sessionId = 'private-other-source'
    if (failure === 'missing_document_source') Object.assign(documents[0]!, { source: {} })
    if (failure === 'missing_post_probe_source') Object.assign(probes[0]!, { source: {} })
    if (failure === 'missing_capture_source') Object.assign(documents[3]!, { source: {} })
    if (failure === 'missing_initial_source') Object.assign(initialProbes[0]!, { source: {} })
    if (failure === 'post_probe_wrong_frame') probes[0]!.params.frameId = 'private-subframe'
    if (failure === 'post_probe_wrong_loader') probes[0]!.params.loaderId = navigation.loaderId
    if (failure === 'post_probe_changed_source') probes[0]!.source.sessionId = 'private-other-source'
    if (failure === 'post_probe_failure') probes[1]!.params.response = { status: 503 }
    if (failure === 'document_failure') documents[1]!.params.response = { status: 302 }
    if (failure === 'document_unfinished') documents = documents.filter((packet) => packet.sequence !== 6)
    if (failure === 'post_probe_unfinished') probes = probes.filter((packet) => packet.sequence !== 12)
    if (failure === 'detached') probes.push(documentPacket(13, 'Inspector.detached', {}))
    if (failure === 'body_loss')
      documents[3]!.params.request = { url: 'https://analytics.example.test/e/', method: 'POST', hasPostData: true }
    if (failure === 'capture_wrong_loader') documents[3]!.params.loaderId = navigation.loaderId
    if (failure === 'capture_missing_loader') delete documents[3]!.params.loaderId
    if (failure === 'capture_changed_source') documents[3]!.source.sessionId = 'private-other-source'
    if (failure === 'second_document')
      probes.push(
        documentPacket(13, 'Network.requestWillBeSent', {
          requestId: 'private-next-document',
          type: 'Document',
          frameId: navigation.frameId,
          loaderId: 'private-third-loader',
          request: { url: navigation.documentUrl, method: 'GET' },
        }),
      )
    const readEvents = vi
      .fn()
      .mockResolvedValueOnce(packetPage(0, []))
      .mockResolvedValueOnce(packetPage(3, failure === 'missing_initial_probe' ? [] : initialProbes))
      .mockResolvedValueOnce(packetPage(9, documents))
      .mockResolvedValueOnce(packetPage(13, probes, failure === 'truncated'))
    const send = vi.fn(async (_method: string) => ({}))
    const observer = await createPostHogObserver(
      { send, readEvents },
      {
        clinicId: '42',
        expected: expectedProfile,
        probeUrl: 'https://site.example.test/favicon.ico',
        deadline: Date.now() + 10000,
        documentNavigation: navigation,
      },
    )
    await observer.drain()
    await observer.drain()
    const result = await observer.drain()
    expect(result).toMatchObject({ targetSentCount: 0, documentNavigation: { proven: false } })
    expect(observer.matchesDeliveredSession('private-session')).toBe(false)
    expect(JSON.stringify(result)).not.toMatch(/private|example|synthetic|phc_/)
    expect(send.mock.calls.filter((call) => call[0] === 'Network.enable')).toHaveLength(1)
  })
  it.each([
    { ...navigation, documentUrl: 'https://other.example.test/clinics/synthetic-clinic' },
    { ...navigation, postNavigationProbeUrl: 'https://other.example.test/favicon.ico' },
    { ...navigation, postNavigationProbeUrl: 'https://site.example.test/favicon.ico' },
    { ...navigation, frameId: '' },
    { ...navigation, loaderId: '' },
  ])('rejects an unsupported navigation configuration before enabling Network', async (documentNavigation) => {
    const send = vi.fn(async (_method: string) => ({}))
    await expect(
      createPostHogObserver(
        { send, readEvents: vi.fn() },
        {
          clinicId: '42',
          expected: expectedProfile,
          probeUrl: 'https://site.example.test/favicon.ico',
          deadline: Date.now() + 10000,
          documentNavigation,
        },
      ),
    ).rejects.toThrow('invalid_document_navigation')
    expect(send).not.toHaveBeenCalled()
  })
})

describe('CDP binary body precedence', () => {
  it.each([false, true])(
    'uses complete raw gzip entries over lossy text while preserving truncated=%s',
    async (truncated) => {
      const readEvents = vi
        .fn()
        .mockResolvedValueOnce(packetPage(0, []))
        .mockResolvedValueOnce(
          packetPage(
            3,
            [
              documentPacket(1, 'Network.requestWillBeSent', {
                requestId: 'private-binary',
                request: {
                  url: 'https://analytics.example.test/e/',
                  method: 'POST',
                  postData: '\ufffdlossy gzip text',
                  postDataEntries: [{ bytes: gzipSync(JSON.stringify(correlatedTarget)).toString('base64') }],
                },
              }),
              documentPacket(2, 'Network.responseReceived', { requestId: 'private-binary', response: { status: 200 } }),
              documentPacket(3, 'Network.loadingFinished', { requestId: 'private-binary' }),
            ],
            truncated,
          ),
        )
      const send = vi.fn(async (_method: string) => ({}))
      const observer = await createPostHogObserver(
        { send, readEvents },
        {
          clinicId: '42',
          expected: expectedProfile,
          probeUrl: 'https://site.example.test/favicon.ico',
          deadline: Date.now() + 10000,
        },
      )
      const result = await observer.drain()
      expect(result).toMatchObject({
        complete: !truncated,
        targetSentCount: 1,
        requests: [{ decoded: true, targetCount: 1 }],
      })
      expect(observer.matchesDeliveredSession('private-session')).toBe(!truncated)
      if (truncated) expect(result.reasons).toContain('buffer_truncated')
      expect(send).toHaveBeenCalledExactlyOnceWith('Network.enable', {}, expect.anything())
      expect(JSON.stringify(result)).not.toMatch(/lossy|private|synthetic|phc_/)
    },
  )
})

describe('observed SDK batch envelopes', () => {
  it.each([false, true])(
    'decodes batch envelopes with gzip=%s while preserving event-local project checks',
    (compressed) => {
      const json = JSON.stringify({
        api_key: expectedProfile.projectToken,
        batch: [{ event: '$pageview', properties: { token: expectedProfile.projectToken } }, correlatedTarget],
      })
      const evidence = decodeCaptureRequest(
        { url: 'https://analytics.example.test/i/v0/e/', method: 'POST', body: compressed ? gzipSync(json) : json },
        '42',
        expectedProfile,
      )
      expect(evidence).toMatchObject({
        decoded: true,
        reason: 'decoded',
        targetCount: 1,
        projectMatched: true,
        eventNames: ['clinic_profile_viewed'],
      })
      expect(JSON.stringify(evidence)).not.toMatch(/api_key|private|synthetic|phc_/)
    },
  )
  it('accepts a readable unrelated SDK batch as non-business traffic without inventing a target event', () => {
    const evidence = decodeCaptureRequest(
      {
        url: 'https://analytics.example.test/e/',
        method: 'POST',
        body: gzipSync(
          JSON.stringify({
            api_key: expectedProfile.projectToken,
            batch: [{ event: '$pageview', properties: { token: expectedProfile.projectToken } }],
          }),
        ),
      },
      '42',
      expectedProfile,
    )
    expect(evidence).toMatchObject({ decoded: true, targetCount: 0, eventNames: [] })
  })
  it.each([null, [], {}, 'not-an-array', [{}], [{ event: 3 }], [correlatedTarget, null]])(
    'rejects invalid batch envelopes',
    (batch) => {
      expect(
        decodeCaptureRequest(
          {
            url: 'https://analytics.example.test/e/',
            method: 'POST',
            body: gzipSync(JSON.stringify({ api_key: expectedProfile.projectToken, batch })),
          },
          '42',
          expectedProfile,
        ),
      ).toMatchObject({ decoded: false, reason: 'malformed_body', targetCount: 0 })
    },
  )
  it('does not inherit an envelope project key into an event missing its own token', () => {
    const properties = { ...correlatedTarget.properties, token: undefined }
    expect(
      decodeCaptureRequest(
        {
          url: 'https://analytics.example.test/e/',
          method: 'POST',
          body: JSON.stringify({ api_key: expectedProfile.projectToken, batch: [{ ...correlatedTarget, properties }] }),
        },
        '42',
        expectedProfile,
      ),
    ).toMatchObject({ decoded: true, projectMatched: false, targetCount: 0 })
  })
  it('refuses conflicting envelope and event project keys in strict mode', () => {
    expect(
      decodeCaptureRequest(
        {
          url: 'https://analytics.example.test/e/',
          method: 'POST',
          body: JSON.stringify({ api_key: 'phc_other_project', batch: [correlatedTarget] }),
        },
        '42',
        expectedProfile,
      ),
    ).toMatchObject({ decoded: true, projectMatched: false, targetCount: 0 })
  })
})

describe('batch envelope transport boundary', () => {
  it('releases the observed gzip envelope only after strict document and probe proof', async () => {
    const documents = structuredClone(navigationPackets)
    documents[3]!.params.request = {
      url: 'https://analytics.example.test/i/v0/e/',
      method: 'POST',
      postDataEntries: [
        {
          bytes: gzipSync(
            JSON.stringify({ api_key: expectedProfile.projectToken, batch: [correlatedTarget] }),
          ).toString('base64'),
        },
      ],
    }
    const readEvents = vi
      .fn()
      .mockResolvedValueOnce(packetPage(0, []))
      .mockResolvedValueOnce(packetPage(3, preNavigationPackets))
      .mockResolvedValueOnce(packetPage(9, documents))
      .mockResolvedValueOnce(packetPage(12, postNavigationPackets))
    const send = vi.fn(async (_method: string) => ({}))
    const observer = await createPostHogObserver(
      { send, readEvents },
      {
        clinicId: '42',
        expected: expectedProfile,
        probeUrl: 'https://site.example.test/favicon.ico',
        deadline: Date.now() + 10000,
        documentNavigation: navigation,
      },
    )
    await observer.drain()
    expect((await observer.drain()).targetSentCount).toBe(0)
    const result = await observer.drain()
    expect(result).toMatchObject({
      complete: true,
      targetSentCount: 1,
      documentNavigation: { proven: true },
      requests: [{ decoded: true, projectMatched: true, sessionValid: true }],
    })
    expect(observer.matchesDeliveredSession('private-session')).toBe(true)
    expect(JSON.stringify(result)).not.toMatch(/api_key|private|synthetic|phc_/)
    expect(send).toHaveBeenCalledExactlyOnceWith('Network.enable', {}, expect.anything())
  })
  it('rejects an ambiguous envelope with both a top-level event and batch', () => {
    expect(
      decodeCaptureRequest(
        {
          url: 'https://analytics.example.test/e/',
          method: 'POST',
          body: JSON.stringify({ event: 'clinic_profile_viewed', batch: [correlatedTarget] }),
        },
        '42',
        expectedProfile,
      ),
    ).toMatchObject({ decoded: false, reason: 'malformed_body', targetCount: 0 })
  })
})

describe('observer source and stop refusal boundaries', () => {
  it.each([{}, { extensionId: 'extension' }, { tabId: 7 }, { sessionId: '', targetId: '' }])(
    'refuses document continuity with an indistinguishable source %j',
    async (source) => {
      const packets = [...preNavigationPackets, ...navigationPackets, ...postNavigationPackets].map((packet) => ({
        ...packet,
        source,
      }))
      const readEvents = vi.fn().mockResolvedValueOnce(packetPage(0, [])).mockResolvedValueOnce(packetPage(12, packets))
      const observer = await createPostHogObserver(
        { send: vi.fn(async () => ({})), readEvents },
        {
          clinicId: '42',
          expected: expectedProfile,
          probeUrl: 'https://site.example.test/favicon.ico',
          deadline: Date.now() + 10000,
          documentNavigation: navigation,
        },
      )
      const result = await observer.drain()
      expect(result).toMatchObject({
        complete: false,
        probeProven: false,
        targetSentCount: 0,
        documentNavigation: { proven: false },
      })
      expect(observer.matchesDeliveredSession('private-session')).toBe(false)
    },
  )

  it.each(['events', 'post_data'] as const)(
    'discards a pending %s read after stop without starting another read',
    async (boundary) => {
      let resolvePending!: (value: unknown) => void
      const pending = new Promise<unknown>((resolve) => {
        resolvePending = resolve
      })
      const capture = documentPacket(1, 'Network.requestWillBeSent', {
        requestId: 'private-pending',
        request: { url: 'https://analytics.example.test/e/', method: 'POST', hasPostData: true },
      })
      const page = {
        ...packetPage(3, [
          capture,
          documentPacket(2, 'Network.responseReceived', { requestId: 'private-pending', response: { status: 200 } }),
          documentPacket(3, 'Network.loadingFinished', { requestId: 'private-pending' }),
        ]),
        hasMore: true,
      }
      const readEvents = vi
        .fn()
        .mockResolvedValueOnce(packetPage(0, []))
        .mockImplementationOnce(() => (boundary === 'events' ? pending : Promise.resolve(page)))
        .mockResolvedValue(packetPage(3, []))
      const send = vi.fn(async (method: string) => (method === 'Network.getRequestPostData' ? pending : {}))
      const observer = await createPostHogObserver(
        { send, readEvents },
        {
          clinicId: '42',
          expected: expectedProfile,
          probeUrl: 'https://site.example.test/favicon.ico',
          deadline: Date.now() + 10000,
        },
      )
      const drain = observer.drain()
      if (boundary === 'post_data') {
        await vi.waitFor(() =>
          expect(send).toHaveBeenCalledWith('Network.getRequestPostData', expect.anything(), expect.anything()),
        )
      }
      observer.stop()
      resolvePending(boundary === 'events' ? page : { postData: JSON.stringify(correlatedTarget) })
      const result = await drain
      expect(result).toMatchObject({
        complete: false,
        reasons: ['observer_stopped'],
        probeProven: false,
        targetSentCount: 0,
        requests: [],
      })
      expect(observer.snapshot()).toEqual(result)
      expect(observer.matchesDeliveredSession('private-session')).toBe(false)
      expect(readEvents).toHaveBeenCalledTimes(2)
      expect(send).toHaveBeenCalledTimes(boundary === 'events' ? 1 : 2)
      expect(await observer.drain()).toEqual(result)
      expect(readEvents).toHaveBeenCalledTimes(2)
    },
  )
})
