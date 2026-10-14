# ADR: Notification acknowledgement decision time

## Status

| Name | Content |
| --- | --- |
| Version | 1.0 |
| Date | 14.10.2026 |
| Status | Approved by the user in the implementation chat |

## Background

Website/Payload owns notification occurrences and personal receipts. Each occurrence expires exactly ninety days
after `occurredAt`. A fixed acknowledgement selection must remain atomic, currently authorized, and idempotent.
The earlier specification described expiry when the atomic change takes effect without distinguishing the server
decision from physical database commit completion.

## Problem description

Payload 3.90.2 exposes native transaction begin, commit, and rollback, but no deferred commit-time validation hook.
Wall-clock time can pass `expiresAt` after the application calls commit. Serializable isolation cannot detect that
clock change, so an application check cannot guarantee that the physical commit completes before expiry.

## Considerations

A final server decision under the authorization barrier gives the command one explicit eligibility time within its
native transaction. It preserves atomic receipt writes and avoids a direct SQL exception. A database-enforced
deferred check would require a separate architecture exception and still would not prove that physical commit
completion precedes a wall-clock deadline. That alternative was not approved.

## Decision with rationale

On 2026-10-14, the user approved the final atomic server decision immediately before the native commit call as the
acknowledgement eligibility boundary. The command prepares receipt writes, then rechecks current clinic access,
authorization, membership, and expiry while authorization is serialized. Members that fail that decision receive
no new receipt. The remaining eligible unread members receive receipts atomically or none receives a new receipt;
existing receipts retain their first `readAt`.

A decision before an occurrence's expiry may finish committing afterward. A decision at or after expiry cannot
create a new receipt for that occurrence. The command's click time or initial read does not preserve eligibility.

## Consequences

The [v1 contract](../architecture/clinic-notifications-v1.md) uses this boundary for explicit marking, bulk selections,
and acknowledgement after successful destination opening. Tests distinguish expiry before the final decision
from delayed commit completion after a valid decision. A lost submitted response still has an unknown write
outcome unless non-commit is established.

Feed visibility, counts, and grouping end exactly at `occurredAt + 90 days`, even when an earlier decision is still
committing. The independent five-minute cleanup removes expired occurrences and their receipts in its next
successful scheduled execution. Cleanup must not leave orphaned receipts during concurrent acknowledgement.

## Technical debt

There is no physical commit-time guarantee. Future notification visibility writers must participate in the same
authorization barrier. This decision grants no direct SQL access, deployment, capture activation, or additional
reviewer authority.

## References

- [Notification specification #200](https://github.com/findmydoc-platform/clinic-dashboard/issues/200)
- [Dated approved decision](https://github.com/findmydoc-platform/clinic-dashboard/issues/200#issuecomment-6161446477)
- [Personal marking ticket #212](https://github.com/findmydoc-platform/clinic-dashboard/issues/212)
- [Retention contract](../architecture/clinic-notification-retention.md)
