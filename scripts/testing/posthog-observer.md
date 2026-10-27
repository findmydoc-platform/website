# Passive PostHog transport observation

`posthog-observer.ts` is local test tooling. It does not change the Website bundle, SDK configuration or browser identity. Node 24 can import the TypeScript file directly. Use only the browser tool's documented CDP capability. The observer calls `Network.enable`, `readEvents` and `Network.getRequestPostData`. It never calls capture, resend, inquiry or reporting APIs.

Install it on the authenticated listing page before the profile action. Obtain `capability` through the documented browser tool and resolve `moduleUrl` to this file's file URL in the local checkout:

```js
const { createPostHogObserver } = await import(moduleUrl)
const observer = await createPostHogObserver(
  {
    send: (method, params, options) => capability.send(method, params, options),
    readEvents: (options) => capability.readEvents(options),
  },
  {
    clinicId: expectedClinicId,
    probeUrl: expectedSameOriginFaviconUrl,
    deadline: commonDeadlineEpochMilliseconds,
  },
)
// Trigger the agreed non-analytics favicon request through the browser.
const preflight = await observer.drain()
// Require preflight.complete && preflight.probeProven before the actual SPA link.
// Use the existing SPA link to the intended clinic, then drain repeatedly.
const evidence = await observer.drain()
// Require evidence.complete && evidence.probeProven && evidence.targetSentCount > 0.
// Reporting inclusion is a separate prerequisite before any inquiry.
observer.stop()
```

The initial read omits `afterSequence` to establish NOW. Later reads always pass the saved cursor and drain `hasMore` pages using the same method and target filters. Do not call an extra omitted-cursor read between setup and the action. If the capability needs a target selector, pass its already documented `target` as an observer option. For child sessions, learn selectors only from documented `Target.attachedToTarget` events. The observer does not discover or guess targets.

Use a unique favicon URL for each preflight and a real same-origin GET. Its successful response and loading completion prove recording is active; they do not prove analytics. No probe is sent by this module. Keep all traffic inspection in memory. Print or save only `snapshot()` or `drain()` results, never CDP packets, errors, request IDs or bodies.

The output contains closed business event names, exact target-clinic membership counts, HTTP status, CDP timestamps, completion flags and fixed reasons. It returns no clinic, cookie, identity, session or raw property values. `targetSentCount` counts decoded target events only after a 2xx response and loading completion. An SDK acceptance hook, another event's HTTP 200 or readiness alone cannot satisfy it.

`complete` describes continuity of the observer. A request can still be pending or fail, so inspect `targetSentCount` and the request completion flags as well. Truncated buffers are processed but invalidate the attempt. A full document request or detached observer invalidates continuity. Reinstall and prove a new probe after any document replacement before starting another intended action. Live reload is not supported as a continuous-evidence probe by this observer.

Undecodable or unavailable bodies invalidate the attempt. The decoder supports JSON objects and batches, gzip bytes and the installed SDK's Base64 `data=` form on `/e/` and `/i/v0/e/`. CDP strings that lose binary request bytes cannot establish a payload. Available Base64 `postDataEntries` are decoded in memory. Otherwise `Network.getRequestPostData` is attempted within the shared deadline. No payload is reconstructed from resource timing or response status.

Every protocol call has a timeout bounded by the remaining shared budget, at most one second. No new call starts after the deadline. The bridge must honor its documented timeout. `stop()` prevents further reads and clears internal request maps. It does not disable another observer's Network domain or clean up browser sessions.

The local browser regression fully intercepts synthetic external transport and observes `sdk.on('eventCaptured')` separately. Its full document/reload checks remain conditional on the installed SDK accepting the automated browser. A WebDriver/bot-filter skip is a measurement limit, never a Preview pass. The jsdom composition verifies real LoginForm, consent, profile mounting and inquiry serialization with the installed SDK; it does not claim network delivery.
