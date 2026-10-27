import { gunzipSync } from 'node:zlib'

const businessNames = ['clinic_profile_viewed', 'clinic_cta_clicked'] as const
type BusinessName = (typeof businessNames)[number]
type DecodeReason = 'decoded' | 'not_capture' | 'body_unavailable' | 'malformed_body'
export type CaptureExpectations = { clinicSlug: string; pagePath: string; projectToken: string }
function hasStrictExpectations(expected?: CaptureExpectations): expected is CaptureExpectations {
  return (
    expected !== undefined &&
    [expected.clinicSlug, expected.pagePath, expected.projectToken].every(
      (value) => typeof value === 'string' && value.length > 0,
    )
  )
}
type ProfileMatch = {
  clinicMatched: boolean
  slugMatched: boolean
  pathMatched: boolean
  projectMatched: boolean
  sessionPresent: boolean
  sessionValid: boolean
}
export type CaptureEvidence = ProfileMatch & {
  captureRequest: boolean
  decoded: boolean
  reason: DecodeReason
  eventNames: BusinessName[]
  targetCount: number
}

export function isCaptureRequest(url: string, method: string): boolean {
  try {
    return method === 'POST' && ['/e/', '/i/v0/e/'].includes(new URL(url).pathname)
  } catch {
    return false
  }
}

// Raw bodies and properties stay in this call. Return only the closed evidence schema.
export function decodeCaptureRequest(
  request: { url: string; method: string; body?: string | Uint8Array },
  clinicId: string,
  expected?: CaptureExpectations,
): CaptureEvidence {
  return inspectCaptureRequest(request, clinicId, expected)
}

