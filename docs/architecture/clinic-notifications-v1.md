# Clinic notifications v1

Website owns the closed `clinic-notifications-v1` contract. The independent synthetic examples in `tests/fixtures/clinic-notifications-v1.json` are copied into Dashboard contract acceptance; neither application imports the other's runtime.

Clients send `X-Findmydoc-Clinic-Notifications-Contract: clinic-notifications-v1`. Website confirms installed contract support through `X-Findmydoc-Clinic-Notifications-Support`. This additive header does not replace inquiry negotiation or change bootstrap bodies. Contract support does not mean capture is active or an environment has passed operational acceptance.

GET `/api/clinic-dashboard/notifications` and Dashboard GET `/api/notifications` accept `mode=summary` or `mode=page&view=unread|all`, with an optional opaque continuation cursor. Summary and initial pages carry `unreadCount` and `nextUnreadCountChangeAt`; continuations carry neither. Each success includes the contract version and authoritative UTC `serverTime`.

Items contain `kind`, `presentationId`, permitted `display`, an exact typed `destination`, and complete `members`. Members contain immutable notification identity, schema version, typed source record and source occurrence, event time, exact ninety-day expiry, and personal read time. The source record and destination must agree. An unread patient-message group contains only unread `patient_message_received` members for one inquiry.

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

Current authorization and individual expiry precede grouping. All personally unread patient messages for one inquiry form one complete entry. The group sorts by its newest member, while members sort by occurrence time and deterministic source identity. All keeps unread groups and presents each acknowledged message individually. The complete unread count gives each group one. Its next count change occurs when its last eligible unread member expires, unless another unread entry expires earlier. Membership can change before that count deadline.

Opening and marking retain the complete represented IDs. A later arrival belongs to a subsequent group and remains unread after the original selection is acknowledged. The oldest represented message uses the existing normal-detail timeline ID as an optional anchor. Its absence falls back to the exact inquiry heading without an additional source read. Private collection scans use a fixed native ID upper bound and keyset iteration to prevent offset movement from concurrent inserts or deletion; this is independent of the public continuation cursor.

Display contains an event label and optional currently permitted name, rating, or outcome. It excludes content, attachments, moderation reasons, and arbitrary fields. Destinations use an inquiry or review ID and optional typed message, response, appeal, or occurrence anchor. Closed validation rejects unknown versions, variants, outcomes, fields, and mismatched membership.

Pages contain at most 25 complete entries and 524,288 serialized bytes. Complete groups are never split. An entry that cannot fit in an empty page produces `PAYLOAD_TOO_LARGE`. POST `/api/clinic-dashboard/notifications/read` and Dashboard POST `/api/notifications/read` accept only a fixed `notificationIds` selection, bounded at 4 MiB of complete request bytes. The command never splits or widens the selection. Empty, missing, expired, inaccessible and already-read selections succeed without disclosure; loss of clinic access rejects the command. Personal receipts are atomic and preserve the first successful `readAt` across repetition. Its success contains `acknowledged: true`; errors distinguish `not_committed` from `unknown`.

Acknowledgement eligibility uses the final atomic server decision immediately before the native commit call, after preparing receipts and while current authorization is serialized. Recheck clinic access, current authorization, membership, and expiry at that decision. Skip missing, expired, inaccessible, and already-read members without disclosing exclusions. All remaining eligible unread members receive receipts atomically or none receives a new receipt; existing receipts retain their first `readAt`. Loss of entire clinic access rejects the action.

A decision before `expiresAt` may finish committing afterward. A decision at or after `expiresAt` cannot create a new receipt. This boundary does not guarantee the physical database commit time. Feed visibility, counts, and grouping end exactly at `occurredAt + 90 days`, independently of receipt completion or physical cleanup. The user approved this clarification on 2026-10-14; [ADR 035](../adrs/035-adr-notification-acknowledgement-decision-time.md) records the trade-off.

Errors contain the contract version and a closed `error.code`: `UNAUTHENTICATED`, `CLINIC_ACCESS_DENIED`, `CONTENT_ACCESS_DENIED`, `INVALID_INPUT`, `REQUEST_REJECTED`, `TARGET_UNAVAILABLE`, `CURSOR_INVALID`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `SERVICE_TIMEOUT`, `CONTRACT_INCOMPATIBLE`, or `PAYLOAD_TOO_LARGE`. Throttling includes a valid Retry-After. No raw upstream body is returned.

Storage is additive and private-live. Cache impact is `no-public-impact`, classified as private operational storage. Capture remains inactive by default, with a persisted serialization boundary. Isolated tests may activate it. No historical backfill or hosted activation is part of the foundation slice.

Acknowledgements and native access writers serialize through independent private clinic and staff authorization keys. The environment capture control retains its separate activation key; retention owns its own key. Clinic membership changes lock old and new clinic keys, while ordinary inquiry progress changes remain independent. The hooks run before native document reads and guard bulk operations against continuing after the transaction is lost. No public cache, invalidation event, or business progress mutation is added.

Permanent staff deletion removes only that reader's receipts in the same native deletion transaction. Ordinary offboarding and reassignment preserve personal receipts. Cleanup failures roll back both the staff deletion and all receipt changes; occurrences remain independent.

The additive clinic-scope migration keeps the existing clinic relationship nullable and backfills immutable scalar `clinicScopeId` from its original value. Feed and acknowledgement authorization use the scalar scope, so permanent clinic deletion can clear the compatibility relationship without erasing occurrence history. The backfill is idempotent, verifies complete coverage and preserves occurrence identities, timestamps and personal receipts. Storage stays nullable for deployment compatibility; new occurrence writes require a valid scalar scope. Rollback retains the expanded shape because deleted clinic relationships cannot be restored. Required-column hardening and compatibility-field removal belong to a later release.
