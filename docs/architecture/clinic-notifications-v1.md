# Clinic notifications v1

Website owns the closed `clinic-notifications-v1` contract. The independent synthetic examples in `tests/fixtures/clinic-notifications-v1.json` are copied into Dashboard contract acceptance; neither application imports the other's runtime.

Clients send `X-Findmydoc-Clinic-Notifications-Contract: clinic-notifications-v1`. Website confirms installed contract support through `X-Findmydoc-Clinic-Notifications-Support`. Requests also send `X-Findmydoc-Clinic-Scope-Contract: clinic-scope-v1`. Notification support and inquiry negotiation remain separate from the person-scoped bootstrap contract. Contract support does not mean capture is active or an environment has passed operational acceptance.

GET `/api/clinic-dashboard/notifications` and Dashboard GET `/api/notifications` accept `mode=summary` or `mode=page&view=unread|all`, with an optional opaque continuation cursor. Summary and initial pages carry `unreadCount` and `nextUnreadCountChangeAt`; continuations carry neither. Each success includes the contract version and authoritative UTC `serverTime`.

Items contain `kind`, `presentationId`, `clinic: { id, name }`, permitted `display`, an exact typed `destination`, and complete `members`. Clinic IDs are stable and names come from the current authorized clinic record, never occurrence snapshots. Each presentation has exactly one source clinic. Members retain their existing immutable shape. Members contain immutable notification identity, schema version, typed source record and source occurrence, event time, exact ninety-day expiry, and personal read time. The source record and destination must agree. An unread patient-message group contains only unread `patient_message_received` members for one source clinic and inquiry.

| Semantic event | Source occurrence | Outcome |
| --- | --- | --- |
| `inquiry_created` | `inquiry_audit` | None |
| `patient_message_received` | `patient_message` | None |
| `review_published` | `review_transition` | None |
| `clinic_response_decided` | `response_decision` | `approved`, `rejected`, `blocked` |
| `review_appeal_decided` | `review_appeal_decision` | `upheld`, `rejected` |
| `inquiry_restricted`, `inquiry_restored` | `inquiry_moderation_event` | None |
| `inquiry_appeal_decided` | `inquiry_moderation_event` | `confirmed`, `lifted` |
| `review_withdrawn`, `review_removed` | `review_transition` | None |

Patient messages are captured in the existing authorized communication transaction, using the immutable message ID and persisted message creation time. Initial inquiry text, clinic replies, internal notes and standalone attachment uploads do not create message occurrences. An attachment-only patient send does. Guest initial text remains an inquiry occurrence; guest inquiries have no external-reply workflow.

Current authorization and individual expiry precede grouping. All personally unread patient messages for one source clinic and inquiry form one complete entry. The group sorts by its newest member, while members sort by occurrence time and deterministic source identity. All keeps unread groups and presents each acknowledged message individually. The complete unread count gives each group one. Its next count change occurs when its last eligible unread member expires, unless another unread entry expires earlier. Membership can change before that count deadline.

Opening and marking retain the complete represented IDs. A later arrival belongs to a subsequent group and remains unread after the original selection is acknowledged. The oldest represented message uses the existing normal-detail timeline ID as an optional anchor. Its absence falls back to the exact inquiry heading without an additional source read. Source projections are deduplicated only within one feed scan or locked acknowledgement phase by source clinic and record. Inquiry appeal decisions additionally retain the exact event and outcome key. Preflight, locked writes and later requests do not share cached authorization. Private collection scans use a fixed native ID upper bound and keyset iteration to prevent offset movement from concurrent inserts or deletion; this is independent of the public continuation cursor.

Display contains an event label and optional currently permitted name, rating, or outcome. It excludes content, attachments, moderation reasons, and arbitrary fields. Destinations use an inquiry or review ID and optional typed message, response, appeal, or occurrence anchor. Closed validation rejects unknown versions, variants, outcomes, fields, and mismatched membership.

Pages contain at most 25 complete entries and 524,288 serialized bytes. Complete groups are never split. An entry that cannot fit in an empty page produces `PAYLOAD_TOO_LARGE`. POST `/api/clinic-dashboard/notifications/read` and Dashboard POST `/api/notifications/read` accept only a fixed `notificationIds` selection, bounded at 4 MiB of complete request bytes. The command never splits or widens the selection. Empty, missing, expired, inaccessible and already-read selections succeed without disclosure; complete loss of eligible clinic access rejects the command. Personal receipts are atomic and preserve the first successful `readAt` across repetition. Its success contains `acknowledged: true`; errors distinguish `not_committed` from `unknown`.

Continuation cursors are signed, opaque, and bound to contract version, personal staff principal, and view. They contain no selected clinic or frozen authorized-clinic list. Each request derives the currently eligible clinic union from the person's current local or group assignment, then reevaluates expiry, source visibility, grouping, and order before selecting entries older than the cursor key. There is no stored history snapshot: a new message can move an unread group ahead of a cursor, so clients refresh from the first page to see its current position. A page may contain fewer than 25 entries because of the serialized byte limit; the cursor always resumes after the last complete entry returned. A malformed, tampered, or differently scoped cursor returns `CURSOR_INVALID`.