function inspectCaptureRequest(
  request: { url: string; method: string; body?: string | Uint8Array },
  clinicId: string,
  expected?: CaptureExpectations,
  onMatchingSession?: (session: string) => void,
): CaptureEvidence {
  const captureRequest = isCaptureRequest(request.url, request.method)
  const result: CaptureEvidence = {
    captureRequest,
    decoded: false,
    reason: 'not_capture',
    eventNames: [],
    targetCount: 0,
    clinicMatched: false,
    slugMatched: false,
    pathMatched: false,
    projectMatched: false,
    sessionPresent: false,
    sessionValid: false,
  }
  if (!captureRequest) return result
  if (request.body === undefined) return { ...result, reason: 'body_unavailable' }
  try {
    let body = typeof request.body === 'string' ? Buffer.from(request.body) : Buffer.from(request.body)
    if (body[0] === 0x1f && body[1] === 0x8b) body = gunzipSync(body, { maxOutputLength: 8 * 1024 * 1024 })
    let text = body.toString('utf8')
    if (text.startsWith('data=')) {
      const data = new URLSearchParams(text).get('data')
      if (!data) throw new Error('missing_data')
      text = /^[\s]*[\[{]/u.test(data) ? data : Buffer.from(data, 'base64').toString('utf8')
    }
    const parsed: unknown = JSON.parse(text)
    const events = Array.isArray(parsed) ? parsed : [parsed]
    if (
      !events.length ||
      events.some((event) => !event || typeof event !== 'object' || typeof event.event !== 'string')
    )
      throw new Error('invalid_events')
    const eventNames: BusinessName[] = []
    let targetCount = 0
    for (const event of events) {
      if (businessNames.includes(event.event)) eventNames.push(event.event)
      if (event.event !== 'clinic_profile_viewed' || event.properties?.clinic_id !== clinicId) continue
      const properties = event.properties
      const session = properties.$session_id
      const match: ProfileMatch = {
        clinicMatched: true,
        slugMatched: hasStrictExpectations(expected) && properties.clinic_slug === expected.clinicSlug,
        pathMatched: hasStrictExpectations(expected) && properties.page_path === expected.pagePath,
        projectMatched: hasStrictExpectations(expected) && properties.token === expected.projectToken,
        sessionPresent: typeof session === 'string' && session.length > 0,
        sessionValid: typeof session === 'string' && /^[A-Za-z0-9_-]{1,128}$/u.test(session),
      }
      for (const field of Object.keys(match) as (keyof ProfileMatch)[]) result[field] ||= match[field]
      // The conjunction belongs to one event. Batch members cannot supply each other's evidence.
      if (expected === undefined || (hasStrictExpectations(expected) && Object.values(match).every(Boolean))) {
        targetCount++
        if (expected && match.sessionValid) onMatchingSession?.(session)
      }
    }
    return { ...result, captureRequest, decoded: true, reason: 'decoded', eventNames, targetCount }
  } catch {
    return { ...result, reason: 'malformed_body' }
  }
}

type Target = { sessionId: string } | { targetId: string }
type Packet = {
  method: string
  sequence: number
  params?: Record<string, unknown>
  source: { sessionId?: string; targetId?: string; extensionId?: string; tabId?: number }
}
type Page = { cursor: number; events: Packet[]; hasMore: boolean; truncated: boolean }
export type ObserverCDP = {
  send(
    method: string,
    params?: Record<string, unknown>,
    options?: { target?: Target; timeoutMs?: number },
  ): Promise<unknown>
  readEvents(options: {
    afterSequence?: number
    limit?: number
    methods: string[]
    target?: Target
    timeoutMs?: number
  }): Promise<Page>
}
type RequestEvidence = CaptureEvidence & {
  status?: number
  finished: boolean
  failed: boolean
  transportReason?: 'transport_failed'
  timestamp?: number
}
const methods = [
  'Network.requestWillBeSent',
  'Network.responseReceived',
  'Network.loadingFinished',
  'Network.loadingFailed',
  'Inspector.detached',
]

export type DocumentNavigationExpectation = {
  frameId: string
  loaderId: string
  documentUrl: string
  postNavigationProbeUrl: string
}
const sourceFingerprint = (packet: Packet) =>
  JSON.stringify([packet.source.extensionId, packet.source.sessionId, packet.source.tabId, packet.source.targetId])
type Transport = { status?: number; finished: boolean; failed: boolean }

/** Passive, origin-scoped observer. Document continuity requires an explicit proved opt-in. */
export async function createPostHogObserver(
  cdp: ObserverCDP,
  options: {
    clinicId: string
    expected?: CaptureExpectations
    probeUrl: string
    deadline: number
    target?: Target
    documentNavigation?: DocumentNavigationExpectation
  },
) {
  const requests = new Map<string, RequestEvidence>()
  const matchingSessions = new Map<string, Set<string>>()
  const newDocumentCaptures = new Set<string>()
  const delivered = (request: RequestEvidence) =>
    request.decoded &&
    request.finished &&
    !request.failed &&
    request.status !== undefined &&
    request.status >= 200 &&
    request.status < 300
  const probeRequests = new Map<string, Transport & { source: string }>()
  const reasons = new Set<string>()
  let cursor: number
  let stopped = false
  let probeProven = false
  const navigation = options.documentNavigation
  let baselineSource: string | undefined
  let documentKey: string | undefined
  let postProbeKey: string | undefined
  let newLoaderId: string | undefined
  const documentTransport: Transport = { finished: false, failed: false }
  const postProbeTransport: Transport = { finished: false, failed: false }
  const transition = {
    documentSeen: false,
    newLoader: false,
    sameTopFrame: false,
    sameSource: false,
    postProbeSeen: false,
    postProbeSameTopFrame: false,
    postProbeSameLoader: false,
    postProbeSameSource: false,
  }
  if (navigation) {
    let valid = false
    try {
      const origin = new URL(options.probeUrl).origin
      valid =
        !options.target &&
        hasStrictExpectations(options.expected) &&
        Boolean(navigation.frameId && navigation.loaderId) &&
        new URL(navigation.documentUrl).origin === origin &&
        new URL(navigation.postNavigationProbeUrl).origin === origin &&
        navigation.postNavigationProbeUrl !== options.probeUrl
    } catch {
      /* Invalid input never includes its value in an error. */
    }
    if (!valid) throw new Error('invalid_document_navigation')
  }
  const documentProven = () =>
    Boolean(
      navigation &&
      !reasons.size &&
      Object.values(transition).every(Boolean) &&
      documentTransport.status === 200 &&
      documentTransport.finished &&
      !documentTransport.failed &&
      postProbeTransport.status === 200 &&
      postProbeTransport.finished &&
      !postProbeTransport.failed,
    )
  const eligible = (key: string, request: RequestEvidence) =>
    delivered(request) && (!navigation || (documentProven() && newDocumentCaptures.has(key)))
  const timeLeft = () => Math.max(0, Math.min(1000, options.deadline - Date.now()))
  const snapshot = () => ({
    complete: !reasons.size,
    strictTargetConfigured: hasStrictExpectations(options.expected),
    reasons: [...reasons],
    probeProven,
    ...(navigation
      ? {
          documentNavigation: {
            ...transition,
            documentStatus: documentTransport.status,
            documentFinished: documentTransport.finished,
            postProbeStatus: postProbeTransport.status,
            postProbeFinished: postProbeTransport.finished,
            proven: documentProven(),
          },
        }
      : {}),
    targetSentCount: [...requests.entries()].reduce(
      (sum, [key, request]) => sum + (eligible(key, request) ? request.targetCount : 0),
      0,
    ),
    requests: [...requests.values()].map((request) => ({
      ...request,
      ...(request.failed ? { reason: 'transport_failed' as const } : {}),
    })),
  })
  if (!timeLeft()) throw new Error('observer_deadline')
  await cdp.send('Network.enable', {}, { target: options.target, timeoutMs: timeLeft() })
  if (!timeLeft()) throw new Error('observer_deadline')
  const initial = await cdp.readEvents({ methods, target: options.target, limit: 1000, timeoutMs: timeLeft() })
  cursor = initial.cursor
  // An omitted cursor starts at NOW. The initial response does not establish action evidence.
  if (initial.truncated) reasons.add('buffer_truncated')

  async function process(packet: Packet) {
    const params = packet.params ?? {}
    const id = typeof params.requestId === 'string' ? params.requestId : ''
    const source = sourceFingerprint(packet)
    const key = `${source}:${id}`
    if (packet.method === 'Inspector.detached') {
      reasons.add('observer_detached')
      return
    }
    if (packet.method === 'Network.requestWillBeSent') {
      const request = params.request as
        | {
            url?: string
            method?: string
            postData?: string
            postDataEntries?: { bytes?: string }[]
            hasPostData?: boolean
          }
        | undefined
      if (!request || !id) {
        if (params.type === 'Document') reasons.add(navigation ? 'document_transition_unproven' : 'document_replaced')
        return
      }
      if (params.type === 'Document') {
        if (!navigation) reasons.add('document_replaced')
        else {
          if (transition.documentSeen || params.redirectResponse) reasons.add('unexpected_document')
          transition.documentSeen = true
          transition.sameTopFrame = params.frameId === navigation.frameId
          transition.newLoader =
            typeof params.loaderId === 'string' && params.loaderId.length > 0 && params.loaderId !== navigation.loaderId
          transition.sameSource = baselineSource !== undefined && source === baselineSource
          if (
            !probeProven ||
            !transition.sameTopFrame ||
            !transition.newLoader ||
            !transition.sameSource ||
            request.url !== navigation.documentUrl ||
            request.method !== 'GET'
          )
            reasons.add('document_transition_unproven')
          documentKey = key
          newLoaderId = typeof params.loaderId === 'string' ? params.loaderId : undefined
        }
      }
      if (navigation && request.url === navigation.postNavigationProbeUrl) {
        transition.postProbeSeen = true
        transition.postProbeSameTopFrame = params.frameId === navigation.frameId
        transition.postProbeSameLoader = Boolean(newLoaderId && params.loaderId === newLoaderId)
        transition.postProbeSameSource = baselineSource !== undefined && source === baselineSource
        if (
          postProbeKey ||
          !documentKey ||
          request.method !== 'GET' ||
          params.redirectResponse ||
          !transition.postProbeSameTopFrame ||
          !transition.postProbeSameLoader ||
          !transition.postProbeSameSource
        )
          reasons.add('post_navigation_probe_unproven')
        postProbeKey = key
      }
      if (request.url === options.probeUrl && request.method === 'GET') {
        if (
          navigation &&
          (documentKey || params.frameId !== navigation.frameId || params.loaderId !== navigation.loaderId)
        )
          reasons.add('initial_document_unproven')
        probeRequests.set(key, { finished: false, failed: false, source })
      }
      if (!request.url || !request.method || !isCaptureRequest(request.url, request.method)) return
      let body: string | Uint8Array | undefined = request.postData
      if (
        body === undefined &&
        request.postDataEntries?.length &&
        request.postDataEntries.every((entry) => typeof entry.bytes === 'string')
      ) {
        body = Buffer.concat(request.postDataEntries.map((entry) => Buffer.from(entry.bytes!, 'base64')))
      }
      if (body === undefined && timeLeft()) {
        try {
          const data = (await cdp.send(
            'Network.getRequestPostData',
            { requestId: id },
            { target: options.target, timeoutMs: timeLeft() },
          )) as { postData?: string }
          body = typeof data.postData === 'string' ? data.postData : undefined
        } catch {
          /* Never retain protocol errors, which may include request data. */
        }
      }
      const sessions = new Set<string>()
      const evidence = inspectCaptureRequest(
        { url: request.url, method: request.method, body },
        options.clinicId,
        options.expected,
        (session) => sessions.add(session),
      )
      if (sessions.size) matchingSessions.set(key, sessions)
      if (navigation && evidence.targetCount > 0) {
        if (
          documentKey &&
          transition.newLoader &&
          params.frameId === navigation.frameId &&
          params.loaderId === newLoaderId &&
          source === baselineSource
        )
          newDocumentCaptures.add(key)
        else reasons.add('capture_document_unproven')
      }
      if (!evidence.decoded) reasons.add('capture_body_unavailable')
      requests.set(key, {
        ...evidence,
        finished: false,
        failed: false,
        ...(typeof params.timestamp === 'number' ? { timestamp: params.timestamp } : {}),
      })
      return
    }
    const request =
      requests.get(key) ??
      probeRequests.get(key) ??
      (key === documentKey ? documentTransport : key === postProbeKey ? postProbeTransport : undefined)
    if (!request) return
    if (packet.method === 'Network.responseReceived') {
      const response = params.response as { status?: number } | undefined
      if (typeof response?.status === 'number') request.status = response.status
    }
    if (packet.method === 'Network.loadingFinished') request.finished = true
    if (packet.method === 'Network.loadingFailed') {
      request.failed = true
      if (key === documentKey || key === postProbeKey) reasons.add('document_transport_failed')
    }
    probeProven = [...probeRequests.values()].some(
      (probe) =>
        probe.finished && !probe.failed && probe.status !== undefined && probe.status >= 200 && probe.status < 300,
    )
    if (navigation) {
      const baselineProbe = [...probeRequests.values()].find(
        (probe) =>
          probe.finished && !probe.failed && probe.status !== undefined && probe.status >= 200 && probe.status < 300,
      )
      if (baselineProbe && baselineSource === undefined) baselineSource = baselineProbe.source
    }
  }
  return {
    snapshot,
    matchesDeliveredSession(candidate: unknown): boolean {
      if (
        stopped ||
        reasons.size ||
        !hasStrictExpectations(options.expected) ||
        typeof candidate !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}$/u.test(candidate)
      )
        return false
      return [...requests.entries()].some(
        ([key, request]) =>
          request.targetCount > 0 && eligible(key, request) && matchingSessions.get(key)?.has(candidate) === true,
      )
    },
    stop() {
      stopped = true
      requests.clear()
      matchingSessions.clear()
      newDocumentCaptures.clear()
      baselineSource = undefined
      documentKey = undefined
      postProbeKey = undefined
      newLoaderId = undefined
      probeRequests.clear()
    },
    async drain() {
      if (stopped) {
        reasons.add('observer_stopped')
        return snapshot()
      }
      try {
        let hasMore = true
        while (hasMore && timeLeft()) {
          const page = await cdp.readEvents({
            afterSequence: cursor,
            methods,
            target: options.target,
            limit: 1000,
            timeoutMs: timeLeft(),
          })
          if (page.truncated) reasons.add('buffer_truncated')
          for (const packet of page.events) if (packet.sequence > cursor) await process(packet)
          if (page.cursor < cursor || (page.hasMore && page.cursor === cursor)) {
            reasons.add('cursor_discontinuity')
            break
          }
          cursor = page.cursor
          hasMore = page.hasMore
        }
        if (!timeLeft()) reasons.add('observer_deadline')
      } catch {
        reasons.add('observer_read_failed')
      }
      return snapshot()
    },
  }
}
