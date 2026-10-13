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

Display contains an event label and optional currently permitted name, rating, or outcome. It excludes content, attachments, moderation reasons, and arbitrary fields. Destinations use an inquiry or review ID and optional typed message, response, appeal, or occurrence anchor. Closed validation rejects unknown versions, variants, outcomes, fields, and mismatched membership.

Pages contain at most 25 complete entries and 524,288 serialized bytes. Complete groups are never split. An entry that cannot fit in an empty page produces `PAYLOAD_TOO_LARGE`. Personal marking accepts only a fixed `notificationIds` selection, bounded at 4 MiB, and is implemented by the subsequent marking ticket. Its success contains `acknowledged: true`; errors distinguish `not_committed` from `unknown`.

Errors contain the contract version and a closed `error.code`: `UNAUTHENTICATED`, `CLINIC_ACCESS_DENIED`, `CONTENT_ACCESS_DENIED`, `INVALID_INPUT`, `REQUEST_REJECTED`, `TARGET_UNAVAILABLE`, `CURSOR_INVALID`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `SERVICE_TIMEOUT`, `CONTRACT_INCOMPATIBLE`, or `PAYLOAD_TOO_LARGE`. Throttling includes a valid Retry-After. No raw upstream body is returned.

Storage is additive and private-live. Cache impact is `no-public-impact`, classified as private operational storage. Capture remains inactive by default, with a persisted serialization boundary. Isolated tests may activate it. No historical backfill or hosted activation is part of the foundation slice.