Acknowledgement eligibility uses the final atomic server decision immediately before the native commit call, after preparing receipts and while current authorization is serialized. Recheck clinic access, current authorization, membership, and expiry at that decision. Skip missing, expired, inaccessible, and already-read members without disclosing exclusions. All remaining eligible unread members receive receipts atomically or none receives a new receipt; existing receipts retain their first `readAt`. Loss of all eligible clinic access rejects the action. A fixed selection may span clinics; currently inaccessible members are skipped while the remaining eligible members commit atomically. Personal receipts survive reassignment and become visible again when the original clinic returns to the current authorized set.

A decision before `expiresAt` may finish committing afterward. A decision at or after `expiresAt` cannot create a new receipt. This boundary does not guarantee the physical database commit time. Feed visibility, counts, and grouping end exactly at `occurredAt + 90 days`, independently of receipt completion or physical cleanup. The user approved this clarification on 2026-10-14; [ADR 035](../adrs/035-adr-notification-acknowledgement-decision-time.md) records the trade-off.

Errors contain the contract version and a closed `error.code`: `UNAUTHENTICATED`, `CLINIC_ACCESS_DENIED`, `CONTENT_ACCESS_DENIED`, `INVALID_INPUT`, `REQUEST_REJECTED`, `TARGET_UNAVAILABLE`, `CURSOR_INVALID`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `SERVICE_TIMEOUT`, `CONTRACT_INCOMPATIBLE`, or `PAYLOAD_TOO_LARGE`. Throttling includes a valid Retry-After. No raw upstream body is returned.

An eligible person with no clinics receives an empty personal feed and zero count. Acknowledgements require at least one currently eligible clinic. Personal URLs are independent of the active Dashboard clinic.

