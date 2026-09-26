# Transactional email platform foundation

This document is the implementation contract for the shared transactional email foundation owned by the Website
runtime. [ADR 028](../adrs/028-adr-lettermint-for-transactional-email.md) remains the binding architecture decision.
This document does not reconsider the provider, outbox requirement, or application ownership set by that ADR.
The private `@findmydoc-platform/email-templates` package owns template components, copy, and typed props. The Website
owns recipient resolution, HTML and plain-text rendering, the outbox, worker, provider integration, and delivery state.
Package releases reach Website only through a reviewed exact-version dependency change.

The Website currently pins `@findmydoc-platform/email-templates@0.1.1` for a synthetic consumer contract. Only the
package root export is supported. The Website script `scripts/render-synthetic-email-template.mjs` imports the
fictional template and subject, then uses Website's `@react-email/render` dependency to produce HTML and plain text.
The contract under `tests/tooling/emailTemplatesConsumer.test.tsx` checks that output with typed fictional props.
It does not register a product command or invoke the outbox, worker, or a delivery adapter. Production templates and
flow activation require separate issues.

### Private package installation

The committed `.npmrc` maps only `@findmydoc-platform` to GitHub Packages and reads `NODE_AUTH_TOKEN` at install time.
It contains no token value. Local developers set `NODE_AUTH_TOKEN` from a classic GitHub personal access token with
only `read:packages` and account access to the private package. They keep that token in their secure local credential
store and run `pnpm install --frozen-lockfile`; they do not add it to a repository file or shell history.

