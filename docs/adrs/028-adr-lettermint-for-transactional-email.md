# ADR: Lettermint for Transactional Email

## Status

| Name | Content |
| --- | --- |
| Author | Sebastian Schütze |
| Version | 0.1 |
| Date | 11.09.2026 |
| Status | Accepted |

## Context

findmydoc needs one platform-wide approach for transactional email before authentication and product notifications
expand across the Website and Clinic Dashboard. Supabase Auth currently creates and sends staff invitations and password
recovery emails. Product communication has no shared delivery module. Templates, delivery state, idempotency, provider
events, and operational ownership therefore have no common contract.

This decision covers authentication, security, account, and neutral product-notification emails. It excludes marketing,
newsletters, sales outreach, inbound email, and the content or trigger design of individual messages.

The provider research used Resend as the developer-experience benchmark and compared five European candidates.
Lettermint, based in the Netherlands, combines EU email infrastructure with a typed Node.js integration, direct sending
API, 24-hour provider idempotency, signed webhooks, test addresses, and project isolation. It retains each complete
submitted message for 28 days. Scaleway Transactional Email has a strong EU position and a more established operator,
but its API remains labelled `v1alpha1`, its reviewed documentation did not define client-controlled idempotency, and
delivery events require Topics and Events. Flowmailer is a more expensive enterprise product. Mailjet and Brevo add
broader contact, marketing, or CRM data processing. Resend primarily processes email data in the United States.

The architecture must keep templates in code, prevent lost and duplicate messages, minimize healthcare-adjacent data,
separate environments, and permit later extraction from the Website without requiring a separate service now.

## Decision criteria

The comparison uses `+1` for a clear advantage, `0` for an acceptable or non-decisive fit, and `-1` for a material
disadvantage. EU processing alignment is a hard constraint, so a stronger total cannot compensate for a `-1` in that
column.

| Provider | EU processing | Developer workflow | Delivery safeguards | Operating effort | Narrow data scope |
| --- | ---: | ---: | ---: | ---: | ---: |
| Lettermint | +1 | +1 | +1 | +1 | +1 |
| Scaleway Transactional Email | +1 | 0 | -1 | -1 | +1 |
| Flowmailer | +1 | 0 | 0 | 0 | +1 |
| Mailjet | +1 | 0 | 0 | 0 | -1 |
| Brevo | +1 | 0 | 0 | 0 | -1 |
| Resend | -1 | +1 | +1 | +1 | +1 |

The matrix records the decision drivers rather than claiming numerical precision. Lettermint is the only reviewed
candidate that clears the EU constraint while scoring positively across the remaining criteria.

## Decision

We will use Lettermint as the sole primary transport provider for findmydoc transactional email.

We will not provision a hot fallback or maintain a second provider integration. If severe privacy, contractual,
reliability, support, deliverability, or cost problems appear after implementation, we will pause affected sending and
open a new decision. Scaleway Transactional Email is the first researched candidate to reconsider, not a preconfigured
failover.

We will send through the Lettermint API. Supabase will only generate authentication action links. It will no longer
render or send findmydoc email. Templates will live in the findmydoc repository as typed React Email components and
render to HTML and plain text when a message is prepared. The repository will remain the canonical template source even
if Lettermint later adds a suitable template-deployment capability.

We will build transactional email as a deep module inside the Website runtime. Its small interface will accept only a
closed set of approved domain commands. Callers cannot choose a provider, template, sender, subject, rendered body,
retry policy, or idempotency key. The module will hide link generation, template rendering, outbox persistence,
provider submission, retry classification, content cleanup, webhook processing, suppression, logging, and monitoring.

The authentication domain owns whether an authentication flow is allowed, its link type, the user and clinic context,
and its callback target. Callback targets come from environment-specific server configuration and cannot be supplied
by callers. The transactional email module owns preparation and delivery after it accepts an approved command.

Payload will persist the outbox through an internal adapter. The collection will be hidden from Payload Admin, deny
normal collection access, and expose neither REST nor GraphQL endpoints. Payload is a storage implementation, not part
of the module's external interface. The Clinic Dashboard will use focused server-to-server capabilities and will hold
neither a Supabase service-role credential nor a Lettermint token. The Website authenticates these calls, authorizes
the actor and clinic, and derives recipient and message context server-side. Public recovery requests remain
non-enumerating, abuse-protected, and limited to the recovery command. The module may move to a separate deployment
later without changing its domain commands.

Every message will enter a durable outbox before delivery. A state-dependent outbox entry and its triggering Payload
mutation must commit atomically when they share the Payload database. A workflow that spans Supabase and Payload must
instead persist a recoverable intent and reconcile interrupted progress. findmydoc will prevent duplicate outbox
entries with a stable business-operation key and assign one opaque provider idempotency key to each logical email.
Every retry must reuse that key and the exact prepared payload. Lettermint's 24-hour idempotency window is a second
guard; the outbox remains the durable authority.

Authentication commands carry a latest-delivery time derived from the action link's validity. The module must not
submit or retry the message after that time. It marks the command expired, and a later user action creates a new link,
logical message, and idempotency key. This ADR does not set exact link lifetimes, retry delays, or safety margins.

The outbox may retain the recipient, rendered content, and authentication link only while the message remains
deliverable and within its approved retention period. It will remove those fields when Lettermint accepts the message.
Terminal, cancelled, or expired payloads become eligible for scrubbing. Before preparing another message, the module
will scrub eligible fields whose retention period has elapsed. This opportunistic cleanup does not require a separate
cleanup job. An ambiguous send may be retried automatically only with the unchanged payload while provider idempotency
still applies. It must not silently become a new send.

