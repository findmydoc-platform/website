# Transactional email platform foundation

This document is the implementation contract for the shared transactional email foundation owned by the Website
runtime. [ADR 031](../adrs/031-adr-transactional-email-technical-activation-gates.md) is the current architecture
decision and retains the provider, outbox, and application-ownership decisions from
[ADR 028](../adrs/028-adr-lettermint-for-transactional-email.md).
The private `@findmydoc-platform/email-templates` package owns template components, copy, and typed props. The Website
owns recipient resolution, HTML and plain-text rendering, the outbox, worker, provider integration, and delivery state.
Package releases reach Website only through a reviewed exact-version dependency change.

The Website pins `@findmydoc-platform/email-templates@0.3.0` for a shared public-export contract. Only the package
root export is supported. The consumer test imports every published component, subject constant, and prop type through
that root, then checks the rendered synthetic template with typed fictional props. The Website script
`scripts/render-synthetic-email-template.mjs` uses Website's `@react-email/render` dependency to produce HTML and plain
text. This contract does not register a product command or invoke the outbox, worker, or a delivery adapter.
Production templates and flow activation require separate issues.

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
The committed `.npmrc` explicitly routes public packages to npmjs and `@findmydoc-platform` packages to GitHub
Packages. Keep the credential-level `scope` and `replaces-base` options unset so Dependabot uses that file;
[those options override the committed registry configuration](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#scope).
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

[Website issue #1846](https://github.com/findmydoc-platform/website/issues/1846) records the foundation design.
The implementation is in [the Website email module](../../src/features/transactionalEmail). The
[foundation specification at the retention decision](https://github.com/findmydoc-platform/website/blob/945153dbc9e63354fc93d4ff49631c377e189ece/docs/engineering/transactional-email-platform-foundation.md)
preserves the original test plan, implementation order, and delivery issue sequence.

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

The foundation layer itself does not include:

- the Lettermint adapter, webhook endpoint, suppression store, sender identity, DNS, or provider credentials;
- Preview or Production activation, which is composed by the delivery edge and command-specific product flows;
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

Product flows call the [public command port](../../src/features/transactionalEmail/index.ts). The
[Website integration](../../src/features/transactionalEmail/payloadIntegration.ts) binds the current Payload
request, authentication state, and transaction privately. The port exposes no Payload request or implementation type.

The [outbox](../../src/collections/TransactionalEmailOutbox.ts) and [event](../../src/collections/TransactionalEmailEvents.ts)
collections declare storage, indexes, and access guards. The email module owns delivery, retention, and worker policy.
The worker uses the same delivery interface for local fakes and hosted Lettermint. Template rendering also stays
inside the module.

## Public command interface

Use the [command port and receipt types](../../src/features/transactionalEmail/index.ts) with the
[validated command union](../../src/features/transactionalEmail/commands.ts).

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
- one command-specific authoritative source identity;
- a closed recipient slot where one source event can address more than one approved recipient role.

Callers do not provide `operationReference`. The module derives it centrally from the validated command. AuthAction,
Conversation message, and Moderation event references use fixed versioned forms. The already deployed Clinic
Registration command retains `String(registrationId)` so persisted operations and worker invariants keep the same key.
The normalized reference embeds no address, name, content, or secret.

The command never contains an email address, URL, sender, subject, rendered body, template data, provider choice,
retry setting, idempotency key, or free-form `metadata`, `context`, or arbitrary key-value object. Each flow issue owns
the exact command-specific identifiers when it implements its catalog entry.

The set of [command types](../../src/features/transactionalEmail/commands.ts) is closed.

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

The [Website catalog](../../src/features/transactionalEmail/payloadCatalog.ts) registers product flows with an
implemented source and package template. Hosted delivery requires separate [command activation](transactional-email-lettermint-delivery-edge.md#command-by-command-activation-registry).

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
recoverable intent and reconcile interrupted progress as retained by ADR 031. A flow implementation must stop and
obtain a specific work order if it cannot identify that durable intent.

## Logical and provider idempotency

The database has a unique constraint on `(commandType, operationReference)`. This is the durable authority for one
logical email operation. The deep module derives the reference from the command's authoritative identity before
storage access. After validation and authorization, command acceptance first returns an existing matching operation
when one is visible.

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
| `operationReference` | text | Stable module-normalized authoritative source reference; never sent to the provider |
| `commandPayload` | JSON, nullable after scrubbing | Serialized member of the closed typed command union; validated on every internal read and write; never queryable by callers; cleared by scrubbing |
| `runtimeEnvironment` | closed select | Captured deployment environment; operational only |
| `state` | closed select | Current state from the state model; indexed |
| `providerIdempotencyKey` | text | Module-generated opaque key; unique and immutable until hard deletion |
| `recipientAddress` | email, nullable | Resolved and stored at command acceptance; transient and scrubbed |
| `recipientDigest` | text, nullable | Versioned keyed digest stored at command acceptance; never logged |
| `providerRecipientDigest` | text, nullable | Immutable environment-keyed address digest stored with provider preparation for verified suppression correlation; never logged |
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

After every successful claim, including a reclaim or retry, the catalog entry revalidates current eligibility and
returns either an eligible preparation closure or a closed terminal suppression outcome. The worker compares the
current address and recipient-binding digest with the accepted values before it can invoke preparation. Changed
addresses or bindings map to `recipient-changed`; missing addresses or lost authorization map to `ineligible`; missing
domain sources map to `source-unavailable`; and obsolete domain state maps to `superseded`. Every expected result ends
as `suppressed`. The worker neither redirects the operation nor contacts a link or delivery adapter.

For a valid unprepared operation, the catalog-owned closure creates an action link where required, projects typed
props, selects the renderer, and returns HTML and plain text. The worker knows none of those product choices. It
persists the exact recipient and rendered payload before any provider call. A crash before that persistence may repeat
preparation because no delivery attempt has started. A crash after persistence may only reuse the stored payload.

Unexpected preparation exceptions end as `failed` with `preparation-failed`; they do not collapse into an expected
domain suppression outcome.

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
- `providerIdempotencyKey`, `recipientDigest`, `providerRecipientDigest`, and `providerMessageId`;
- `providerTeamId`, `providerProjectId`, and `providerRouteId`;
- `attemptCount` and `latestEventSequence`;
- `preparedAt`, `deliveryDeadline`, `lastAttemptAt`, `firstAmbiguousAt`, `providerAcceptedAt`, `terminalAt`, and
  `scrubbedAt`.

The associated event history retains only its already content-free schema, including safe outcome codes. The retained
business reference remains the deduplication authority, and the sequence counter remains the event-ordering authority.

The first implementation does not add application-level encryption for the transient fields. The collections remain
private and the fields have a short lifetime. If Legal or Security requires application-level encryption, work stops
for a separate key-management and rotation decision rather than adding custom cryptography inside the foundation.

Scrubbing remains opportunistic as retained by ADR 031. The worker runs the retention sweep before preparing another
message. The eventual runner must invoke that same worker entry point at least every 30 minutes, including when there
is no due message. The safety sweep runs first on every invocation. This cadence supplies enough scheduling margin for
the one-hour limit without a separate cleanup application. Issue #1847 owns the exact runner configuration but may not
weaken this maximum interval.

For a `queued` or `prepared` record past its `deliveryDeadline`, the safety sweep atomically clears the transient fields,
sets `state` to `expired`, and writes `terminalAt` and `scrubbedAt`. If an already terminal or provider-accepted record
somehow remains unscrubbed, the sweep clears its transient fields and writes `scrubbedAt` without replacing its
recorded outcome. The hard-deletion phase may run daily through the same entry point.

The retention contract is:

- transient delivery fields are scrubbed immediately at provider acceptance or another terminal outcome;
- a safety sweep scrubs any remaining transient fields no later than one hour after `deliveryDeadline`;
- scrubbed outbox metadata and its events become deletion-eligible 28 days after `terminalAt`;
- the daily sweep hard-deletes the outbox and its events within the following 24 hours.

The 28-day value follows the approved
[transactional email Product Spec](https://app.notion.com/p/3f4283c73e618101ba7edc7ee0530850).
Provider backup retention does not extend the active findmydoc outbox-history period. This product decision is not
Legal approval. Legal and Privacy review the value, processing purpose, HMAC key ownership and rotation policy, and deletion
mechanism in [management issue #396](https://github.com/findmydoc-platform/management/issues/396). As decided in
[ADR 031](../adrs/031-adr-transactional-email-technical-activation-gates.md), that governance review does not block the
technical activation and technical activation does not imply approval. Any resulting contract change requires its own
decision before deployment.

Suppression retention belongs to issue #1847 and is not governed by this 28-day value.

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

## Runtime evidence

- [Command acceptance and atomicity](../../tests/integration/transactionalEmail.acceptance.test.ts) ·
  [Transaction ownership and concurrency](../../tests/integration/transactionalEmail.transactions.test.ts)
- [Worker lease, preparation, and retry](../../tests/integration/transactionalEmail.worker.test.ts) ·
  [Event persistence](../../tests/integration/transactionalEmail.events.test.ts) ·
  [Scrubbing and retention](../../tests/integration/transactionalEmail.retention.test.ts)
- [Outbox collection permissions](../../tests/unit/access-matrix/transactionalEmailOutbox.permission.test.ts) ·
  [Event collection permissions](../../tests/unit/access-matrix/transactionalEmailEvents.permission.test.ts)

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
- a change to the committed Production retention value or processing contract without a separate explicit decision;
- a Dashboard credential that grants Supabase service-role or Lettermint access.