GitHub Actions install steps read `GH_PACKAGES_READ_TOKEN` into `NODE_AUTH_TOKEN`. This repository is public, so
the package must not grant it GitHub Actions access: [GitHub warns that forks of a public repository may gain access to
private packages through such a grant](https://docs.github.com/en/packages/managing-github-packages-using-github-actions-workflows/publishing-and-installing-a-package-with-github-actions#about-permissions-and-package-access).
The repository secret must contain a classic token with only `read:packages` and package access. GitHub does not pass
repository secrets to forked pull-request workflows; those installs fail closed until a trusted maintainer runs the
checks on an internal branch. CI and Vercel run `scripts/assert-email-template-package-access.mjs` before a frozen
install with strict peer checks. The script checks the pinned version against GitHub Packages without logging the token
or package metadata. A missing or invalid token prevents dependency installation and therefore prevents the build
from passing.

Dependabot uses the `github-packages` registry entry in `.github/dependabot.yml` for npm updates. Its separate
Dependabot secret store must also contain `GH_PACKAGES_READ_TOKEN` with the same read-only package access.
An Actions secret alone does not authorize Dependabot updates. The Dependabot secret also supplies package access
to GitHub Actions checks on Dependabot pull requests. Keep the package's GitHub Actions access grant disabled for
this public repository; the dedicated token preserves the fork boundary.

Website workflows disable package-manager caching and do not cache Next.js build output in GitHub Actions.
Fork pull requests can read default-branch Actions caches, including private package files left in a cached pnpm
store. The only explicit Actions cache contains Playwright browser binaries at `~/.cache/ms-playwright`; the cache
contract test rejects package stores, build directories, and additional cache paths. The central Website release
workflow also disables package-manager caching and uses no Actions cache for the Website checkout.

The `findmydoc-portal` Preview and Production builds and the `fmd-storybooks` Production build require
`NODE_AUTH_TOKEN` while installing Website dependencies. The Preview and Storybook GitHub Actions builds pass the
repository secret only to their build steps. The Preview helper removes it before the prebuilt deployment upload.
Vercel project environment variables also reach Functions at runtime, so the package token must not be stored as a
Vercel project variable. The central Production release caller pins the reviewed workflow from
[platform-release PR #27](https://github.com/findmydoc-platform/platform-release/pull/27) and passes
`GH_PACKAGES_READ_TOKEN`. That workflow maps it to `NODE_AUTH_TOKEN` only for the runner build, then uploads the
prebuilt output without the package token. Use a classic token with only `read:packages` and package access for that
handoff; never pull, print, or commit its value. The separate Production migration-secret gate remains documented in
the [deployment runbook](../deployment-runbook.md#when-migrations-run). Package access does not activate email delivery.
A failed registry authorization, unresolved package, missing public export, or incompatible
React Email peer must fail installation, the consumer contract, or the build.

The work is tracked by [Website issue #1846](https://github.com/findmydoc-platform/website/issues/1846) under
[management issue #388](https://github.com/findmydoc-platform/management/issues/388). It specifies the foundation
that future implementation tickets must deliver before the Lettermint delivery edge or any product flow is
implemented.

## Scope

The foundation owns:

- a closed semantic command interface;
- central command validation, authorization, recipient resolution, and preparation policy;
- a static command and template catalog contract;
- a hidden Payload outbox and immutable event history;
- atomic command deduplication and provider idempotency ownership;
- join-or-own Payload transaction handling;
- worker claims through durable leases;
- delivery state, retry, deadline, scrubbing, and retention policy;
- a fake delivery adapter and privacy-safe local and CI evidence;
- the cache classification and test contract for the new collections.

The foundation does not include:

- the Lettermint adapter, webhook endpoint, suppression store, sender identity, DNS, or provider credentials;
- Preview or Production activation;
- a Dashboard route or Dashboard implementation;
- a product-flow trigger, recipient rule, action link, or template;
- a change to the existing generic Payload email adapter;
- an Admin workflow, operational UI, public delivery-status page, or product analytics event.

[Website issue #1847](https://github.com/findmydoc-platform/website/issues/1847) owns the Lettermint delivery edge.
[Clinic Dashboard issue #150](https://github.com/findmydoc-platform/clinic-dashboard/issues/150) owns the narrow
Dashboard handoff. The existing flow issues retain their approved product responsibility:

| Flow issue | Retained responsibility |
| --- | --- |
| [#1734](https://github.com/findmydoc-platform/website/issues/1734) | Auth triggers, identities, action-link types, callbacks, recipients, and Website integration of package templates |
| [#1735](https://github.com/findmydoc-platform/website/issues/1735) | External-message trigger, patient recipient, protected conversation link, and Website integration of a package template |
| [#1736](https://github.com/findmydoc-platform/website/issues/1736) | Moderation triggers, participant matrix, protected links, allowed status content, and Website integration of package templates |
| [#1737](https://github.com/findmydoc-platform/website/issues/1737) | Clinic-registration trigger, contact recipient, process wording, and Website integration of a package template |

## Ownership and module shape

The foundation will be a deep module. Its planned directory and single payload-independent public import file are:

```text
src/features/transactionalEmail/
src/features/transactionalEmail/index.ts
```

Product flows receive only the command port exported by that public interface. A Website integration layer binds the
current `PayloadRequest`, authentication state, and transaction to private module capabilities before it supplies that
port. The integration binding is not part of the domain command contract, and the public import does not export
`PayloadRequest` or another Payload type.

Product flows do not import storage, worker, retry, template, link, logging, delivery, or Payload integration
implementations.

Payload collection declarations remain in the repository's collection directory:

```text
src/collections/TransactionalEmailOutbox.ts
src/collections/TransactionalEmailEvents.ts
```

Those files declare schemas, access denial, indexes, and internal hook guards. They delegate behavior to the feature
module. They do not contain delivery policy.

The module implementation may use internal files such as the following. The names describe ownership, not a required
one-file-per-concept implementation:

```text
src/features/transactionalEmail/
  index.ts
  commands.ts
  catalog.ts
  errors.ts
  state.ts
  transactions.ts
  storage.ts
  worker.ts
  retry.ts
  retention.ts
  logging.ts
  adapters/
    delivery.ts
    fakeDelivery.ts
```

The delivery seam is real because the fake adapter and the later Lettermint adapter both satisfy it. The link seam will
likewise have a local and CI fake plus the later Supabase implementation. Template rendering remains a pure internal
function and does not need an adapter.

## Public command interface

The module exposes one request-bound command port to product flows:

```ts
type TransactionalEmailAcceptance = {
  operationId: string
  acceptedAt: string
  deduplicated: boolean
}

type TransactionalEmailCommands = {
  accept(command: TransactionalEmailCommand): Promise<TransactionalEmailAcceptance>
}
```

Command acceptance means that the logical operation, outbox record, and first event have joined the current atomic
unit of work. `acceptedAt` is the original command-acceptance time stored as the outbox `createdAt`. It does not mean
that the worker has run, Lettermint has accepted the message, or a recipient server has delivered it.

When the module owns the transaction, `accept` returns only after commit. When the module joins a caller-owned
transaction, its result remains transaction-scoped until the owner commits. The Website integration layer and the
owning product flow must not expose a successful receipt before that commit. A rollback invalidates the scoped result,
and no external caller may observe a successful command acceptance for the rolled-back operation.

The return value never contains a recipient, rendered content, action link, template identifier, sender, provider
reference, or delivery result. A duplicate command returns the original `operationId`, original `acceptedAt`, and
`deduplicated: true`.

The command is a discriminated TypeScript union. Every command contains:

- one closed `type` value;
- one stable, opaque `operationReference` owned by the triggering flow that embeds no address, name, content, or
  secret;
- a command-specific, typed set of internal entity or operation identifiers.

The command never contains an email address, URL, sender, subject, rendered body, template data, provider choice,
retry setting, idempotency key, or free-form `metadata`, `context`, or arbitrary key-value object. Each flow issue owns
the exact command-specific identifiers when it implements its catalog entry.

The first catalog contains exactly these command types:

```text
auth.email-verification
auth.invitation
auth.password-recovery
conversation.external-message-received
moderation.report-received
moderation.report-decided
moderation.appeal-received
moderation.appeal-decided
clinic.registration-received
```

There is no generic send command and no fallback command type. Adding a tenth type requires a new explicit platform
decision and a catalog change.

### Command-acceptance errors

The interface returns typed internal errors for unsupported commands, invalid command data, failed authorization,
missing source records, retryable transaction conflicts, and unavailable transaction storage. These errors create no
outbox record in the failed transaction.

Validation and authorization run before the module returns either a new or deduplicated receipt. A caller that is not
authorized for an existing operation receives no operation identifier, original acceptance time, or other evidence
that the operation exists.

A public recovery route must map target-dependent errors to its existing non-enumerating response contract. The
transactional email module never decides public HTTP status or response wording.

An authorized command whose target is no longer deliverable may create a terminal, content-free outbox result with a
safe reason code. The owning flow defines which target conditions are non-deliverable. It may not bypass the outbox
or log the recipient to explain that outcome.

## Static command catalog

The command catalog is exhaustive and resolved at build time. Each registered command connects its command type to:

- command validation;
- authorization and source-record loading;
- recipient resolution;
- eligibility and recipient-binding revalidation before every preparation or delivery attempt;
- latest-delivery calculation;
- action-link generation when required;
- one closed typed React Email renderer that renders HTML and plain text.

The foundation defines the catalog contract and uses a test catalog. Issues #1734 through #1737 add the real entries
they own. There is no database-backed, Admin-managed, environment-selected, or runtime plugin registration.

A missing catalog entry fails before the module creates an outbox record. A catalog entry may derive template and
recipient choices from authoritative Website data, but callers cannot pass or override those choices. If one command
allows an identity-specific template variant, the catalog entry registers and selects that closed variant itself.

## Transaction contract

Command acceptance follows a join-or-own transaction model.

When the Website integration layer detects an active Payload transaction, it supplies the module with private
transaction capabilities and the module joins it. The deep module does not receive the `PayloadRequest`. The module
does not commit or roll back a transaction owned by the caller. The caller's domain mutation, the new or reused logical
email operation, the outbox record, and the first event then share one commit.

When no transaction exists, the Website integration lets the module start a serializable read-write transaction,
perform command acceptance, and own its commit or rollback. Serialization and deduplication conflicts use the
repository's bounded transaction-retry pattern.

If command acceptance joins a caller-owned transaction, the transaction owner also owns whole-transaction retry. The
module reports a typed retryable conflict instead of trying to recover inside a failed PostgreSQL transaction. The
owner rolls back and repeats the complete domain mutation and command acceptance through the repository's bounded
retry pattern. Only a committed owner transaction may expose the returned receipt.

The transaction performs no Supabase or delivery-provider network call. A failed or rolled-back domain mutation
cannot leave a committed email command behind.

Supabase and Payload cannot share a database transaction. A flow that changes Supabase state must first persist a
recoverable intent and reconcile interrupted progress as required by ADR 028. A flow implementation must stop and
obtain a specific work order if it cannot identify that durable intent.

## Logical and provider idempotency

The database has a unique constraint on `(commandType, operationReference)`. This is the durable authority for one
logical email operation. After validation and authorization, command acceptance first returns an existing matching
operation when one is visible.

Concurrent inserts still race through the database constraint. A module-owned transaction rolls back after losing the
race, repeats the complete transaction through the bounded retry pattern, and then returns the winning record. A
caller-owned transaction receives the typed retryable conflict described above; its owner rolls back and repeats the
complete transaction. The module never tries to load the winner from a PostgreSQL transaction that a constraint error
has already invalidated.

The module generates one opaque random provider idempotency key when it creates the logical operation. It persists the
key on the outbox record. Callers cannot provide, read, or modify it. Every provider attempt for that operation uses
the stored key and the exact stored prepared payload.

The provider key is distinct from the business operation reference. Provider-key persistence therefore remains
stable even if the implementation of business-key normalization changes later.

## Persistent model

The design uses two hidden Payload collections. One mutable record represents current processing state. A separate
append-only collection records content-free events.

### Transactional email outbox

The outbox requires these logical fields. Payload-generated identifiers and timestamps use the repository defaults.

| Field | Shape | Contract |
| --- | --- | --- |
| `commandType` | closed select | One of the nine approved command types; indexed |
| `operationReference` | text | Stable flow-owned reference; never sent to the provider |
| `commandPayload` | JSON, nullable after scrubbing | Serialized member of the closed typed command union; validated on every internal read and write; never queryable by callers; cleared by scrubbing |
| `runtimeEnvironment` | closed select | Captured deployment environment; operational only |
| `state` | closed select | Current state from the state model; indexed |
| `providerIdempotencyKey` | text | Module-generated opaque key; unique and immutable until hard deletion |
| `recipientAddress` | email, nullable | Resolved and stored at command acceptance; transient and scrubbed |
| `recipientDigest` | text, nullable | Versioned keyed digest stored at command acceptance; never logged |
| `preparedSubject` | text, nullable | Transient exact subject; scrubbed |
| `preparedHtml` | textarea, nullable | Transient exact HTML; scrubbed |
| `preparedText` | textarea, nullable | Transient exact plain text; scrubbed |
| `preparedProviderRequest` | textarea or bytes, nullable | Transient exact serialized provider request introduced by the delivery edge; immutable after preparation and scrubbed |
| `preparedAt` | date, nullable | Set once when the exact delivery payload becomes durable |
| `providerTeamId` | text, nullable | Content-free provider-team binding introduced by the delivery edge; immutable after preparation |
| `providerProjectId` | text, nullable | Content-free provider-project binding introduced by the delivery edge; immutable after preparation |
| `providerRouteId` | text, nullable | Content-free provider-route binding introduced by the delivery edge; immutable after preparation |
| `deliveryDeadline` | date | Last safe provider-completion time; indexed |
| `attemptCount` | integer | Starts at zero and never exceeds six |
| `nextAttemptAt` | date, nullable | Central retry schedule; indexed |
| `lastAttemptAt` | date, nullable | Time at which the latest provider request started |
| `firstAmbiguousAt` | date, nullable | Start of the non-extendable 24-hour ambiguity window |
| `providerMessageId` | text, nullable | Provider reference returned after provider acceptance; operational only |
| `leaseToken` | text, nullable | Random worker ownership token |
| `leaseExpiresAt` | date, nullable | Durable two-minute lease deadline; indexed |
| `latestEventSequence` | integer | Monotonic counter used to allocate event order |
| `providerAcceptedAt` | date, nullable | Provider acceptance time |
| `terminalAt` | date, nullable | Start of operational-metadata retention |
| `scrubbedAt` | date, nullable | Proof that transient recipient and content fields were removed |

The implementation must justify `commandPayload` as a closed, runtime-validated serialization of the discriminated
command union. It is not a general extension point. If an implementation needs to query individual payload members,
it must replace the JSON field with explicit schema fields rather than add ad hoc JSON queries.

The composite business-key constraint and any partial event constraints belong in the generated Payload migration.
The implementation must create the migration through the repository's Payload migration command and inspect its SQL.

### Transactional email events

The event collection requires these logical fields:

| Field | Shape | Contract |
| --- | --- | --- |
| `outbox` | required relationship | Owning outbox record; indexed |
| `sequence` | integer | Monotonic within one outbox operation |
| `type` | closed select | Content-free event type |
| `source` | closed select | `command`, `worker`, or `provider` |
| `attemptNumber` | integer, nullable | Related delivery attempt when applicable |
| `outcomeCode` | closed select, nullable | Privacy-safe machine code, never a raw error message |
| `providerEventId` | text, nullable | Unique external event identifier for webhook deduplication |
| `sourceOccurredAt` | date, nullable | Provider-reported time, not authoritative ordering |

The first event catalog contains:

```text
command.accepted
preparation.completed
preparation.failed
lease.acquired
delivery.attempt-started
delivery.retry-scheduled
delivery.ambiguous
delivery.accepted
delivery.delivered
delivery.suppressed
delivery.bounced
delivery.complained
delivery.failed
delivery.expired
payload.scrubbed
```

Repeated command acceptance does not append another event. Repeated provider events return the existing event. This
keeps retries and replay attempts from creating an unbounded history.

The database enforces uniqueness for `(outbox, sequence)` and for a non-null provider event identity. Event order
comes from `sequence`, not from clocks. The module increments `latestEventSequence` and appends the event in one short
transaction.

Normal internal behavior may create events but may never update them. Only the approved retention path may hard-delete
an event together with its owning outbox record.

### Payload access

Both collections:

- remain hidden from Payload Admin;
- deny create, read, update, and delete through normal collection access;
- expose neither REST nor GraphQL endpoints;
- reject direct Local API use without the module's private context capability;
- validate that internal writes use the expected transaction context;
- have no versions, drafts, trash, or soft-delete workflow.

The implementation should follow the access and hook patterns already used by `InquiryCommandLocks` and
`InquiryAuditEvents`. The private context capability must not be exported from the module's public interface. Access
checks must compare an unforgeable module-private identity. A caller cannot reproduce the capability by setting a
Boolean or another freely constructible `req.context` value.

## State model

The outbox stores exactly these states:

| State | Meaning |
| --- | --- |
| `queued` | The command is durable but no exact delivery payload is stored yet |
| `prepared` | Recipient and exact delivery payload are durable and eligible for delivery |
| `accepted` | The delivery provider accepted the message |
| `delivered` | A verified provider event reports delivery |
| `suppressed` | Central policy prevented provider submission |
| `bounced` | A verified provider event reports a permanent bounce |
| `complained` | A verified provider event reports a spam complaint |
| `failed` | Preparation or delivery ended permanently without provider acceptance |
| `expired` | The module can no longer attempt delivery before the applicable deadline |

Lease ownership and retry waiting are not states. They use `leaseToken`, `leaseExpiresAt`, `attemptCount`, and
`nextAttemptAt`. This prevents processing details from contradicting delivery state.

Allowed transitions are explicit:

```text
queued -> prepared | suppressed | failed | expired
prepared -> accepted | suppressed | failed | expired
accepted -> delivered | bounced | complained
```

Delivery feedback may arrive more than once or out of order. The later webhook contract must define precedence for
conflicting verified provider outcomes without adding new outbox states. Every accepted or ignored provider event
still receives an idempotent, content-free history result.

`terminalAt` is set when outgoing processing reaches `accepted`, `suppressed`, `failed`, or `expired`. A later verified
delivery outcome may replace `accepted` without resetting the retention clock.

This contract always qualifies the two meanings of acceptance. Command acceptance is the atomic recording of a domain
command. Provider acceptance is the `accepted` outbox state and `delivery.accepted` event created after the delivery
provider accepts the prepared message. Unqualified "acceptance" must not be used when either meaning could apply.

## Two-stage preparation

Command acceptance validates authorization, resolves the intended recipient from authoritative Website data, stores
the transient recipient binding and typed command, and joins the outbox operation to the current atomic unit of work.
It never calls Supabase or a delivery provider.

After every successful claim, including a reclaim or retry, the worker revalidates current eligibility and confirms
that the stored recipient still belongs to the intended identity. This check occurs immediately before any link
generation, rendering, or provider request. An ineligible target, missing source relationship, or changed recipient
binding ends the operation with its command-specific terminal result. The worker neither redirects the operation nor
contacts a link or delivery adapter.

For a valid unprepared operation, the worker then creates an action link where required, renders HTML and plain text,
and persists the exact recipient and rendered payload before any provider call. A crash before that persistence may
repeat preparation because no delivery attempt has started. A crash after persistence may only reuse the stored
payload.

The worker does not silently redirect a command-accepted operation to a changed address. A later valid product action
creates a new operation.

Local development, test, and CI use fake link generation. They do not contact Supabase or any other network service.

## Worker claim contract

Only the central worker processes due outbox records. Request handlers never call a delivery adapter.

The worker first discovers candidate identifiers, then claims each record atomically. A successful claim stores a
random lease token and `leaseExpiresAt` two minutes in the future. The transaction ends before link generation,
rendering, or provider submission begins.

Every later mutation for that attempt must present the matching unexpired token. A stale worker cannot record an
outcome after another worker has reclaimed the operation. The first version does not renew leases.

The worker must not start a step that cannot finish within the remaining lease budget. The Lettermint delivery edge
must set a network timeout substantially below two minutes. If a process crashes, another worker may claim the record
after expiry.

Claims are per outbox record, not per batch. A runner may request a bounded number of candidates, but runner schedule,
batch size, and concurrency belong to issue #1847.

The module increments `attemptCount` and appends an attempt-started event before the provider request. A crash after
the request starts therefore consumes an attempt. Provider idempotency handles the case where the provider accepted a
request but the Website did not record the response. After lease reclaim, the worker must reuse the stored provider
idempotency key and byte-equivalent prepared payload. It must not regenerate a link, recipient, subject, HTML, or plain
text after this crash boundary.

## Retry and deadline policy

The foundation owns one retry policy. Product flows and environments cannot override it.

There are at most six provider attempts. Retryable outcomes use these delays after the preceding failed or ambiguous
attempt:

```text
1 minute
5 minutes
30 minutes
2 hours
8 hours
```

The provider adapter returns a typed delivery outcome. Issue #1847 owns the mapping from Lettermint responses to
`accepted`, `retryable`, `ambiguous`, or `permanent`. Suppression and permanent outcomes never retry.

An ambiguous attempt may retry only the exact prepared payload with the same provider idempotency key. The ambiguity
window ends 24 hours after the first ambiguous provider request. The operation then expires and never creates a new
payload, link, operation reference, or provider key automatically.

Every attempt is also clipped by `deliveryDeadline`:

- an Auth deadline is five minutes before the approved action-link validity would end, measured from the original Auth
  action rather than delayed worker execution;
- every non-Auth deadline is 24 hours after command acceptance.

The Auth catalog entry derives this deadline from authoritative link-validity configuration during command
acceptance. Link generation during preparation must not extend it.

The worker does not start an attempt unless its bounded work can complete before the deadline. When no safe attempt
remains, the operation becomes `expired`. A later user or business action must create a new logical operation.

Time is an injected dependency for policy tests. Production code uses the runtime clock at the module seam rather than
calling the clock throughout the implementation.

## Scrubbing and retention

The outbox may temporarily hold the typed command payload, recipient address, action link inside rendered content,
subject, HTML, and plain text. The event collection and logs never hold those values.

The module clears these transient or no-longer-actionable outbox fields in the same short transaction that records
provider acceptance or a terminal pre-provider outcome:

- `commandPayload`;
- `recipientAddress`;
- `preparedSubject`;
- `preparedHtml`;
- `preparedText`;
- `preparedProviderRequest`;
- `nextAttemptAt`;
- `leaseToken`;
- `leaseExpiresAt`.

Until hard deletion, the scrubbed outbox retains only this explicit content-free allowlist:

- the Payload record identifier and repository-managed timestamps;
- `commandType`, `operationReference`, `runtimeEnvironment`, and `state` after outgoing processing has terminated;
- `providerIdempotencyKey`, `recipientDigest`, and `providerMessageId`;
- `providerTeamId`, `providerProjectId`, and `providerRouteId`;
- `attemptCount` and `latestEventSequence`;
- `preparedAt`, `deliveryDeadline`, `lastAttemptAt`, `firstAmbiguousAt`, `providerAcceptedAt`, `terminalAt`, and
  `scrubbedAt`.

The associated event history retains only its already content-free schema, including safe outcome codes. The retained
business reference remains the deduplication authority, and the sequence counter remains the event-ordering authority.

The first implementation does not add application-level encryption for the transient fields. The collections remain
private and the fields have a short lifetime. If Legal or Security requires application-level encryption, work stops
for a separate key-management and rotation decision rather than adding custom cryptography inside the foundation.

Scrubbing remains opportunistic as required by ADR 028. The worker runs the retention sweep before preparing another
message. The eventual runner must invoke that same worker entry point at least every 30 minutes, including when there
is no due message. The safety sweep runs first on every invocation. This cadence supplies enough scheduling margin for
the one-hour limit without a separate cleanup application. Issue #1847 owns the exact runner configuration but may not
weaken this maximum interval.

For a `queued` or `prepared` record past its `deliveryDeadline`, the safety sweep atomically clears the transient fields,
sets `state` to `expired`, and writes `terminalAt` and `scrubbedAt`. If an already terminal or provider-accepted record
somehow remains unscrubbed, the sweep clears its transient fields and writes `scrubbedAt` without replacing its
recorded outcome. The hard-deletion phase may run daily through the same entry point.

The provisional retention assumptions are:

- transient delivery fields are scrubbed immediately at provider acceptance or another terminal outcome;
- a safety sweep scrubs any remaining transient fields no later than one hour after `deliveryDeadline`;
- scrubbed outbox metadata and its events become deletion-eligible 42 days after `terminalAt`;
- the daily sweep hard-deletes the outbox and its events within the following 24 hours.

The 42-day working value matches Lettermint's documented
[28-day active message retention](https://lettermint.co/docs/platform/emails/data-retention) plus the
[DPA](https://lettermint.co/dpa)'s maximum 14-day residual backup cycle. It is an engineering assumption, not Legal
approval. Before Production, Legal and Privacy must approve or replace the value, document the processing purpose,
approve the HMAC key owner and rotation policy, and confirm the deletion mechanism. Production remains blocked until
that decision is complete.

Suppression retention belongs to issue #1847 and is not governed by this 42-day value.

## Fake adapters and environment behavior

Local development, test, and CI select fake link and delivery adapters and cannot select the Lettermint adapter. The
fake delivery adapter:

- accepts every valid attempt by default;
- performs no network call;
- returns only the typed delivery outcome;
- emits one structured event through the existing server logger;
- can receive a scripted outcome sequence in tests.

Scripted outcomes cover temporary failure, ambiguous submission, permanent failure, and provider acceptance. They are
injected per test and are not runtime environment variables. Test orchestration may also trigger one deterministic
crash after the fake provider returns and before local result persistence. That fault point is test-only and cannot be
selected through runtime configuration.

The safe structured fields are:

```text
operationId
commandType
attemptNumber
outcomeCode
environment
```

The adapter must never log or emit the recipient, recipient digest, link, subject, body, template props, command
payload, provider key, provider response, raw error, or source record. It must never call PostHog.

The implementation must prove through a network guard that Local, test, and CI cannot contact Lettermint, Supabase link
generation, PostHog, or another external delivery endpoint. The existing generic Payload silent email adapter remains
unchanged and is not used by this module.

Preview and Production fail closed until issue #1847 supplies the real delivery adapter and environment-specific
configuration. A missing real adapter cannot fall back to the fake in a hosted environment. Environment selection is
an exhaustive startup contract: Local, test, and CI select only fakes; Preview and Production without a real adapter
fail before command or worker processing starts.

## Cache impact

Decision: `no-public-impact`.

Both collections join the existing private operational policy entry with cache class `private-live`. They have no
public read, rendered surface, discovery consumer, cache key, cache tag, normalized revalidation event, invalidation
owner, or affected path.

Writes to either collection do not call the cache planner or executor. The command input, recipient, prepared payload,
outbox state, and event history remain private and request-bound.

A focused architecture contract test must prove that both collections are classified and have no tag families. Work
stops for a new cache decision if a later change proposes a public status page, public route, cached loader, sitemap or
discovery use, new cache class, new tag family, or revalidation behavior.

## Outside-in test contract

The primary behavior tests cross the same payload-independent command port that product flows use. The Website test
integration binds real Payload with the test Postgres database, the static test catalog, fake link generation, and the
fake delivery adapter.

The behavior suite must prove:

1. A valid standalone command returns a successful receipt only after one outbox operation and its first event commit.
2. A caller-owned transaction commits or rolls back its domain mutation, outbox record, and first event together; its
   product-facing integration boundary returns no successful receipt before commit or after rollback.
3. Repeating the same authorized business operation returns the original operation without creating another row.
4. An unauthorized initial or duplicate command returns no receipt or existing-operation metadata and does not change
   the outbox or event history.
5. Concurrent standalone command acceptance produces one logical operation after the losing module-owned transaction
   retries in full.
6. Concurrent command acceptance inside caller-owned transactions returns a typed retryable conflict to the losing
   owner; repeating that complete transaction returns the winning operation as deduplicated.
7. A standalone call owns a serializable transaction and handles a serialization conflict within the bounded retry
   policy.
8. Two workers cannot hold a valid lease for the same operation at the same time.
9. An expired lease can be reclaimed, while a stale lease token cannot mutate the record.
10. Preparation becomes durable before a provider attempt. The exact serialized provider request and its
    team/project/route binding never change across retries; scrubbing later clears only the serialized request and
    retains the content-free binding.
11. Changing recipient ownership or eligibility after command acceptance but before preparation produces no link or
    delivery call and records the command-specific terminal result.
12. Changing recipient ownership or eligibility between provider attempts prevents the next link or delivery call,
    records the command-specific terminal result, and scrubs the prepared payload.
13. A deterministic crash after the fake provider returns but before local result persistence consumes the started
    attempt. Lease reclaim reuses the same provider idempotency key and byte-equivalent prepared payload without
    regenerating the link or content.
14. Retry delays, six-attempt limit, Auth safety margin, non-Auth deadline, and 24-hour ambiguity window use an injected
    clock.
15. State transitions reject every transition not listed in this contract.
16. Event sequences remain unique under concurrent worker and provider-event writes.
17. Provider-event identities deduplicate repeated webhook input at the storage seam.
18. Provider acceptance and every terminal pre-provider outcome scrub every transient field while retaining exactly
    the approved content-free metadata.
19. A 30-minute runner cadence and safety sweep meet the one-hour scrub limit, while the provisional 42-day deletion
    policy meets its daily deletion bound.
20. Local, test, and CI make no external network or PostHog call.
21. Environment selection is exhaustive: Local, test, and CI choose only fakes; Preview and Production without a real
    adapter fail before processing and never fall back to a fake.
22. Structured logs contain only the approved field allowlist.

Small unit tests cover pure state-transition, retry, deadline, and retention calculations. They do not replace the
outside-in behavior suite with mocks of Payload internals.

Collection contract tests must also prove:

- Admin, REST, GraphQL, and normal Local API access stay denied;
- the module's unforgeable private capability is required and cannot be reproduced with a Boolean or caller-created
  context value;
- direct event updates stay denied;
- the required unique constraints exist after migration;
- the integration contract registry includes both collections;
- the cache policy classifies both collections as `private-live` with no public tags.

## Future implementation order

Implementation remains separate from this specification and requires a new explicit instruction.

When authorized, the foundation should be implemented in this order:

1. Add failing outside-in command-acceptance and worker tests with the test catalog and fake adapters.
2. Add the public command types, acceptance result, typed errors, static catalog contract, and Payload-independent
   command port with its Website integration binding.
3. Add both hidden collection declarations and generate the Payload migration.
4. Add join-or-own transaction handling, storage invariants, business-key deduplication, and ordered event appends.
5. Add state, deadline, retry, lease, preparation, scrubbing, and retention behavior.
6. Add the fake link and delivery adapters, safe logger events, Local, test, and CI network guard, and hosted
   fail-closed environment tests.
7. Register both collections in Payload, permission metadata, integration contracts, and cache policy.
8. Run the focused suites, full repository validation, and the matching read-only reviewers after user confirmation.

No step may add a real product-flow catalog entry, Lettermint credential, provider adapter, webhook, sender DNS change,
Dashboard call, Preview send, or Production send.

## Validation for the future implementation

The implementation work order requires:

```bash
pnpm payload migrate:create transactional_email_foundation
bash .codex/scripts/payload-migration.sh migrate:status
pnpm format
pnpm check
pnpm build
```

It also requires the focused behavior, access-matrix, integration-contract, cache-architecture, migration, log-scrubbing,
and network-guard tests introduced by the change. The implementation must inspect the generated migration and verify
the composite and partial unique indexes against a fresh test database.

After local validation, the matching read-only reviewers are `test_reviewer`, `architecture_reviewer`,
`security_reviewer`, and `cache_architecture_reviewer`. They run only after explicit user confirmation. All findings
must be presented before fixes are made.

## Planning and delivery sequence

The repository sequence remains:

1. Website #1846 accepts this foundation specification and performs no implementation.
2. Website #1847 specifies the Lettermint delivery edge against this contract, while Clinic Dashboard #150 specifies
   its narrow, responsibility-free handoff.
3. `to-tickets` creates distinct implementation issues. A To-Spec issue does not double as an implementation issue.
4. The shared foundation is implemented with fake adapters only.
5. The Lettermint delivery edge and Dashboard handoff are implemented against that foundation.
6. Website #1737 becomes the first Preview pilot.
7. Website #1734, #1735, and #1736 follow only after the clinic-registration pilot has proved the shared path.

The native GitHub dependencies remain the planning authority. This document does not replace their parent or blocker
relationships.

## Exit criteria for the foundation implementation

The future foundation implementation is complete only when:

- product callers can submit only a closed typed command through a Payload-independent port and receive only the
  acceptance result after commit;
- the outbox and first event share the triggering Payload transaction when possible;
- storage constraints prevent duplicate logical operations and duplicate provider events;
- the worker claim, exact-payload retry, deadline, scrubbing, and retention contracts pass against test Postgres;
- both collections remain unreachable through normal Payload surfaces;
- Local, test, and CI prove zero external delivery, link-generation, and PostHog traffic, while Preview and Production
  prove that missing real adapters fail closed without a fake fallback;
- the cache architecture records `no-public-impact` and no public invalidation wiring exists;
- no real provider, flow, Dashboard, Preview, or Production behavior has entered the change.

## Stop conditions

Stop and obtain a new explicit decision if implementation would require:

- a command outside the nine approved types;
- caller-provided recipient, link, template, sender, content, retry, or idempotency data;
- direct sending from a request handler;
- cross-database atomicity without a recoverable intent;
- a third collection, public collection access, Admin workflow, or public delivery-status surface;
- application-level encryption or a new secret-rotation design;
- a different retry count, delay schedule, lease duration, delivery deadline, or state;
- a public cache, cache tag, invalidation owner, Redis, or another remote coordination store;
- a real provider or Supabase network call in Local or CI;
- a Production retention value without written Legal and Privacy approval;
- a Dashboard credential that grants Supabase service-role or Lettermint access.
