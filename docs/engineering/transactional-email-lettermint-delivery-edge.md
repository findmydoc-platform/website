# Transactional email Lettermint delivery edge

This document is the implementation contract for the Lettermint delivery edge owned by the Website runtime. It is
tracked by [Website issue #1847](https://github.com/findmydoc-platform/website/issues/1847) under
[management issue #388](https://github.com/findmydoc-platform/management/issues/388).

[ADR 028](../adrs/028-adr-lettermint-for-transactional-email.md) remains binding. This specification does not
reconsider Lettermint, Website ownership, React Email ownership, the outbox requirement, environment isolation, or
the absence of a hot provider fallback. It consumes the
[transactional email platform foundation](transactional-email-platform-foundation.md) and does not replace its
command, transaction, state, retry, deadline, or retention contracts.

## Problem Statement

The shared transactional email foundation deliberately stops at a provider-neutral delivery seam. Real delivery
still needs one precise boundary for Lettermint authentication, sender readiness, request construction, response
classification, signed provider feedback, suppression, environment isolation, operational evidence, and gradual
activation.

Without that boundary, product flows could acquire provider credentials, select senders, interpret provider errors,
or bypass suppression and activation policy. Webhook payloads could also leak recipient or message content into
storage and logs, while Preview and Production could accidentally share provider state. Those failures would break
the ownership and privacy guarantees established by ADR 028 and the platform foundation.

## Solution

The Website worker receives a private Lettermint delivery adapter behind the foundation's existing delivery seam.
The adapter sends one previously prepared operation through a dedicated environment-specific Lettermint project and
transactional route. It persists the exact serialized provider request before the first network attempt, reuses the
foundation-owned idempotency key for every attempt, and immediately normalizes provider responses into the
foundation's four delivery outcomes.

A separate Website webhook boundary verifies the exact raw request body before parsing it. It correlates a verified
event through opaque provider metadata and the provider message identifier, deduplicates the provider event, and
applies the corresponding outbox event, terminal state, and suppression effect in one short database transaction.
Provider content is never retained.

Local development, tests, and CI remain fake-only. Preview and Production use separate teams, projects, routes,
tokens, webhook secrets, digest keys, and activation records. Preview additionally requires a central digest
allowlist. Production additionally requires the legal, privacy, compliance, sender, DNS, webhook, and release
evidence defined below. Every command type starts disabled and can be activated independently. There is no fallback
or parallel send path.

The product-flow issues retain their existing responsibility:

| Flow issue | Responsibility retained by the flow |
| --- | --- |
| [#1734](https://github.com/findmydoc-platform/website/issues/1734) | Auth triggers, recipients, action links, callbacks, and templates |
| [#1735](https://github.com/findmydoc-platform/website/issues/1735) | External-message trigger, patient recipient, protected link, and template |
| [#1736](https://github.com/findmydoc-platform/website/issues/1736) | Moderation triggers, participant matrix, protected links, allowed content, and templates |
| [#1737](https://github.com/findmydoc-platform/website/issues/1737) | Clinic-registration trigger, contact recipient, process wording, and template |

## User Stories

1. As a product-flow implementer, I can submit only a semantic command and cannot select Lettermint, a sender, a
   route, a recipient address, provider metadata, or delivery behavior.
2. As a product-flow implementer, I retain ownership of the approved trigger, recipient, action link, and template in
   the relevant flow issue without also implementing provider delivery.
3. As the Website worker, I am the only application path that can obtain the capability required to call the
   Lettermint Sending API.
4. As a request handler, I can persist an outbox operation but cannot call Lettermint directly.
5. As a Dashboard caller, I can hand off an approved semantic command without receiving provider credentials or
   provider behavior.
6. As an operator, I can identify the command type, environment, operation, attempt, and provider reference involved
   in a delivery problem without seeing the recipient, action link, subject, or message body.
7. As an operator, I can distinguish provider acceptance from recipient delivery and from product-level command
   acceptance.
8. As an operator, I can tell whether a provider attempt was accepted, retryable, ambiguous, or permanent through a
   stable internal outcome instead of a raw Lettermint error.
9. As an operator, I can see that a retry reused the same provider idempotency key and exact request without exposing
   either value in logs.
10. As an operator, I can rotate a webhook secret through a bounded receiver-side overlap without accepting stale
    webhook deliveries indefinitely.
11. As a security reviewer, I can prove that a webhook signature is checked against the unmodified request bytes
    before any JSON parser or business handler sees the payload.
12. As a security reviewer, I can prove that invalid, stale, oversized, or environment-mismatched webhooks cannot
    mutate outbox, event, or suppression state.
13. As a security reviewer, I can prove that the send token and webhook secret are separate private capabilities and
    do not reach the browser, Dashboard, product flow, or public module interface.
14. As a privacy reviewer, I can prove that raw webhook payloads, recipient addresses, subjects, provider responses,
    SMTP responses, and message bodies are neither logged nor persisted as provider history.
15. As a privacy reviewer, I can inspect the exact small allowlists for retained webhook fields, log fields, and
    metric dimensions.
16. As a recipient, a verified hard bounce prevents a later transactional message to the same address before a new
    action link or provider request is created.
17. As a recipient, a verified spam complaint prevents a later transactional message to the same address before a
    new action link or provider request is created.
18. As a recipient, a soft bounce does not create a permanent local suppression because Lettermint still owns its
    temporary delivery retry.
19. As an operator, I can see that local suppression remains effective after its source outbox and event history have
    reached their separate deletion deadline.
20. As an operator, I can see that a provider suppression not caused by a verified hard bounce or complaint does not
    silently widen the application's local suppression policy.
21. As a Preview tester, I can send only an enabled command to an approved synthetic recipient whose versioned digest
    appears in the central Preview allowlist.
22. As a Preview tester, I cannot bypass the allowlist by changing a command payload, flow parameter, email casing,
    or environment variable owned by a product flow.
23. As a Production user, I cannot receive a real message until the specific command has passed provider, sender,
    DNS, webhook, legal, privacy, compliance, and release gates.
24. As a release owner, I can activate one command without activating any other command.
25. As a release owner, I cannot activate Production by copying Preview credentials or an incomplete Preview
    activation record.
26. As a release owner, I can remove a command from the central activation registry and know that later outbox work
    fails closed before provider submission.
27. As a release owner, I can verify that the prior direct send path for the command has been removed before the new
    command is activated, so exactly one path can send.
28. As a developer, I can run the entire automated delivery-edge suite without a Lettermint account, project token,
    webhook secret, DNS change, or outbound network call.
29. As a developer, I can exercise the real worker and request serialization while replacing only the external
    Lettermint HTTP transport.
30. As a developer, I can exercise the real Next.js webhook route and real Payload persistence with signed raw bytes
    while replacing no application layer beneath the route.
31. As a developer, I receive a startup failure in a hosted environment when real delivery configuration is absent
    or inconsistent; the system never silently selects the fake adapter.
32. As a maintainer, I can change provider-specific parsing without changing the semantic command interface or the
    product-flow catalog.
33. As a maintainer, I can replace the hosted metrics sink later without changing delivery, webhook, suppression, or
    product-flow contracts.
34. As a cache reviewer, I can prove that suppression and delivery operations have no public read, cache tag,
    revalidation event, discovery consumer, or affected path.
35. As a compliance reviewer, I can stop Production activation without blocking fake Local and CI evidence or
    approved synthetic Preview evidence.
36. As an incident responder, I can distinguish invalid signatures, provider contract drift, configuration drift,
    suppression hits, and provider outages through privacy-safe codes without inspecting message content.

## Implementation Decisions

### Boundary and ownership

The delivery edge extends the deep transactional email module defined by the foundation. It does not add another
public command, a generic send function, or a second product-facing import. Product flows continue to use only the
payload-independent command port.

The delivery edge owns two private capabilities:

- the outbound capability can read the environment-scoped project token and call the Lettermint Sending API;
- the inbound capability can read the environment-scoped webhook secret and apply verified provider events.

Possession of one capability does not imply possession of the other. Neither capability is exported through the
feature's public interface. Browser code, the Clinic Dashboard, product-flow handlers, Payload Admin, and the generic
Payload email adapter receive neither capability.

The outbound capability is invoked only by the existing central worker after a valid lease, eligibility
revalidation, suppression decision, activation decision, and durable preparation. The inbound capability can write
only provider event history, allowed provider-driven state transitions, and local suppression effects. It cannot
accept commands, resolve recipients, generate action links, render templates, or submit messages.

### Provider and route topology

Preview and Production each use their own Lettermint team, project, and dedicated transactional route. One human
account may own or access both teams, but the provider resources and billing contexts remain separate. Tokens,
webhooks, webhook secrets, sender readiness, team-level and project-level suppressions, message history, and
operational evidence do not cross between environments. Local development, tests, and CI have no Lettermint team or
project configuration.

Separate projects inside one team are insufficient because Lettermint applies automatic hard-bounce suppressions at
team scope. The Preview team and Production team must therefore have different provider team identifiers. A shared
team identifier is invalid configuration even when project and route identifiers differ.

The dedicated route serves only the shared transactional email module. It is not shared with marketing, broadcast,
inbound email, the generic Payload adapter, or another application. The route subscribes only to the provider events
listed in this specification.

The adapter uses the single-message Sending API. One operation contains exactly one `to` recipient. The adapter does
not use batch sending, scheduling, `cc`, `bcc`, attachments, arbitrary headers, a caller-selected `reply_to`, or a
caller-selected route. The sender and route come only from the validated environment configuration. Subject, HTML,
plain text, and recipient come only from the durable prepared operation.

Open and click tracking are disabled in the dedicated Lettermint route and set to disabled on every request. The
provider request contains no marketing tag, free-form metadata, source record, business operation reference, action
link field, or template identifier.

The only outbound provider metadata is this closed operational set:

```text
operation_id
command_type
environment
```

`operation_id` is the opaque foundation identifier. `command_type` is a member of the closed command union.
`environment` is `preview` or `production`. These values enable webhook correlation without exposing a recipient,
link, subject, body, identity, clinic, patient, or business record.

### Exact provider request and transport

Before the first provider attempt, the worker deterministically serializes the complete Lettermint request body from
the durable prepared operation, the closed metadata allowlist, and the validated sender and route configuration. It
stores those exact bytes as a transient provider-prepared field on the outbox in the same short transaction that
marks provider preparation complete. The field is private, is never queried independently, and follows the same
scrubbing rules as the prepared recipient and rendered content.

That transaction also stores an immutable, content-free provider binding containing the expected team, project, and
route. These binding fields remain with the scrubbed operational metadata until normal outbox deletion.

Every attempt sends the stored bytes unchanged with:

- the environment-scoped project token in the Lettermint token header;
- the foundation-owned provider idempotency key in the `Idempotency-Key` header;
- JSON content type;
- no additional variable request headers.

The adapter never rebuilds the request from current sender configuration after the first attempt. A deployment,
sender change, or route change therefore cannot cause the same idempotency key to carry a different body during the
24-hour provider idempotency window. Every retry resolves a currently approved project token for the stored team and
project binding. It may use a rotated token for that same project, but it may never move the operation to another
team or project.

The team, project, and route assigned to one hosted environment are immutable after that environment's first real
command activation. V1 does not support a live destination change or keep parallel old and new provider credentials.
The non-secret identities are locked server-only module constants, not deployment-secret values. A secret that does
not match the committed environment target fails module initialization. An operation whose stored binding does not
match that target fails before transport and is never redirected. Moving an environment to another team, project, or
route requires a separate migration decision and specification.

The production transport is a minimal HTTPS transport behind the private adapter. It may use a maintained HTTP
client or provider SDK internally, but no SDK type, exception, retry behavior, or request builder escapes the adapter.
The adapter, not an SDK default, owns timeout and outcome classification. An SDK must have automatic retries disabled
because the foundation owns every attempt.

One outbound request has a 20-second total timeout. This is well below the two-minute lease and leaves time to record
the outcome before lease expiry. A missing definitive provider response, including a timeout, reset, truncated
response, or invalid success body, is ambiguous because Lettermint may have accepted the request. The next foundation
attempt reuses the exact bytes and idempotency key.

### Lettermint outcome mapping

The adapter returns only the four outcomes defined by the foundation. It does not return raw response bodies, raw
error messages, exception objects, or provider headers.

| Provider result | Foundation outcome | Safe outcome code | Effect |
| --- | --- | --- | --- |
| Documented success with a valid provider message identifier and accepted status | `accepted` | `provider-accepted` | Persist provider reference and enter `accepted` |
| HTTP `408`, `425`, `429`, or `5xx` | `retryable` | `provider-temporary` or `provider-rate-limited` | Use the foundation retry schedule |
| No definitive response or a malformed/truncated success response | `ambiguous` | `provider-ambiguous` | Reuse exact request within the 24-hour ambiguity window |
| HTTP `409` with `invalid_idempotent_request` | `permanent` | `provider-idempotency-conflict` | A different body used the key; fail terminally and emit an invariant alert |
| HTTP `409` with `concurrent_idempotent_requests` | `ambiguous` | `provider-request-in-progress` | Retry the same bytes and key through the foundation schedule |
| HTTP `409` without one of the two validated provider codes | `ambiguous` | `provider-conflict-unknown` | Preserve the operation and retry the same bytes and key |
| Other HTTP `4xx`, including invalid token or request | `permanent` | `provider-request-rejected` | Fail terminally and emit an operational alert |
| Documented provider rejection or provider-side suppression in a definitive response | `permanent` | `provider-policy-rejected` | Fail terminally; do not infer a local hard-bounce or complaint suppression |

The adapter ignores provider retry timing. A `Retry-After` value may contribute only to a safe diagnostic code; it
cannot change the foundation's fixed retry schedule, six-attempt limit, delivery deadline, or ambiguity window.

Authentication and authorization failures are permanent for the affected operation because the provider did not
accept it. They also indicate hosted configuration drift and must raise the highest delivery-edge operational signal.
They never cause fallback to another token, route, project, provider, or generic email adapter.

### Runtime environments and secret isolation

The existing central runtime-environment policy remains authoritative. Adapter selection is exhaustive:

| Runtime class | Delivery adapter | External delivery network | Activation behavior |
| --- | --- | --- | --- |
| Local development | Fake | Forbidden | Commands can be exercised only through fake evidence |
| Automated test | Scripted fake or controlled test transport | Forbidden | Test-owned outcomes only |
| CI | Fake | Forbidden | Commands can be exercised only through fake evidence |
| Preview | Lettermint Preview adapter | Allowed only after all Preview gates | Per-command activation plus digest allowlist |
| Production | Lettermint Production adapter | Allowed only after all Production gates | Per-command activation plus legal and release evidence |

Preview and Production use the same configuration schema but deployment-scoped values. Required hosted secret values
cover the project token, current webhook secret, optional bounded previous webhook secret, and recipient-digest key
ring. Non-secret target values cover the expected team, project, route, provider webhook identifier, sender identity,
and activation-registry version and live as server-only module constants. Secrets remain in the deployment secret
store and never appear in the repository, activation registry, logs, metrics, issue text, or test fixtures.

The project token is an opaque Lettermint `lm_...` credential, not a documented JWT. The Sending API ping proves only
that the token authenticates; it does not return a trusted team or project identity. Vercel environment scoping keeps
normal Preview and Production access separate, but it cannot detect a human copying a valid Preview token into the
Production secret slot.

The module therefore owns a private credential-fingerprint registry. During provider setup, the operator verifies
the visible team, project, route, and webhook configuration; supplies the project token or webhook secret to a local
setup command through concealed input; and records only the full SHA-256 fingerprint beside the expected
environment, team, project, route, credential kind, and provider webhook identifier where applicable. A fingerprint
is a non-secret, one-way verification value and is committed as a server-only constant. The setup command never
prints, logs, or writes the credential itself.

At module initialization, the Website environment binding reads the real project token and webhook secret from their
environment-scoped Vercel secrets, calculates both SHA-256 fingerprints in memory, and matches each configured
credential to exactly one registry entry before it creates the private delivery adapter or signature verifier. An
optional previous webhook secret requires its own matching fingerprint entry and `validUntil`. The public command
port never receives a credential, fingerprint, or provider identity. A missing or mismatched fingerprint stops
initialization before the worker, transport, or webhook boundary can run. Storing the expected fingerprints beside
the credentials in the same Vercel secret set is insufficient because wrong pairs could be copied together.

Token rotation for the same project updates the Vercel secret and its reviewed fingerprint entry together. The stable
team, project, and route binding lets already prepared operations use the replacement token without moving to
another project. Webhook-secret rotation for the same webhook target updates the current and optional previous Vercel
secrets, their reviewed fingerprints, and the bounded `validUntil` together. Neither rotation changes the immutable
provider target. No Team API token is needed at runtime: the project token sends mail, while Team API access is
limited to separate setup and administration work.

Hosted startup validates the complete configuration before command or worker processing. Missing, malformed,
cross-environment, duplicated, or internally inconsistent configuration fails startup. A hosted runtime never falls
back to a fake. Local, test, and CI reject the presence or selection of a real project token.

The send token is read only by the outbound capability. The webhook secret is read only by the signature verifier.
Provider team credentials, suppression-management credentials, and DNS-management credentials are not application
runtime configuration.

### Command-by-command activation registry

Real delivery is controlled by a versioned, server-only activation registry in the repository. It is a closed list of
command and environment records, not a product feature flag, CMS setting, database record, PostHog flag, caller
parameter, or Dashboard control. Missing entries mean disabled.

Each Preview activation record identifies:

- one closed command type;
- the `preview` environment;
- opaque evidence references for the dedicated provider team, project, and route;
- opaque evidence references for verified sender and DNS readiness;
- an opaque evidence reference for the enabled, signed webhook configuration;
- the expected non-secret activation-registry version;
- the expected project-token and webhook-secret fingerprint entries.

Each Production activation record contains the same fields plus opaque approval references for:

- the DPA and subprocessor review;
- retention and deletion policy;
- digest-key ownership and rotation policy;
- privacy notice and processing-purpose review;
- Lettermint compliance verification;
- the command-specific one-path cutover review.

Evidence references reveal neither document content nor private URLs. CI validates the registry schema, command
union, environment, uniqueness, distinct Preview and Production team identifiers, immutable provider targets,
evidence completeness, credential-fingerprint bindings, and registry-version bindings. Runtime initialization
repeats the relevant environment, fingerprint, and configuration checks before it constructs the delivery adapter
and webhook verifier. A Production entry without every Production field is invalid rather than partially active.
After first real activation, changing a committed team, project, or route constant is a V1 stop condition rather than
a valid registry update.

Command activation does not provision a provider project, set DNS, add credentials, or remove an old product-flow
send path. The relevant flow issue owns the one-path cutover. Its activation change must prove that the former direct
send path is absent before the registry enables the replacement command. There is never a parallel send, shadow send,
dual write to providers, or hot fallback.

An outbox operation for a disabled command remains an auditable command result but is stopped before link generation,
rendering, provider serialization, or provider submission. It enters the existing `suppressed` state with the safe
code `command-not-enabled`, then follows normal scrubbing and retention.

### Preview recipient allowlist

Preview real delivery requires both a Preview activation record and an environment-scoped recipient allowlist. The
allowlist contains only versioned recipient digests produced by the same normalization and HMAC policy used by the
outbox. It contains no plaintext address, domain pattern, wildcard, regular expression, identity identifier, or
product-flow exception.

The worker evaluates the allowlist immediately after lease acquisition and current recipient-binding revalidation,
but before link generation, rendering, provider serialization, or provider submission. A missing or empty allowlist
permits no Preview real delivery. A non-matching recipient enters `suppressed` with
`preview-recipient-not-allowed` and produces no provider request.

The allowlist is a central deployment secret/configuration input. Product flows, the Dashboard, command data, Payload
Admin, and public requests cannot add or override entries. Address normalization is deterministic and shared with the
suppression lookup, so letter casing or presentation differences cannot bypass the comparison.

Preview evidence uses synthetic content and approved test recipients only. Production does not inherit or reuse the
Preview allowlist, team, project, route, token, webhook secret, or sender-readiness evidence.

### Sender, DNS, webhook, and compliance preflight

Real delivery activation requires an operational preflight for the exact environment-specific project and route. The
preflight verifies and records evidence for:

1. the expected Lettermint team, project, and dedicated transactional route;
2. a verified sender domain and approved sender identity;
3. the Lettermint-required DKIM and Return-Path records and the approved DMARC posture;
4. disabled open and click tracking at route level;
5. a route-scoped HTTPS webhook with the exact event subscription defined below;
6. a current webhook signature test against the environment endpoint;
7. distinct Preview and Production team, project, token, webhook, and suppression resources;
8. Production team compliance verification before any Production recipient is allowed.

Preflight evidence is produced outside the request and worker runtimes. Runtime delivery has no Team API token and
does not perform DNS or provider-administration calls. A preflight does not change DNS or provider configuration; it
records that the responsible operator verified the already-provisioned state. Provisioning and DNS changes remain out
of scope.

An activation record binds to the preflight version. Changing the sender, webhook target, event subscription,
credential fingerprint, or tracking setting invalidates the old evidence and disables affected activation until a
new preflight is recorded. Changing the team, project, or route after first real activation is rejected rather than
treated as a routine preflight update. Runtime validation compares the configured team, project, route, sender,
credential fingerprints, and registry version before serializing a provider request or accepting a webhook.

Production credentials, Production DNS cutover, Supabase auth-delivery cutover, Production recipients, and Production
activation remain blocked until the complete written legal and privacy approval set exists. Fake Local and CI
evidence and allowlisted synthetic Preview evidence do not require that Production approval.

### Webhook request boundary

The Website exposes one environment-specific POST endpoint for the dedicated Lettermint route. It accepts HTTPS JSON
requests no larger than 256 KiB. The limit is enforced at the platform ingress when supported and again while the
route reads the request stream. The route counts bytes and aborts as soon as the limit is exceeded; it never calls a
whole-body helper before enforcing the bound. `Content-Length` may reject an oversized request early but is not
trusted as the only guard, so chunked requests receive the same limit. The endpoint performs no provider call, link
generation, template rendering, recipient resolution, or other network work.

The endpoint obtains the exact request bytes before any body parser runs. It then performs these steps in order:

1. reject an absent or malformed `X-Lettermint-Signature` header;
2. parse the signature timestamp and signature value without parsing the JSON body;
3. reject a signature timestamp more than five minutes in the past or future;
4. compute HMAC-SHA256 over the documented timestamp and exact raw body using the current secret and, when still
   valid, the previous secret;
5. compare fixed-length values with timing-safe equality;
6. only after a successful match, parse and validate the closed event envelope;
7. verify that header event type, body event type, team identity, project identity, route identity, and runtime
   environment match;
8. map only the allowed fields and discard the raw body and provider-only fields;
9. apply deduplication and any state or suppression effect in one short database transaction.

The five-minute tolerance follows Lettermint's current replay-protection recommendation. During a planned rotation,
the receiver may hold one previous secret only for a controlled deploy-and-switch window of at most ten minutes.
Lettermint invalidates the old secret immediately when it regenerates the provider secret, so the documented webhook
retry horizon does not justify a longer local overlap. The ordinary five-minute signature-age check still applies to
every old-secret request. After the local `validUntil`, the previous value is rejected and removed.

Unplanned compromise does not use the overlap. It removes the old secret immediately, disables real activation until
a new signed test succeeds, and treats failed in-flight webhook deliveries as an incident to reconcile through
provider evidence.

The endpoint returns:

- `2xx` only after a duplicate has been recognized or the normalized effect is durably recorded;
- `401` for absent, malformed, invalid, or stale signatures;
- `413` for an oversized request;
- `415` for an unsupported content type;
- `4xx` for a verified but structurally invalid provider contract;
- `5xx` for temporary storage or transaction failure so Lettermint retries.

`webhook.test` is signature-verified, environment-verified, acknowledged with `2xx`, and emits only a safe test
result. It does not create an outbox, event, or suppression record. Normal webhook work is intentionally small and
must finish within five seconds; it does not introduce another application queue. If durable processing cannot finish
within that budget, the endpoint returns a temporary failure and relies on provider retry.

### Webhook field allowlist and correlation

After signature and environment verification, the adapter may retain or use only:

```text
event.id
event.event
event.timestamp
context.team_id
context.project_id
context.route_id
data.message_id
data.metadata.operation_id
data.metadata.command_type
data.metadata.environment
```

For hard-bounce and complaint events, the recipient value may be held in memory only long enough to normalize, HMAC,
and compare it with the retained outbox digest. It is then discarded. It is never placed in an exception, log, event,
metric, suppression record, or provider-history field.

The primary correlation key is the opaque `operation_id` originally supplied by the adapter. This exists before the
network request and avoids a race in which a provider webhook arrives before the synchronous provider message
identifier is persisted. The provider message identifier is then stored or compared as a consistency check. Team,
project, route, `command_type`, and `environment` must match the immutable outbox provider binding.

A verified event with no matching operation is acknowledged without mutation and emits only
`provider-event-unmatched`. A verified event whose operation, environment, command type, provider message identifier,
or recipient digest conflicts with the durable record is acknowledged without mutation and raises
`provider-event-mismatch`. Returning success prevents an authenticated but irreconcilable provider event from
creating an unbounded retry storm; the operational signal drives reconciliation.

The raw payload may contain subjects, recipients, SMTP responses, reason strings, tags, or other provider fields.
Those fields are ignored and discarded. Provider reason strings never become internal outcome codes.

### Provider-event idempotency

The top-level Lettermint event identifier is the durable deduplication key. The database uniqueness contract on
provider event identity is the authority, not an in-memory cache. Event deduplication and the state or suppression
effect commit in one transaction.

A repeated event identifier with the same normalized type, source timestamp, operation, and provider message
identifier returns the existing result and `2xx`. It appends no event and repeats no suppression write. A repeated
identifier with conflicting normalized fields is an invariant violation: it mutates nothing, returns `2xx`, and
raises a privacy-safe mismatch signal.

The signature timestamp prevents a captured delivery from being replayed outside the five-minute window. Durable
event identity prevents a fresh replay inside the window or a legitimate provider retry from applying the effect
twice.

### Provider-event mapping and state precedence

The route subscribes to this exact set:

```text
message.created
message.sent
message.delivered
message.hard_bounced
message.soft_bounced
message.spam_complaint
message.failed
message.suppressed
message.policy_rejected
```

It does not subscribe to open, click, unsubscribe, inbound, auto-reply, suppression-management, or broadcast events.
A verified event outside the subscription is acknowledged, recorded as `provider.event-ignored` only when it
correlates to an outbox operation, and raises a configuration-drift metric. It does not change delivery state or
suppression.

The existing event catalog gains these content-free provider events:

```text
provider.created
provider.sent
provider.soft-bounced
provider.failed
provider.suppressed
provider.policy-rejected
provider.event-ignored
```

The event adapter applies this mapping:

| Lettermint event | Outbox effect | Event effect | Suppression effect |
| --- | --- | --- | --- |
| `message.created` | Establish `accepted` when local response was ambiguous; otherwise no state change | `provider.created` | None |
| `message.sent` | Establish `accepted` when needed; otherwise no state change | `provider.sent` | None |
| `message.delivered` | Establish provider acceptance when needed, then apply `delivered` if no terminal delivery outcome exists | `delivery.delivered` | None |
| `message.hard_bounced` | Establish provider acceptance when needed, then apply `bounced` if no terminal delivery outcome exists | `delivery.bounced` | Upsert hard-bounce suppression |
| `message.soft_bounced` | Establish provider acceptance when needed; remain `accepted` | `provider.soft-bounced` | None; Lettermint owns temporary retry |
| `message.spam_complaint` | Establish provider acceptance when needed, then apply `complained` if no terminal delivery outcome exists | `delivery.complained` | Upsert complaint suppression |
| `message.failed` | Establish provider acceptance when needed; no post-acceptance state exists for provider failure | `provider.failed` | None |
| `message.suppressed` | If provider acceptance was never established, apply `failed`; otherwise retain current state | `provider.suppressed` | None unless a separate verified hard-bounce or complaint event exists |
| `message.policy_rejected` | If provider acceptance was never established, apply `failed`; otherwise retain current state | `provider.policy-rejected` | None |

`message.created`, `message.sent`, or a later delivery event can recover an operation whose synchronous send result
was ambiguous. When a terminal delivery event arrives for a still-`prepared` operation, the transaction first records
provider acceptance and then the terminal event, preserving the foundation's explicit transition graph.

The synchronous worker result and a verified webhook may race. Both mutations reload and lock the current outbox row
before applying their effect. If a webhook already established the same provider message identifier and advanced the
operation to `accepted` or a later terminal delivery state, the later worker result is an idempotent success: it does
not require the cleared lease, append another acceptance event, restore transient fields, schedule a retry, or
replace the newer state. A conflicting provider message identifier is an invariant failure and mutates nothing.

The first valid terminal delivery outcome among `delivered`, `bounced`, and `complained` wins the outbox state. A later
conflicting verified event does not replace a terminal state, because the foundation does not allow terminal-to-
terminal transitions. It still receives a deduplicated content-free event result. Hard-bounce and complaint
suppression effects remain independent of terminal-state precedence, so a later complaint can suppress future mail
even when the original outbox already says `delivered`.

Provider event timestamps are retained only as `sourceOccurredAt`. They never determine processing order. Local event
sequence records receipt order, and the explicit transition contract decides whether an effect is applied or ignored.

Different verified events for one operation may also arrive concurrently. The event transaction serializes on the
outbox row, allocates a distinct sequence for every provider event identifier, and retries the complete short
transaction after a serialization or unique conflict. Terminal-state selection uses the transition graph rather
than last-write-wins.

### Local suppression collection

The delivery edge adds one hidden, system-owned `TransactionalEmailSuppressions` collection. A separate collection is
required because active suppression outlives the 42-day outbox history, is queried before every new preparation, and
cannot depend on a provider API call. It cannot be a field on one outbox record, an event-history query, a global, or
a join to a record that is intentionally hard-deleted.

The collection contains only:

| Field | Shape | Contract |
| --- | --- | --- |
| `runtimeEnvironment` | closed select | `preview` or `production`; part of the unique lookup |
| `recipientDigest` | text | Version-prefixed HMAC digest; never logged; part of the unique lookup |
| `reason` | closed select | `hard-bounce` or `spam-complaint` |
| `firstObservedAt` | date | First verified source event time accepted locally |
| `lastObservedAt` | date | Latest verified source event time accepted locally |
| `source` | closed select | `lettermint` in the first implementation |

Payload-managed identifier and timestamps use repository defaults. The database enforces uniqueness for
`(runtimeEnvironment, recipientDigest)`. There is no plaintext recipient, outbox relationship, provider response,
provider suppression identifier, raw reason, free-form metadata, active Boolean, or manual note.

A verified `message.hard_bounced` or `message.spam_complaint` event upserts the record in the same transaction as its
event-history result. Repeated hard bounces update only `lastObservedAt`. A later complaint upgrades the reason to
`spam-complaint`; a later hard bounce never downgrades a complaint. No other provider event creates a local
suppression.

The reason update is monotonic under concurrency: `spam-complaint` outranks `hard-bounce`, and the database upsert
computes the stronger retained reason instead of writing the last request value. Concurrent hard-bounce and complaint
events therefore leave one suppression record with complaint reason while preserving one idempotent history result
for each provider event identifier.

Before every link generation, render, or provider request, the worker computes the operation recipient's current and
still-supported previous versioned digests and queries the suppression collection within the current environment. A
match enters `suppressed`, records the safe reason class, and scrubs the operation without contacting Supabase or
Lettermint. Product flows cannot bypass or override the lookup.

Lettermint's own suppression list remains defense in depth, but the application neither polls it nor treats it as the
sole authority. The runtime has no Team API suppression credential. Provider suppression removal never deletes a
local record automatically.

### Suppression retention and digest-key rotation

Suppression records do not follow the outbox's 42-day deletion policy. They remain active until an approved manual or
legal removal process exists. The first implementation provides no Admin UI, public API, automatic expiry, provider-
driven removal, or application delete command. Legal and Privacy must approve that indefinite active retention before
Production activation.

Recipient digests use a dedicated HMAC key ring per environment. A digest is prefixed with a non-secret key version.
New outbox and suppression digests use only the current key. Lookup computes the digest under the current key and all
explicitly supported previous keys.

When a previous-version suppression matches a newly encountered address, the module atomically adds the equivalent
current-version suppression before stopping delivery. This opportunistically migrates active entries without storing
plaintext. The previous record remains until a separate approved cleanup can prove it is no longer required.

A previous digest key cannot be retired merely because time passed. Retirement is blocked while any retained outbox,
suppression, or Preview allowlist entry still references its version. Because an address may never be encountered
again, a complete rehash is impossible without plaintext. A forced retirement therefore requires a separate,
explicit migration decision with an authoritative plaintext source or an acknowledged loss of suppression coverage.
The Production legal gate must approve this limitation and name the key owner before activation.

This specification does not introduce reversible encryption or custom cryptography for recipient addresses. Keys
remain in the deployment secret store; versions and usage counts are operational metadata.

### Collection access and lifecycle

The suppression collection follows the foundation collections' private access pattern:

- it is hidden from Payload Admin;
- create, read, update, and delete are denied through normal collection access;
- REST and GraphQL endpoints are disabled;
- Local API access requires the deep module's unforgeable private capability;
- internal writes require the expected transaction context;
- versions, drafts, trash, and soft deletion are disabled;
- seed and bootstrap flows never create suppression records.

Only the verified webhook effect and digest-rotation migration can create or update a record. Only a future approved
suppression-removal workflow may hard-delete one. The implementation must use a generated Payload migration and must
inspect the resulting unique constraint and indexes before merge.

### Operational logs and metrics

The delivery edge uses the repository's native structured server logger. Local, test, and CI emit only those
structured records and make no PostHog, provider, telemetry, or other external network call. Preview and Production
emit the same stable records to hosted runtime logs and additionally expose a private operational metrics port. Its
first hosted adapter may derive counters and histograms from structured runtime records; changing the observability
backend later does not change delivery behavior.

Logs may contain only:

```text
operationId
commandType
environment
attemptNumber
outcomeCode
outboxState
providerMessageId
providerEventId
providerEventType
durationBucket
queueAgeBucket
```

Only fields relevant to the event are present. Logs never contain the recipient, recipient digest, provider token,
webhook secret, provider idempotency key, operation reference, action link, subject, HTML, plain text, template props,
raw request, raw response, exception message, SMTP response, provider reason, source record, or activation evidence.

Metrics use only bounded dimensions:

```text
commandType
environment
outcomeCode
outboxState
providerEventType
durationBucket
queueAgeBucket
```

Operation and provider identifiers are correlation fields for logs, not metric labels. The initial metrics cover
provider attempts and outcomes, webhook verification results, duplicate and mismatched events, local suppression
hits and creations, command activation denials, Preview allowlist denials, queue age, and provider-attempt duration.
There are no product analytics events and no PostHog client or mock.

Alert thresholds, dashboards, on-call routing, vendor selection, and long-term metric retention are separate
operational work. This specification defines the safe signal contract they may consume.

### Runner cadence and work bounds

Preview and Production invoke the existing worker entry point once per minute. This keeps Auth delivery latency below
the coarser retention-sweep requirement while leaving the foundation's deadlines and retry schedule authoritative.
Local development and automated tests invoke the worker explicitly and run no background schedule.

Each hosted invocation runs the safety and retention sweep first, then processes at most five due operations. It
claims one operation immediately before processing it and uses at most two concurrent provider attempts. Every
provider request retains its own two-minute lease and 20-second network timeout. A new claim is not started when the
remaining invocation budget cannot cover one bounded attempt and its result transaction.

Lease ownership makes overlapping scheduler invocations safe. Scheduler authentication is a separate secret from
all Lettermint credentials. The scheduler boundary accepts that secret only in an authorization header, compares it
without timing-dependent string comparison, and completes authentication before resolving a worker capability. It
never accepts the secret in a URL, query string, body, cookie, log, or metric. A missing or incorrect secret returns an
unauthorized result without a database read, claim, sweep, provider call, or worker log. The scheduling mechanism may
change without changing this request-level capability check, the one-minute logical cadence, or the worker contract.

The five-operation bound is a conservative first-release value, not a product-flow override. Queue-age and due-count
metrics reveal when volume requires a separate capacity decision. An implementation must stop rather than silently
increase concurrency if platform duration or database limits cannot support the specified bound.

### Cache impact

#### Decision

`no-public-impact`.

The suppression collection joins the existing private operational cache policy with class `private-live`. The outbox,
event history, activation registry, webhook handling, provider adapter, and operational metrics remain private and
uncached.

#### Dependency map

There is no public or cacheable read path. Suppression writes affect only later private worker preparation. Webhook
writes affect only private outbox state, event history, suppression, logs, and metrics. No page, public route, server
data loader, sitemap, discovery surface, search index, or shared response consumes these records.

#### Read/write symmetry

The only suppression read is the private worker lookup before preparation. The only writes are verified provider
effects and approved digest-version migration. Neither side crosses a public freshness boundary, so neither side
emits a normalized revalidation event or calls the cache planner or executor.

#### Tests

Architecture coverage must classify `TransactionalEmailSuppressions` as private operational with no tag families and
no affected paths. A focused contract test must also prove that the collection is absent from
`CACHE_TAGGABLE_COLLECTIONS` and that cache-tag builders reject it. This turns the absence of public cache ownership
into an executable constraint rather than an assumption.

#### Stop conditions

Work stops for a new cache decision if a later change proposes a public or cached delivery-status surface, a public
suppression read, a new cache class, a new tag family, a normalized revalidation event, a sitemap or discovery
consumer, or another affected public path.

### Failure and fail-closed behavior

The edge never guesses when evidence or configuration is incomplete:

- missing hosted configuration fails startup;
- a missing or mismatched project-token or webhook-secret fingerprint fails module initialization;
- Preview and Production configuration with the same provider team identifier fails validation;
- a hosted environment cannot change its provider team, project, or route after first real activation;
- a prepared operation with a mismatched provider binding is never sent or redirected;
- a disabled command is suppressed before preparation;
- a Preview recipient outside the digest allowlist is suppressed before preparation;
- invalid sender, project, route, webhook, registry, or evidence version blocks activation;
- missing Production legal or privacy approval blocks Production activation;
- invalid or stale webhook signatures mutate nothing;
- provider contract drift produces a safe failure signal and no raw payload retention;
- an ambiguous send reuses exact bytes and the same idempotency key;
- permanent provider rejection never falls back;
- an unavailable suppression store prevents preparation rather than sending without the check;
- an unavailable event store causes a temporary webhook failure so the provider retries;
- an oversized webhook is rejected while streaming, before complete buffering;
- an unauthenticated scheduler request reaches neither storage nor the worker;
- unknown environments select neither a fake nor a real adapter.

No flow may catch one of these failures and call the generic email adapter, Supabase email delivery, Lettermint
directly, or another provider.

### Delivery readiness sequence

Implementation and activation are separate. The first delivery-edge implementation may merge while every real
command remains disabled. Readiness proceeds in this order:

1. implement and validate the adapter, webhook boundary, suppression collection, environment policy, activation
   registry, metrics contract, and automated tests with no real provider call;
2. provision and verify the isolated Preview team, project, route, token and webhook-secret fingerprints, webhook,
   and sender resources outside this implementation;
3. record Preview preflight evidence and enable one command for allowlisted synthetic recipients;
4. validate signed webhook delivery, provider idempotency, suppression, logs, and one-path behavior in Preview;
5. obtain written Production legal, privacy, compliance, retention, and key-management approvals;
6. provision and verify a separate Production team, project, route, token and webhook-secret fingerprints, webhook,
   and sender resources without yet enabling a command;
7. prepare and validate one release artifact that both removes the command's former direct send path and adds its
   command-specific Production activation record;
8. release that artifact explicitly, so the old deployment has only the old path and the new deployment has only the
   outbox path;
9. repeat the command-specific cutover for later flows.

This specification authorizes none of those implementation, provider, DNS, Preview, or Production actions by itself.

## Testing Decisions

### Highest-value seam 1: outbound worker through controlled HTTP

The primary outbound integration suite starts at the real central worker with real Payload and the test PostgreSQL
database. It uses the real lease, eligibility, suppression, activation, preparation, serialization, idempotency,
retry, scrubbing, event, and log behavior. Only the external Lettermint HTTPS transport is replaced with a controlled
in-process transport.

This seam must prove:

1. an enabled prepared operation creates exactly one single-message request with the configured sender and route;
2. the request uses exactly one recipient and the stored subject, HTML, and plain text;
3. open and click tracking are disabled in the request;
4. batch, scheduling, `cc`, `bcc`, attachments, arbitrary headers, and unapproved metadata are absent;
5. the provider token and idempotency key appear only in their required request headers;
6. the provider metadata contains exactly operation ID, command type, and environment;
7. the serialized provider body is durable before the first transport call;
8. a retry sends byte-identical body data and the same provider idempotency key after a deployment-style adapter
   recreation;
9. the provider team, project, and route are stored before the first attempt and never change on a retry;
10. a token rotation within the same project can serve the stored binding, while another team or project cannot;
11. changing the configured team, project, or route after first real activation is rejected, and a mismatched stored
    binding never redirects an operation;
12. a valid accepted response records the provider message identifier and scrubs transient content;
13. `429` and `5xx` responses use the foundation retry schedule without an SDK retry;
14. a missing definitive response is ambiguous and stays within the 24-hour ambiguity window;
15. `invalid_idempotent_request` is permanent, while `concurrent_idempotent_requests` and an unknown `409` remain
    ambiguous and reuse the exact request;
16. invalid credentials or request rejection fail permanently without fallback;
17. an injected transport timer reaches the 20-second timeout without wall-clock waiting and leaves enough lease
    budget to record an outcome;
18. a disabled command makes no link, render, serialization, or transport call;
19. a Preview allowlist miss makes no link, render, serialization, or transport call;
20. a local suppression hit makes no link, render, serialization, or transport call;
21. Production activation without every evidence field is rejected before provider work;
22. Local, test, and CI cannot select the real transport even when a test process exposes provider-like environment
    values;
23. missing, malformed, cross-environment, duplicated, or inconsistent hosted configuration fails before adapter,
    worker, database, or transport work;
24. a Preview token or webhook secret in the Production secret slot fails its independently stored fingerprint check
    before adapter or webhook-verifier construction;
25. Preview and Production registry entries cannot share a provider team identifier;
26. logs and metrics contain only their explicit allowlists.

The controlled transport records request bytes and returns scripted protocol responses. It accepts an injected timer
and abort signal, so the suite can advance the 20-second boundary without sleeping. It does not resolve or call the
public Lettermint hostname. A network guard fails the suite if any external connection is attempted.

### Highest-value seam 2: signed Next.js webhook through real Payload

The primary inbound integration suite sends raw HTTP requests through the real Next.js webhook POST boundary and uses
real Payload with the test PostgreSQL database. It does not call a handler function directly and does not mock the
signature verifier, parser, event store, outbox store, suppression store, or transaction boundary.

This seam must prove:

1. a valid signature over the exact raw body is accepted;
2. changing insignificant-looking JSON whitespace after signing invalidates the request;
3. a parsed and re-serialized equivalent body cannot pass raw-body verification;
4. absent, malformed, invalid, future, and older-than-five-minute signatures return `401` and mutate nothing;
5. current-secret and still-valid previous-secret signatures pass during the ten-minute rotation window, while an
   expired previous secret fails and the five-minute signature-age check remains authoritative;
6. an oversized fixed-length body and an oversized chunked body without `Content-Length` are rejected while streaming
   and before complete buffering or JSON processing;
7. a body/header event mismatch, team mismatch, project mismatch, route mismatch, or environment mismatch mutates
   nothing;
8. `webhook.test` verifies successfully without creating persistent records;
9. a verified `message.created` recovers an ambiguous provider acceptance;
10. a verified delivered event can recover provider acceptance and then reach `delivered` atomically;
11. a hard bounce creates one content-free event, one terminal effect when allowed, and one local suppression;
12. a complaint creates or upgrades local suppression even when another terminal delivery state already won;
13. a soft bounce records provider feedback but neither retries locally nor creates suppression;
14. failed, provider-suppressed, and policy-rejected events follow the mapping without inventing a new outbox state;
15. the first valid terminal delivery outcome wins and later conflicting outcomes cannot violate the transition graph;
16. an identical provider event retry returns `2xx` without a second event or suppression mutation;
17. one provider event ID with conflicting normalized fields mutates nothing and raises a mismatch signal;
18. operation metadata correlates an event before the synchronous provider message identifier is stored;
19. a coordinated race pauses the worker after the provider response, applies a signed webhook, and then resumes the
    worker; the provider identifier and newer terminal state remain unchanged, with no retry or duplicate event;
20. an unmatched or mismatched verified event is acknowledged safely without exposing payload content;
21. a temporary database failure returns `5xx`, and the retried delivery applies once after recovery;
22. concurrent delivery of the same event produces one event sequence and one suppression effect;
23. concurrent distinct `delivered` and complaint events retain the first allowed terminal state, preserve both event
    results, and create complaint suppression;
24. concurrent distinct hard-bounce and complaint events preserve both event results and leave exactly one
    suppression record with complaint precedence;
25. recipient comparison uses a transient HMAC calculation and never persists or logs the raw webhook recipient;
26. raw subjects, recipients, reason strings, SMTP responses, tags, and unapproved metadata are discarded;
27. an unsubscribed tracking or suppression-management event cannot change state or local suppression.

### Scheduler request boundary

A focused request-level integration suite invokes the hosted scheduler boundary rather than the worker directly. It
proves that a missing secret, an incorrect secret, a secret in the URL, and a secret in the request body all return an
unauthorized result without a worker call, database read, claim, sweep, provider call, or sensitive log. A correct
authorization header invokes the bounded worker exactly once. The suite uses only a synthetic scheduler secret.

### Focused policy tests

Small deterministic tests cover policy that does not justify a third integration seam:

- exhaustive runtime adapter selection;
- table-driven hosted initialization failures for every missing, malformed, cross-environment, duplicated, or
  inconsistent configuration field;
- activation-registry schema, uniqueness, distinct and immutable provider targets, evidence completeness,
  credential-fingerprint binding, and registry-version binding;
- command-by-command Preview and Production activation;
- concealed-input fingerprint generation for project tokens and webhook secrets that outputs only the expected full
  SHA-256 value;
- project-token and webhook-secret rotation within one stable provider binding, plus rejection of provider-target
  changes;
- recipient normalization and Preview digest allowlist behavior;
- provider status, Lettermint `409` error-code, and transport-error outcome mapping;
- signature parsing, timing-safe comparison inputs, five-minute tolerance boundaries, and ten-minute maximum secret
  overlap;
- provider event field projection and safe outcome-code mapping;
- terminal-state precedence and independent suppression effects;
- suppression reason precedence and unique upsert behavior;
- current and previous digest-key lookup, opportunistic migration, and key-retirement blocking;
- log-field and metric-dimension allowlists;
- one-minute runner cadence, five-operation bound, concurrency bound, and remaining-budget guard;
- private-live cache classification, absence from `CACHE_TAGGABLE_COLLECTIONS`, and tag-builder rejection.

Pure tests use injected time and synthetic secrets. They never assert a secret, address, digest, subject, body, link, or
raw provider response through a snapshot that could expose it in CI output.

### Manual readiness evidence

Automated tests never call real Lettermint. After implementation and separate Preview provisioning, an explicit
Preview readiness run may use one enabled command and one allowlisted synthetic recipient to prove:

- the sender and DNS preflight is current;
- the dedicated route has tracking disabled;
- the provider accepts one idempotent request;
- a repeated identical request does not create another provider message;
- the signed webhook reaches the Preview endpoint and deduplicates a replay;
- a controlled test recipient bounce or provider test event produces only the approved privacy-safe evidence;
- no former direct path sends in parallel.

That evidence is not a Production release. Production requires its own project, preflight, approvals, cutover review,
and explicit activation.

## Out of Scope

- Reconsidering ADR 028 or selecting another provider.
- Changing the foundation command interface, transaction ownership, lease model, retry schedule, state list, action-
  link deadlines, scrubbing deadline, or 42-day outbox-history assumption.
- Defining or changing triggers, recipients, action links, callbacks, templates, template wording, or template
  registration owned by issues #1734 through #1737.
- Implementing the Clinic Dashboard handoff owned by Clinic Dashboard issue #150.
- Provisioning Lettermint teams, projects, routes, tokens, webhooks, or sender identities.
- Editing DNS records, Vercel environment values, Supabase settings, or provider suppressions.
- Sending a real Preview or Production email.
- Activating Preview or Production for any command.
- Removing a current direct send path; that belongs to the command's flow issue and cutover change.
- Adding a hot fallback, shadow provider, parallel send, batch send, scheduled send, marketing route, inbound email,
  attachment support, or arbitrary provider metadata.
- Adding open or click tracking, product analytics, PostHog calls, recipient-level dashboards, or public delivery
  status.
- Adding a suppression-management UI, automatic suppression removal, provider suppression synchronization, or manual
  email-address storage.
- Selecting an observability vendor, alert thresholds, on-call policy, or dashboard layout.
- Approving the DPA, subprocessors, retention, privacy notices, compliance status, sender identity, DNS, or key owner.
- Implementing code, migrations, provider configuration, or release changes as part of this specification task.

## Further Notes

### Relationship to the foundation

The platform foundation remains the source of truth for semantic commands, catalog ownership, atomic acceptance,
logical idempotency, provider idempotency ownership, hidden outbox and event history, leases, retries, deadlines,
scrubbing, and outbox retention. This specification adds only the provider-specific serialized request, Lettermint
adapter, verified inbound event behavior, local suppression collection, hosted environment policy, activation,
preflight, scheduling, and operational signals.

The provider-specific transient request bytes and content-free provider binding are additive delivery-edge
requirements. They exist because Lettermint binds an idempotency key and request body within one project for 24
hours. They do not create a generic provider payload extension point. The request bytes are scrubbed with the
prepared recipient and content; the provider binding remains as operational metadata until normal outbox deletion.

### Implementation stop conditions

Implementation must stop and request a new decision if:

- Lettermint cannot preserve the documented idempotency behavior for the single-message API;
- Preview and Production cannot use separate Lettermint teams;
- an approved project token or webhook secret cannot be bound independently to its expected environment and provider
  target;
- a team, project, or route change is required after an environment's first real activation;
- required webhook events omit both the opaque operation metadata and a usable provider message identifier;
- a webhook cannot be verified against unmodified raw bytes in the selected Next.js runtime;
- sender or DNS readiness cannot be bound to an auditable activation version;
- Production policy requires recipient plaintext in the suppression store;
- a previous digest key must be retired while records still require it and no approved migration source exists;
- a product flow requires a second send path, provider fallback, batch, attachment, scheduling, arbitrary metadata, or
  a provider-owned template;
- Local or CI evidence requires an external Lettermint, Supabase, PostHog, or telemetry call;
- a public or cached consumer of delivery or suppression state is proposed;
- the one-minute runner or work bounds cannot satisfy the platform's actual duration and capacity limits;
- Legal, Privacy, Security, or Operations rejects an activation-gate assumption.

### Provider references

The provider-specific constraints were checked against the current Lettermint documentation:

- [single-message Sending API](https://lettermint.co/docs/api-reference/sending/send);
- [24-hour idempotency behavior](https://lettermint.co/docs/platform/emails/idempotency);
- [project and team hierarchy](https://lettermint.co/docs/platform/projects-and-routes/introduction);
- [project and Team API token boundaries](https://lettermint.co/docs/platform/api-token-security);
- [Sending API token ping](https://lettermint.co/docs/api-reference/sending/generic);
- [signed webhook format and replay guidance](https://lettermint.co/docs/platform/webhooks/signing);
- [webhook retries and delivery behavior](https://lettermint.co/docs/platform/webhooks/introduction);
- [webhook event catalog](https://lettermint.co/docs/platform/webhooks/events);
- [provider suppression behavior](https://lettermint.co/docs/platform/emails/suppressions);
- [sender-domain verification](https://lettermint.co/docs/platform/domains/introduction);
- [compliance verification](https://lettermint.co/docs/platform/onboarding/compliance-verification).

These links describe the provider contract observed while writing the specification. Implementation must verify them
again before coding because provider APIs and operational guidance can change.
