# ADR: Supabase native-mail suppression

## Status

| Name    | Content           |
| ------- | ----------------- |
| Author  | Sebastian Schütze |
| Version | 1.1               |
| Date    | 01.10.2026        |
| Status  | Approved          |

## Background

[ADR 028](./028-adr-lettermint-for-transactional-email.md) selects Lettermint and limits Supabase's role in
transactional email to generating authentication action links. [ADR 031](./031-adr-transactional-email-technical-activation-gates.md)
retains that architecture and defines command-specific technical activation gates. ADR 028 rejects a Send Email Hook
as a delivery path, but does not distinguish delivery from a control that suppresses native Supabase mail.

Supabase's [Send Email Hook contract](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) replaces native
SMTP handling when enabled. Disabling the hook permits SMTP handling again when the email provider is enabled.
The [Postgres hook contract](https://supabase.com/docs/guides/auth/auth-hooks) supports an in-project function with
restricted Auth execution permissions. These mechanisms allow suppression without a second mail transport.

## Problem Description

Without an explicit boundary, a suppression hook can acquire templates, recipient authority, rendering, network
calls, retries, or fallback delivery. A repository declaration alone also cannot prove that the correct function is
bound in the intended Supabase project. Native delivery must stay suppressed through activation, configuration
drift, and rollback without weakening ADR 031's existing gates.

## Considerations

1. Supabase delivery through Lettermint SMTP or a sending hook retains a parallel preparation and delivery path.
   It bypasses the Transactional Email platform's command, Outbox, and delivery contract and remains rejected.
2. Relying only on administrative action-link generation leaves suppression implicit. It provides no explicit
   control over native send-capable Auth paths or environment configuration drift.
3. A no-op Postgres Send Email Hook separates native-mail suppression from delivery. Its function and permissions
   can be versioned while each project's actual binding is independently verified. It adds configuration evidence
   and operational responsibility but needs no network endpoint, provider credential, or rendering capability.

## Decision with Rationale

Lettermint remains the only transactional email transport. Supabase Auth only generates authentication action links
for the approved platform delivery path. A Supabase Send Email Hook is permitted solely as a no-op Postgres
suppression control. It acknowledges the hook invocation through the supported success contract and performs no
delivery. Hook success proves only that the native send request was suppressed, never that an email was delivered.

The hook must not render content, send mail, call Lettermint or any network service, select recipients, choose
templates, enqueue delivery, implement retries, or act as a fallback transport. It must not persist or log its
payload, recipient data, action links, tokens, or token hashes. Suppression requires no provider secrets or access to
application tables. The later implementation must restrict invocation to Supabase Auth through explicit function
and schema permissions, revoke public and client-role execution, and avoid elevated execution privileges.

### Ownership and state

Operations owns the suppression function, its grants, the Supabase desired-state configuration, and configuration
verification. This control has no product logic and belongs with the existing Operations reconciliation workflow.
The Website Auth domain owns affected Auth command availability and the inventory of native send-capable product
paths. The Transactional Email platform retains recipient resolution, preparation, templates, delivery,
Outbox state, retries, and delivery outcomes. Provider-event recipient suppression remains a separate platform
concern. The Clinic Dashboard receives neither suppression configuration authority nor provider credentials.

The Operations repository is the single source of the reviewed suppression implementation, permissions, and
environment configuration. Website keeps no duplicate implementation or authoritative configuration validator.
A declaration or migration in Git does not establish that a hosted hook is enabled. The
[Operations Supabase configuration runbook](https://github.com/findmydoc-platform/ops/blob/main/docs/supabase-auth-mail-config.md)
defines the implementation and reconciliation procedure.

The verified runtime state is each Supabase project's enabled Send Email Hook binding to that exact function,
together with its installed function definition and effective permissions. Verification compares actual state with
the reviewed Operations desired state. Configuration evidence records a content-free, environment-scoped fingerprint
covering the binding identity and enabled state, function definition, signature, and permissions. It also records
the reviewed Website and Operations revisions and verification result. Fingerprints identify configuration,
not recipients or token material. Credential fingerprints required by ADR 031 remain separate.

### Environment boundaries and activation

Preview and Production have separate Supabase projects and hook bindings. Each environment has its own ownership
record, suppression fingerprint, configuration evidence, verification result, activation decision, and rollback
record. Operations is accountable for configuration and its verification; the Website Auth owner remains accountable
for affected command availability and product-path coverage. An authorized operator applies only the approved
environment's configuration. The same reviewed desired state may be used in both projects, but evidence and approval
for Preview cannot satisfy Production checks. No credentials, bindings, or evidence are copied across environments.

Every affected Auth command must remain disabled until that environment's expected declaration exists and the
actual enabled binding, function, and effective permissions match it. Missing, stale, unverifiable, disabled, or
inconsistent suppression evidence fails closed. Configuration changes invalidate the previous verification;
detected drift disables affected commands and stops their preparation and dispatch until verification succeeds.
This control cannot enable a command on its own. All command-specific technical gates from ADR 031 still apply,
including the reviewed one-send-path release artifact. Verification covers native send-capable paths as well as
the platform's administrative action-link generation path; it does not assume link generation invokes the hook.

The Send Email Hook is project-wide. Before activation, the Website Auth owner must account for affected native
Auth email paths so that suppression cannot silently strand an unreviewed flow. The hook supplies no product flow
or replacement message. Preview verification uses controlled test identities and isolated configuration; Production
requires its own checks. Local and CI checks use isolated fixtures and send no external email. Configuration
evidence excludes secrets, recipient details, token material, private endpoints, and private hostnames.

### Rollback

Rollback disables the affected Auth commands and their preparation and dispatch in that environment while retaining
the enabled, verified no-op suppression binding. It never removes or disables the hook to recover native delivery,
re-enables native SMTP, or selects another transport. If suppression state is already missing or inconsistent,
commands stay disabled while the operator restores and verifies suppression. A known-good suppression declaration
may be restored only with its matching permissions and binding evidence. Reactivation requires fresh verification
and all ADR 031 gates. A Preview rollback neither changes Production nor supplies its rollback evidence.

### Relationship to existing decisions

This ADR supersedes only ADR 028's blanket rejection of a Supabase Send Email Hook, as retained by ADR 031. That
rejection continues to apply to a hook used for delivery. The new exception permits only native-mail suppression.
It does not replace ADR 028's provider, platform ownership, recipient, template, Outbox, retry, or privacy decisions.
It does not replace ADR 031 or restore the governance approval gates ADR 031 removed. Technical activation still
neither records nor implies legal approval.

## Technical Debt

The ownership transfer preserves any installed suppression objects and migration-history entries. Removing an
obsolete Website source is not a database rollback and authorizes no drop, reset, or history repair. Operations must
account for existing objects and history before its reconciliation procedure is used. This ADR does not install or
activate a hook, bind a live Supabase project, configure a provider, activate a product command, deploy, or send email.
Environment-specific runtime binding and verification evidence remain required before affected commands activate.

## Consequences

- Native Supabase delivery has an explicit Operations-owned suppression contract while delivery remains in the
  Transactional Email platform.
- Repository review and runtime verification prove different properties; both are required for activation.
- Configuration drift or rollback can make affected authentication commands unavailable. Availability does not
  justify restoring SMTP or adding provider fallback.
- A successful no-op hook cannot be used as a platform delivery outcome or as evidence that a recipient received mail.

## Risks

- A disabled or incorrectly bound hook can restore native SMTP behavior. Environment-specific verification and
  fail-closed Auth command gates must detect that state rather than accepting repository state as runtime proof.
- Project-wide suppression affects native Auth email requests outside the intended command. Activation requires
  an inventory of those paths and command-specific cutover evidence.
- Hook input contains sensitive authentication data even when no email is sent. The function performs no payload
  logging, persistence, recipient selection, or network access.

## More information

- [Operations Supabase configuration runbook](https://github.com/findmydoc-platform/ops/blob/main/docs/supabase-auth-mail-config.md)
- [Supabase administrative action-link generation](https://supabase.com/docs/reference/javascript/auth-admin-generatelink)
- [Nygard: Documenting architecture decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
