# Clinic notification retention

The [notification specification](https://github.com/findmydoc-platform/clinic-dashboard/issues/200) and [retention ticket](https://github.com/findmydoc-platform/clinic-dashboard/issues/209) define this independent command. The public [v1 contract](clinic-notifications-v1.md) keeps logical expiry separate from physical removal.

Occurrence visibility and acknowledgement eligibility end exactly ninety days after `occurredAt`. Reads and commands enforce `expiresAt` independently of cleanup. The independent scheduled command physically removes expired occurrences and their personal receipts in its next successful execution; ordinary scheduling delay does not extend visibility.

## Scheduling and authority

Production Website schedules `/api/internal/clinic-notifications/retention` every five minutes. It accepts only its Production `CRON_SECRET` and matching hosted Production runtime. Preview Website instead exposes `/api/internal/clinic-notifications/preview-retention`, authenticated by `PREVIEW_NOTIFICATION_RETENTION_SECRET`; it refuses Production runtime.

The existing `apps/preview-email-scheduler` project has a separate `/api/notifications` function and five-minute cron. Its own `CRON_SECRET` authenticates the scheduler invocation. `SCHEDULER_ENVIRONMENT=preview`, `PREVIEW_NOTIFICATION_RETENTION_URL=https://preview.findmydoc.eu/api/internal/clinic-notifications/preview-retention`, and its Preview-only `PREVIEW_NOTIFICATION_RETENTION_SECRET` authorize one fixed, nonredirecting request. Neither notification route invokes the email worker, and the notification relay is independent of `/api/tick`.

These configurations prepare scheduling. No hosted scheduler, credential, capture activation, or diagnostic setting is qualified by a local test. Preview and Production operational acceptance remains separate under Clinic Dashboard #210 and #211. Provision only environment-scoped secret names and scopes; never place values in repository artifacts.

## Storage and cleanup

The existing private control collection stores a separate `notification-retention` row. Its scheduling watermark is independent of the capture activation row and capture nonce. The first observed execution establishes the scheduling baseline; subsequent executions detect unobserved five-minute slots. A later invocation can report a gap; code cannot report while no invocation executes.

A persisted, expiring lease prevents overlapping cleanup owners. Each bounded batch rechecks expiry and lease ownership within a native Serializable transaction, deletes receipts before their occurrences, validates the native session, and commits atomically. Failures roll back the current batch. Previously committed batches remain deleted; the next scheduled run retries remaining work. Budget exhaustion is incomplete work, not successful cleanup. Lease expiry permits recovery after a crashed process.

The last observed start and last fully successful completion remain separate. Structured runtime logs and PostHog errors contain only closed technical outcomes, elapsed time, attempts, missed-slot counts and aggregate deleted-record counts. Original errors, causes, identities and source content never enter the notification diagnostic adapter. Deletion counts include only confirmed committed batches. The transaction outcome describes the latest attempted transaction; earlier committed batches remain deleted when a later batch fails. Telemetry cannot change committed deletion.

Source capture, feed, summary and acknowledgement diagnostics also use a strict technical schema. Expected rejections remain informational. Handled operational failures emit error-severity logs and a controlled PostHog exception after transaction completion or rollback. The existing exception sender bounds its flush at 1.5 seconds; sink failure cannot change the command result.

## Cache impact

Decision: `no-public-impact`. Occurrences, receipts and operational control state are private-live catalog entries. Cleanup has no public loader, rendered page, sitemap or discovery dependency; it does not invalidate public caches. Focused tests cover private endpoint authentication, exact Preview delegation, scheduler environment isolation and real physical deletion/rollback through the agreed isolated database boundary. No new cache vocabulary is required.

## Migration

The Payload-generated retention-control migration is additive: six nullable operational fields and one enum. The previous application and the new application can use the expanded schema. It does not rewrite occurrence deadlines, remove source data or activate capture. Its generated down migration removes only these additions and requires the normal rollback review.
