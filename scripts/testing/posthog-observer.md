# Passive PostHog transport observation

`posthog-observer.ts` is local test tooling. It does not change the Website bundle, SDK configuration or browser identity. Node 24 can import the TypeScript file directly. If the browser's Node host accepts only JavaScript modules, transpile this single module to an ignored local `.mjs` file and import that file. Keep credentials and runtime expectations out of the generated module. Use only the browser tool's documented CDP capability. The observer calls `Network.enable`, `readEvents` and `Network.getRequestPostData`. It never calls capture, resend, inquiry or reporting APIs.

Install it on the authenticated listing page before the profile action. The default mode requires SPA navigation. The existing listing details link can replace the document; use the explicit document-navigation option below only after a harmless same-origin experiment has established continuity for the current recorder. Obtain `capability` through the documented browser tool and resolve `moduleUrl` to this file's file URL in the local checkout:

```js
const { createPostHogObserver } = await import(moduleUrl)
const observer = await createPostHogObserver(
  {
    send: (method, params, options) => capability.send(method, params, options),
    readEvents: (options) => capability.readEvents(options),
  },
  {
    clinicId: expectedClinicId,
    expected: {
      clinicSlug: expectedClinicSlug,
      pagePath: expectedProfilePath,
      projectToken: expectedProjectToken, // In memory only. Never print or persist.
    },
    probeUrl: expectedSameOriginFaviconUrl,
    documentNavigation: {
      frameId: previouslyObservedTopFrameId,
      loaderId: previouslyObservedLoaderId,
      documentUrl: exactIntendedProfileUrl,
      postNavigationProbeUrl: distinctSameOriginFaviconUrl,
    },
    deadline: commonDeadlineEpochMilliseconds,
  },
)
// Trigger the agreed non-analytics favicon request through the browser.
const preflight = await observer.drain()
// Require preflight.complete && preflight.probeProven before the actual details link.
// Use that link, then drain. Trigger the distinct post-navigation favicon GET.
// Keep draining the same observer and explicit cursor; do not reenable Network.
const evidence = await observer.drain()
// Require complete && strictTargetConfigured && probeProven && targetSentCount > 0.
// In document-navigation mode, also require evidence.documentNavigation.proven.
// Reporting inclusion is a separate prerequisite before any inquiry.
// Compare the later outgoing inquiry's session in memory, then discard that input.
const inquirySessionMatches = observer.matchesDeliveredSession(candidateInquirySession)
observer.stop()
```

The observer enables Network first, then its initial read omits `afterSequence` to establish NOW. Later reads always pass the saved cursor and drain `hasMore` pages using the same method and target filters. Do not call an extra omitted-cursor read between setup and the action. If the capability needs a target selector, pass its already documented `target` as an observer option. For child sessions, learn selectors only from documented `Target.attachedToTarget` events. The observer does not discover or guess targets.

Use a unique favicon URL for each preflight and a real same-origin GET. Its successful response and loading completion prove recording is active; they do not prove analytics. No probe is sent by this module. Keep all traffic inspection in memory. Print or save only `snapshot()` or `drain()` results, never CDP packets, errors, request IDs or bodies.

The output contains closed business event names, target membership counts, HTTP status, CDP timestamps, completion flags and fixed reasons. The booleans `clinicMatched`, `slugMatched`, `pathMatched`, `projectMatched`, `sessionPresent` and `sessionValid` expose no property values. Match/session flags describe observed profile candidates for the expected clinic. A batch may contain several candidates; only a single event satisfying every configured dimension contributes to the strict count. It returns no clinic, cookie, identity, session or raw property values. With `expected` configured, `targetSentCount` counts a decoded profile event only when its clinic ID, slug, page path and project token match exactly, its session matches `^[A-Za-z0-9_-]{1,128}$`, and its request has a 2xx response and loading completion. Batch envelopes must contain only valid event objects in their nonempty `batch` array. Event-local `properties.token` remains mandatory in strict mode; an envelope `api_key` is never inherited. If present, the envelope key must also match the expected project. Every `expected` field must be a nonempty string. `strictTargetConfigured` must be true for an inquiry prerequisite. Omitting `expected` preserves the legacy clinic-only parser contract for transport tests; that mode does not establish the full inquiry prerequisite. `matchesDeliveredSession(candidate)` compares internally against sessions from strict matching events with completed 2xx transport. It returns false for incomplete observation, missing strict expectations, invalid input, pending/failed requests or a stopped observer. It returns only a boolean. Never print its candidate. `stop()` also clears these private session values. An SDK acceptance hook, another event's HTTP 200 or readiness alone cannot satisfy it.

`complete` describes continuity of the observer. A request can still be pending or fail, so inspect `targetSentCount` and the request completion flags as well. Truncated buffers are processed but invalidate the attempt. The default mode invalidates continuity on any full document request. Reinstall and prove a new probe after document replacement unless the explicit document-navigation mode was configured before the action. A detached observer always invalidates continuity.

`documentNavigation` permits one exact same-origin root-document transition. It requires strict payload expectations, no child-target selector, previously observed nonempty top-frame and old-loader IDs, the exact intended document URL, and a distinct same-origin post-navigation probe URL. The initial probe must belong to that frame and old loader; its completed successful response binds the CDP source. The expected document request must use GET, the same top frame and source, and a nonempty new loader. Its status must be 200 and its loading must finish. Redirects and additional or unexpected document requests prevent proof.

After navigation, trigger the distinct probe through the browser. Its GET must belong to the same top frame, new loader and CDP source, return 200 and finish loading. Strict analytics requests must also belong to that new document. Their decoded evidence is retained before the post-navigation probe completes, but `targetSentCount` and the private session comparator remain blocked until the whole transition is proved. The `documentNavigation` snapshot contains only booleans and HTTP status. URLs, frame IDs, loader IDs and source identifiers remain private in-memory state. Missing loader/frame/source evidence, detach, truncation or body loss prevents a pass.

This mode does not establish universal cross-navigation recorder support. The controlled normal-browser experiment establishes feasibility for the current same-origin recorder only; every actual transition still needs its own complete document, probe and capture evidence. A stopped acceptance attempt remains stopped. Use a fresh baseline and observation window for the next acceptance run.

Undecodable or unavailable bodies invalidate the attempt. The decoder supports single event JSON objects, event arrays, nonempty `{ batch: [...] }` envelopes, gzip bytes and the installed SDK's Base64 `data=` form on `/e/` and `/i/v0/e/`. CDP strings that lose binary request bytes cannot establish a payload. Complete Base64 `postDataEntries` are decoded in memory and take precedence over a simultaneously supplied `postData` string, which can lose binary gzip bytes. This does not clear truncation or any other observation failure. Otherwise `Network.getRequestPostData` is attempted within the shared deadline. No payload is reconstructed from resource timing or response status.

Every protocol call has a timeout bounded by the remaining shared budget, at most one second. No new call starts after the deadline. The bridge must honor its documented timeout. `stop()` prevents further reads and clears internal request maps. It does not disable another observer's Network domain or clean up browser sessions.

The local browser regression fully intercepts synthetic external transport and observes `sdk.on('eventCaptured')` separately. Its full document/reload checks remain conditional on the installed SDK accepting the automated browser. A WebDriver/bot-filter skip is a measurement limit, never a Preview pass. The jsdom composition verifies real LoginForm, consent, profile mounting and inquiry serialization with the installed SDK; it does not claim network delivery.
