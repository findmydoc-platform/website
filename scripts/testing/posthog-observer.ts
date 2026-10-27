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
  source: { sessionId?: string; targetId?: string }
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

/** Passive, origin-scoped observer. Reinstall after any full document navigation. */
export async function createPostHogObserver(
  cdp: ObserverCDP,
  options: {
    clinicId: string
    expected?: CaptureExpectations
    probeUrl: string
    deadline: number
    target?: Target
  },
) {
  const requests = new Map<string, RequestEvidence>()
  const matchingSessions = new Map<string, Set<string>>()
  const delivered = (request: RequestEvidence) =>
    request.decoded &&
    request.finished &&
    !request.failed &&
    request.status !== undefined &&
    request.status >= 200 &&
    request.status < 300
  const probeRequests = new Map<string, { status?: number; finished: boolean; failed: boolean }>()
  const reasons = new Set<string>()
  let cursor: number
  let stopped = false
  let probeProven = false
  const timeLeft = () => Math.max(0, Math.min(1000, options.deadline - Date.now()))
  const snapshot = () => ({
    complete: !reasons.size,
    strictTargetConfigured: hasStrictExpectations(options.expected),
    reasons: [...reasons],
    probeProven,
    targetSentCount: [...requests.values()].reduce(
      (sum, request) => sum + (delivered(request) ? request.targetCount : 0),
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
    const key = `${packet.source.sessionId ?? packet.source.targetId ?? ''}:${id}`
    if (packet.method === 'Inspector.detached') {
      reasons.add('observer_detached')
      return
    }
    if (packet.method === 'Network.requestWillBeSent') {
      if (params.type === 'Document') reasons.add('document_replaced')
      const request = params.request as
        | {
            url?: string
            method?: string
            postData?: string
            postDataEntries?: { bytes?: string }[]
            hasPostData?: boolean
          }
        | undefined
      if (!request || !id) return
      if (request.url === options.probeUrl && request.method === 'GET')
        probeRequests.set(key, { finished: false, failed: false })
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
      if (!evidence.decoded) reasons.add('capture_body_unavailable')
      requests.set(key, {
        ...evidence,
        finished: false,
        failed: false,
        ...(typeof params.timestamp === 'number' ? { timestamp: params.timestamp } : {}),
      })
      return
    }
    const request = requests.get(key) ?? probeRequests.get(key)
    if (!request) return
    if (packet.method === 'Network.responseReceived') {
      const response = params.response as { status?: number } | undefined
      if (typeof response?.status === 'number') request.status = response.status
    }
    if (packet.method === 'Network.loadingFinished') request.finished = true
    if (packet.method === 'Network.loadingFailed') request.failed = true
    probeProven = [...probeRequests.values()].some(
      (probe) =>
        probe.finished && !probe.failed && probe.status !== undefined && probe.status >= 200 && probe.status < 300,
    )
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
          request.targetCount > 0 && delivered(request) && matchingSessions.get(key)?.has(candidate) === true,
      )
    },
    stop() {
      stopped = true
      requests.clear()
      matchingSessions.clear()
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
