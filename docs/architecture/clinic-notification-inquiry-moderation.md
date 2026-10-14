# Inquiry moderation notification capture

Website owns inquiry moderation decisions and their immutable audit events. The notification center records qualifying source transitions in the same native transaction and presents the closed [v1 contract](clinic-notifications-v1.md). Notification acknowledgement changes personal notification receipts only.

## Source transitions

| Persisted source transition | Notification event | Effective occurrence time |
| --- | --- | --- |
| A content, attachment, conversation or identity restriction is decided | `inquiry_restricted` | Source `decisionAt` |
| The existing reconciliation persists a timed measure ending | `inquiry_restored` | Original source `effectiveUntil` |
| An appeal is finally upheld or overturned | `inquiry_appeal_decided` | Source `appealDecidedAt` |
| A final appeal also ends a previously unended measure | A separate `inquiry_restored` | The earlier original deadline or actual measure ending |

The final appeal maps upheld to `confirmed` and overturned to `lifted`. Restoration and final outcome remain separate semantic events even when one immutable audit event establishes both facts. A reconciliation that already ended the measure prevents another restoration occurrence when the appeal is later decided.

Reports, access expansion, appeal submission, no-action decisions and ordinary updates do not produce these events. The private moderation collections expose no ordinary Admin, REST or GraphQL write path; the owning moderation commands and the existing reconciliation are the executable transition paths. The notification reader does not run moderation commands.

Occurrence identity and source audit identity remain immutable. Source timestamps determine both activation eligibility and exact ninety-day expiry; a delayed processor does not replace them with its processing clock. A source fact effective before capture activation is not imported by later reconciliation.

## Current visibility and personal outcomes

Restrictions and restorations use the inquiry feature's current notification visibility, independently of target detail availability. Final appeal outcomes additionally require the exact current affected clinic staff member, the recorded clinic appellant and the original immutable appeal-submission actor evidence. Another staff member in the same clinic receives no personal final outcome. A patient-only final outcome is not exposed to clinic staff.

The same member-aware projection runs during feed reads and acknowledgement decisions. Current clinic access remains required. Projection returns only permitted display fields; report descriptions, appeal text, reasons, target content and attachment metadata remain private. Notifications carry the exact inquiry destination.

## Transaction and failure boundary

Source commands serialize against the persisted capture activation barrier before reading the original transition state. Both plain moderation transactions and email-owned moderation transactions re-read the current actor and original case for each bounded retry. A capture failure rolls back the source case, immutable audit event and occurrence together. A serialization conflict can retry the complete protected command at most three times. An uncertain commit result is surfaced without replaying a potentially committed command.

Technical notification diagnostics contain only the closed operation, result, error code, elapsed time, attempt count and transaction outcome. Original errors, identities and moderation content do not enter this diagnostic adapter.

## Timed restoration availability

The existing moderation state calculation stops applying a measure at its deadline. Persisting the `measure-ended` audit event currently depends on the existing reconciliation scheduled after an authorized patient or clinic inquiry-detail request. A successful persisted reconciliation creates the restoration occurrence using the original deadline. Without such source activity, there is no independent timer guaranteeing immediate restoration-event persistence.

This implementation adds no moderation expiry job, queue or workflow and no notification-feed side effect. The independent five-minute [notification retention command](clinic-notification-retention.md) removes expired notification events and receipts; it does not reconcile source moderation measures. Environment qualification must preserve this distinction between source effectiveness and notification availability. Hosted capture and activation remain separate operational acceptance steps.

## Acceptance boundaries

Native integration exercises the ordinary source commands, persisted audit evidence, feed visibility and personal acknowledgement in an isolated database. Cross-app acceptance uses the same source commands, the authorized Dashboard BFF and rendered exact inquiry navigation. Browser stories cover the confirmed and lifted labels, distinct restoration history, unavailable or cancelled opening, mobile layout and themes.

The authority is [notification specification #200](https://github.com/findmydoc-platform/clinic-dashboard/issues/200) and [inquiry moderation ticket #206](https://github.com/findmydoc-platform/clinic-dashboard/issues/206).