Storage is additive and private-live. Cache impact is `no-public-impact`, classified as private operational storage. Capture remains inactive by default, with a persisted serialization boundary. Isolated tests have a request-bound, test-only activation helper that rejects hosted environments. The authenticated [hosted capture operation](#hosted-capture-operation) supplies preparation, explicit activation and readonly reconciliation. Its availability does not establish Preview or Production acceptance. Neither path imports historical events.

## Hosted capture operation

GET `/api/internal/clinic-notifications/capture` prepares or reads back the single environment boundary without creating storage. POST on the same path activates it. Both require a currently stored PlatformStaff admin or support principal; a stale authenticated role is insufficient. The private control collection remains hidden, with ordinary REST and GraphQL disabled. Neither group management nor Dashboard clinic access grants this operation.

Preparation returns `environment`, `runtimeRevision`, `contractVersion`, `active`, `activatedAt` and `expectedState`. The environment must agree exactly across the server runtime policy, `DEPLOYMENT_ENV` and `VERCEL_ENV`, and must be Preview or Production. The revision comes from the installed runtime's forty-character `VERCEL_GIT_COMMIT_SHA`; missing or inconsistent runtime identity fails closed. The state fingerprint binds that environment, revision, notification contract and boundary identity/state. Source nonce updates do not invalidate preparation. The fingerprint is an expected-state comparison, not a credential or an approval token.

The operator entry is the existing authenticated Website Payload Admin session and its browser developer console. No additional account, service credential or Ops runner is required. Use the matching authorized Website origin. Preparation is readonly:

```js
const capturePath = '/api/internal/clinic-notifications/capture'
const preparedResponse = await fetch(capturePath, { credentials: 'same-origin', cache: 'no-store' })
if (!preparedResponse.ok) throw new Error('Capture preparation rejected; inspect the closed error code.')
const preparedCapture = await preparedResponse.json()
```

Review the returned environment, runtime revision, contract and boundary against the matching prepared applications and the dated acceptance evidence. D210 requires Preview qualification; D211 additionally requires the user's explicit chat approval before Production activation. These are existing delivery gates, not an added product approval workflow. Only after the applicable authorization, submit the explicit transition:

```js
const activationResponse = await fetch(capturePath, {
  method: 'POST',
  credentials: 'same-origin',
  cache: 'no-store',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'activate',
    environment: preparedCapture.environment,
    runtimeRevision: preparedCapture.runtimeRevision,
    expectedState: preparedCapture.expectedState,
  }),
})
const captureResult = await activationResponse.json()
```

POST accepts only those four fields, at most 2,048 request bytes, from the exact configured HTTPS Website origin. JSON and exact Origin validation preserve the existing same-origin session boundary; no new secret, signature, cross-origin exception or second approver is introduced. All responses, including errors, use `private, no-store` and vary by Authorization and Cookie. Do not copy session material into commands, URLs, logs or evidence.

The native Payload create or by-ID update owns one outer transaction. Existing controls acquire the same `notification-center` nonce serialization used by source producers in `beforeOperation`, before Payload reads its predecessor. A missing center is created through the native unique-key insert; a concurrent first creator may cause a conflict, without an automatic retry. A private request-identity capability admits only this command. Hook checks retain the original active native session and reread the current operator, runtime identity and boundary. The final check runs in `afterOperation` before native commit. No adapter transaction controls, SQL, isolation change or new retry owner are added.

`activatedAt` is server-derived under that serialized owner. It is persisted atomically with activation, not supplied by the operator or backdated. It records the server decision phase, not a guarantee about physical database commit time. A delayed successful commit retains that timestamp. A source that commits before activation stays ineligible and is never backfilled; a later qualifying source transition uses the existing producer protocol. A matching prepared active replay returns `already_active` and preserves the first timestamp without writing. Reset, deactivation, identity replacement and timestamp replacement are unavailable.

Closed errors are `CAPTURE_ACCESS_DENIED`, `CAPTURE_INVALID_INPUT`, `CAPTURE_CONFLICT` and `CAPTURE_UNAVAILABLE`. A rejected preparation reports `not_committed`. A submitted native operation whose commit or rollback is uncertain reports `unknown`; cleanup success is not rollback evidence. Do not automatically repeat a submitted request. Use authenticated GET to read the durable boundary and reconcile the desired final state. Readback cannot identify which concurrent or unconfirmed request caused an activation. Controlled diagnostics contain technical operation, environment, contract, result and transaction outcome, never raw failures, request bodies, session material or business records. Diagnostic sink failures do not reverse a result or trigger replay.

The code and local tests do not qualify a hosted environment. Preview and Production still require their own paired deployment, all seven producer paths, retention execution, diagnostic retention/access, source-to-browser observations and D239/D240 acceptance. No hosted activation is claimed by this implementation.

## Source ownership and lifecycle

Acknowledgements and native access writers serialize through independent private clinic, group and staff authorization keys. The receipt command acquires the initial clinic union, group assignment and personal staff barriers before rereading current access in its one outer transaction. If a preceding committed grant adds candidates, it acquires the missing clinic and group keys and rereads access until every candidate is covered. A fresh final source projection and access check precede the expiry decision. The environment capture control retains its separate activation key; retention owns its own key. Clinic membership changes lock old and new clinic keys, while ordinary inquiry progress changes remain independent. The hooks run before native document reads and guard bulk operations against continuing after the transaction is lost. No public cache, invalidation event, or business progress mutation is added.

Permanent staff deletion removes only that reader's receipts in the same native deletion transaction. Ordinary offboarding and reassignment preserve personal receipts. Cleanup failures roll back both the staff deletion and all receipt changes; occurrences remain independent.

Review publication capture belongs to native collection hooks, covering Admin, REST and Local API writes, including bulk update/delete. A protected publication-evidence marker and positive native version history distinguish first publication from correction, reapproval or restore. Its marker timestamp records when evidence was established; it does not invent an earlier publication time. New qualifying transitions carry their own immutable source identity and effective time. Private append-only `reviewPublicationTransitions` facts join the source transaction and survive permanent deletion through scalar review and clinic identities, without retaining review content. Source, versions, facts and notification writes roll back together; a lost native session cannot return late success or continue bulk writes in autocommit. Trusted seed snapshots and ordinary/no-op saves create no notifications.

Native review writers acquire old and new clinic authorization keys before reading their predecessor, alongside the independent activation guard. Current safe review projections alone supply optional name and rating; unavailable, rejected, withdrawn, removed or trashed sources never restore historical display fields. An authorized generic occurrence may remain available and explicitly markable when its ordinary exact review target is unavailable. The new source facts and exact detail endpoint are `private-live`; cache impact is `no-public-impact`. Existing public review revalidation is unchanged. The generated additive review migration leaves existing rows and versions intact, and its rollback retains the expansion for data safety.

Review response approval, rejection, and blocking, plus final review appeal outcomes, use native workflow hooks. The final normalized source action time becomes the occurrence time. A private append-only `reviewDecisionTransitions` fact holds a unique transition ID, workflow reference, closed outcome, review/clinic scope, and event time in the same transaction as the workflow and canonical notification. Submission, interim appeal review, seed snapshots, repeated terminal saves, and ordinary edits create no decision occurrence. A final appeal decision never stands in for a separate public review measure. This collection is `private-live` with cache impact `no-public-impact`; it has no public cache tags or invalidation owner.

The additive clinic-scope migration keeps the existing clinic relationship nullable and backfills immutable scalar `clinicScopeId` from its original value. Feed and acknowledgement authorization use the scalar scope, so permanent clinic deletion can clear the compatibility relationship without erasing occurrence history. The backfill is idempotent, verifies complete coverage and preserves occurrence identities, timestamps and personal receipts. Storage stays nullable for deployment compatibility; new occurrence writes require a valid scalar scope. Rollback retains the expanded shape because deleted clinic relationships cannot be restored. Required-column hardening and compatibility-field removal belong to a later release.