After scrubbing, the outbox may retain only operational metadata and a keyed recipient digest for delivery correlation
without a plaintext address. The implementation must define the metadata retention period, the dedicated key's
ownership, and its rotation policy before Production. Legal approval covers the retention period; this ADR does not set
its exact duration.

Messages will contain no health data, inquiry or conversation text, attachments, or sensitive values in subjects,
tags, metadata, or logs. Product notifications will contain a neutral event description and a link to the authenticated
product. Authentication messages will contain only the information required for the flow and a short-lived, single-use
Supabase action link.

Open and click tracking will remain disabled. Signed delivery, bounce, complaint, failure, and suppression events will
remain enabled and will be processed idempotently. The webhook adapter will verify each signature against the unmodified
request body and the project-specific secret, reject stale or replayed events, and support secret rotation. Exact
verification windows are outside this decision.

Production and Preview will use separate Lettermint projects and credentials. Preview will send only to approved test
recipients. Local development and CI will use a fake adapter and will never send external email.

We accept Lettermint's fixed 28-day active retention of the complete message and the DPA's allowance for encrypted,
access-restricted backup copies for up to 14 additional days after active deletion. DPA, subprocessors, support access,
security evidence, the processing record, and privacy notices require review before Production. Written Legal approval
is a release gate. The review will decide whether privacy-notice or cookie-consent text must change; this ADR does not
decide legal wording.

## Consequences

- **Positive:** findmydoc gets the closest researched European alternative to Resend's developer experience while
  keeping the documented email-data infrastructure and subprocessors in the EU.
- **Positive:** templates and delivery behavior remain versioned with the applications instead of being split across
  Supabase and a provider dashboard.
- **Positive:** one narrow interface concentrates delivery, privacy, retry, and provider complexity in a deep module
  that can move to another deployment later.
- **Positive:** a durable outbox and two idempotency layers protect against lost messages and ordinary duplicate sends.
- **Negative:** Lettermint is a younger provider without a generally published availability SLA and has documented
  recent incidents. Outages can delay authentication and product email.
- **Negative:** Lettermint retains complete messages for 28 days, with limited residual backup retention, and findmydoc
  cannot configure a shorter self-service period today.
- **Negative:** findmydoc must operate a worker, webhooks, suppression handling, monitoring, cleanup, and the migration
  away from Supabase email delivery.
- **Negative:** opportunistic outbox cleanup can retain expired payloads until the next message is prepared. The privacy
  review must approve that behavior or require a stronger enforcement mechanism before Production.
- **Negative:** one provider without hot failover favors simpler operation over immediate continuity during a severe
  incident.
- **Neutral:** Payload stores internal outbox records, but no person receives a Payload Admin workflow or collection
  permission for them.
- **Neutral:** accepting an email command means the outbox recorded it; it does not mean the recipient server delivered
  it.

## Alternatives considered

- **Supabase with Lettermint SMTP:** rejected because Supabase would continue to own authentication templates and
  delivery, bypassing the central outbox.
- **Supabase Send Email Hook:** rejected because Supabase is limited to action-link generation and delivery belongs in
  the Website module.
- **Resend:** rejected because its primary US processing and broader US subprocessor chain do not match the chosen EU
  preference.
- **Scaleway Transactional Email:** not selected because its documented developer contract requires more integration
  work. It becomes relevant only after severe Lettermint problems trigger a new decision.
- **Flowmailer, Mailjet, or Brevo:** not selected because they add enterprise cost and complexity, sensitive-data
  contract friction, or broader marketing and CRM processing.
- **A separate email service:** deferred because it adds another deployment and operating burden before independent
  scaling or ownership requires one. The deep module keeps later extraction possible.
- **Direct sends from request handlers or hooks:** rejected because transient failures and ambiguous timeouts would
  lose messages or create duplicates without a durable application-owned record.

## More information

- [FounderOps management issue #374](https://github.com/findmydoc-platform/management/issues/374)
- [Nygard: Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [Lettermint European email infrastructure](https://lettermint.co/european-email)
- [Lettermint DPA](https://lettermint.co/dpa)
- [Lettermint subprocessors](https://lettermint.co/subprocessors)
- [Lettermint Sending API](https://lettermint.co/docs/api-reference/sending/send)
- [Lettermint idempotency](https://lettermint.co/docs/platform/emails/idempotency)
- [Lettermint webhooks](https://lettermint.co/docs/platform/webhooks/introduction)
- [Lettermint data retention](https://lettermint.co/docs/platform/emails/data-retention)
- [Lettermint status history](https://status.lettermint.co/history)
- [Supabase administrative link generation](https://supabase.com/docs/reference/javascript/auth-admin-generatelink)
- [React Email rendering](https://react.email/docs/utilities/render)
- [ADR 004: Custom authentication strategy](./004-adr-custom-authentication-strategy-supabase-payloadcms.md)
- [ADR 010: Structured logging approach](./010-structured-logging-approach.md)
- [ADR 025: Direct staff authentication collections](./025-adr-direct-staff-auth-collections.md)
- [ADR 026: Standalone Clinic Dashboard BFF architecture](./026-adr-standalone-clinic-dashboard-bff-architecture.md)

## Superseded by

Not superseded.
