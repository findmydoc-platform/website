# Transactional email suppression

[Website #1898](https://github.com/findmydoc-platform/website/issues/1898) introduced suppression, and
[Website #1907](https://github.com/findmydoc-platform/website/issues/1907) keeps it effective across digest-key
rotation and outbox deletion under
[ADR 028](../adrs/028-adr-lettermint-for-transactional-email.md) and the
[delivery-edge contract](transactional-email-lettermint-delivery-edge.md). The command port, activation registry,
provider resources, and hosted execution remain unchanged.

## Verified feedback and atomic persistence

The signed webhook boundary accepts the recipient only for hard-bounce and complaint feedback. It normalizes the
address with the existing shared helper and computes the current environment's versioned HMAC plus every explicitly
configured previous version through a private digest function. The inbound binding exposes neither digest keys nor
the send token. The raw address is discarded before the verified envelope reaches persistence. Invalid recipients
return the fixed invalid-webhook response.

Provider preparation stores the then-current `providerRecipientDigest` atomically with the immutable request and provider target.
This address-only HMAC is separate from `recipientDigest`, which preserves the foundation's synthetic identity-binding
check. The provider digest is immutable and survives content scrubbing. Correlation accepts that retained digest only
when it matches one current or explicitly configured previous candidate. A missing or mismatched retained digest
causes a mutation-free `provider-event-mismatch`, including on replay. New suppression still uses the current digest.
No plaintext backfill is introduced.

The existing owned serializable event transaction reads or creates one `transactionalEmailSuppressions` record for
the environment and digest. It keeps the stronger reason, with `spam-complaint` above `hard-bounce`. The first accepted
source timestamp remains fixed; the last timestamp is the maximum accepted source timestamp. Provider clocks never
choose the retained reason or outbox state. Distinct events can strengthen suppression after an earlier terminal
outbox outcome. Identical event replay does not write suppression again.

The suppression mutation, outbox changes, and provider result commit together. Serialization and the exact native
suppression unique conflict retry the complete transaction through the existing three-attempt helper. A failed
event write or COMMIT rolls back suppression too. Every suppression operation uses the same absolute deadline and
transaction-local controls from [ADR 030](../adrs/030-adr-bound-transactional-email-webhook-processing.md). An in-flight
COMMIT remains ambiguous after the five-second response boundary and reconciles through the provider event identity.

Soft bounces, failures, provider suppressions, policy rejections, and unsubscribed events create no local suppression.
Raw reason strings never determine the stored reason.

## Worker lookup and access

A worker with a verified provider binding uses the real suppression store before links, rendering, serialization,
and delivery, including prepared retries. It computes the current address digest and every explicitly configured
previous digest, then queries only its binding's environment. A previous-version hit creates or strengthens the
current-version equivalent in the same serializable transaction before returning `suppressed`; the previous record
remains. Native unique or serialization conflicts retry the complete transaction. A failed transaction leaves no
current-version record and grants no clearance. Synthetic decisions may withhold clearance but cannot override a
persisted match. Fake-only execution without a provider binding still requires an explicit synthetic decision.

The hidden collection denies normal Admin, REST, GraphQL, and Local API access, including `overrideAccess` and forged
contexts. A separate private identity binds each lookup to one digest, environment, and live transaction. Writes
require an exact one-use mutation grant. The ordinary outbox capability alone cannot read or write suppression.
There is no delete operation, version, draft, trash, soft-delete, seed, or management workflow. The public command
port exports none of these capabilities. Responses, logs, and exceptions contain neither addresses nor digests nor
raw reasons.

## Key-ring configuration and retirement

`LETTERMINT_RECIPIENT_DIGEST_KEY` supplies the current key for one hosted environment.
`LETTERMINT_PREVIOUS_RECIPIENT_DIGEST_KEYS` is an optional JSON object whose keys are reviewed, non-secret versions
and whose values are their environment-scoped secrets. Startup requires an exact match between those entries and the
versioned `digest-key` fingerprints in the reviewed registry. Unknown, missing, duplicated, cross-environment, or
fingerprint-mismatched versions fail closed. New outbox and suppression values always use the target's current
`digestKeyId`; previous keys are read-only compatibility inputs.

The fingerprint command records the target's current digest version and retains different versioned digest
fingerprints during rotation. Re-recording the same version replaces only that version. The current activation
preflight records both the current credential evidence and the complete previous-key evidence list, so a ring change
invalidates stale approval evidence.

The only supported retirement entrypoint is
`pnpm exec tsx scripts/lettermint-digest-key-retirement.ts --environment <preview|production> --version
<previous-version>`. It loads the
active hosted binding and reads the active Preview allowlist directly from
`LETTERMINT_PREVIEW_RECIPIENT_DIGESTS`; callers cannot substitute another binding or an empty list. In one
environment-scoped transaction it uses count-only private capabilities for retained outbox and suppression
references. Any non-zero storage or allowlist count raises `digest-key-retirement-blocked` with only the environment,
version, and counts, before the registry changes. A zero-reference proof atomically removes exactly the approved
previous fingerprint from the reviewed registry. The operator then removes the matching entry from
`LETTERMINT_PREVIOUS_RECIPIENT_DIGEST_KEYS` and records a newly approved activation preflight whose
`previousDigestKeys` evidence matches the reduced ring. The command reports only that the fingerprint was removed;
the deployment remains blocked until those two reviewed follow-up changes make startup validation pass. There is no
force parameter. Forced retirement requires the separate approved migration decision described by the delivery-edge
contract.

## Retention

Suppression does not inherit the outbox's 28-day retention policy. The normal sweep deletes terminal outbox records
and their events without reading, expiring, or deleting suppression. A retained suppression continues to block a new
operation after its originating outbox and event history are gone. The schema has no expiry, plaintext rehash source,
reversible ciphertext, deletion marker, or provider-removal state, and the runtime has no automatic cleanup path.

## Schema and rollback

The Payload-generated additive migration `20260927_091630_transactional_email_suppressions` creates the hidden
collection with closed Preview/Production, reason, and source enums, required timestamps, and the unique
`(runtimeEnvironment, recipientDigest)` index. It adds the nullable provider digest to the existing outbox.
Generated Payload types and the migration index include the same schema.

Both application versions can use the expanded schema. Existing records without the new digest cannot create
suppression from feedback; correlation fails closed. Hosted sending remains disabled. Roll back application code
while retaining the expanded schema. The generated down migration deletes suppression data and its correlation
column and is not a hosted rollback procedure.

## Cache decision

- Decision: `no-public-impact`.
- Dependency map: verified events write private suppression; the private worker reads it. No public route, page,
  discovery output, sitemap, or shared response consumes it.
- Read/write symmetry: `collection:private-operational` classifies the collection as `private-live`. It has no cache
  key, tag family, invalidation owner, planner event, affected public path, public surface, sitemap surface, or
  discovery surface. Neither reads nor writes use caching.
- Tests: collection contracts check the policy entry, exclusion from `CACHE_TAGGABLE_COLLECTIONS`, and tag-builder
  rejection alongside access denial.
- Stop conditions: a public consumer, new cache class, tag family, or invalidation behavior requires a new decision.

## Evidence

The real Next.js request and real Payload/PostgreSQL suite checks atomic creation, monotone updates, concurrent
conflicts, replay, digest mismatch, rotated correlation, previous-key materialization races and rollback, retirement
blocking, event-result rollback, ambiguous COMMIT reconciliation, and non-suppressing events. It also crosses the real
worker to prove suppression before preparation and delivery, store unavailability, Preview/Production separation,
and continued suppression after 28-day outbox deletion. The collection suite checks private access, absent lifecycle
surfaces, private-live cache classification, and the freshly migrated schema. Independent database observations keep
digest values out of assertion output. Network guards forbid external calls.
