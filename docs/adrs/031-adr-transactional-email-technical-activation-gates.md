# ADR: Transactional email technical activation gates

## Status

| Name | Content |
| --- | --- |
| Author | Sebastian Schütze |
| Version | 1.0 |
| Date | 28.09.2026 |
| Status | Approved |

## Background

[ADR 028](./028-adr-lettermint-for-transactional-email.md) made written legal, privacy, compliance, retention, and
key-management approvals a Production release gate. While preparing the first controlled Production command in
[Website issue #1910](https://github.com/findmydoc-platform/website/issues/1910), the team separated the verifiable
technical delivery contract from governance work that must assess the implemented data flow. The runtime cannot
validate the content of opaque approval references, and placeholder references would create the appearance of a
control without proving one.

## Problem Description

The activation registry needs to fail closed when a provider target, credential binding, sender, webhook, tracking
setting, environment boundary, or command cutover is incomplete. It must not present unfinished organizational
review as completed technical evidence. Legal, privacy, compliance, and public-document review still matter, but
their outcome is separate follow-up work rather than a prerequisite for this technical activation.

## Considerations

1. Retain every approval reference as a hard runtime gate. This blocks technical activation, but the application can
   validate only the reference shape and cannot establish that the referenced review is complete or applicable.
2. Remove all Production-specific evidence. This avoids false governance signals but would also remove the
   single-path cutover proof and weaken the fail-closed release boundary.
3. Keep verifiable technical and cutover evidence in the activation registry, while tracking governance review as
   separate non-blocking work. This preserves the runtime safety boundary without encoding unverifiable approvals.

## Decision with Rationale

This ADR supersedes ADR 028 as the current transactional-email decision. Every ADR 028 decision remains in force
except its requirement that written legal, privacy, compliance, retention, and key-management approval block
Production activation.

Production activation remains command-specific and fail-closed. It requires an isolated Production provider target,
credential fingerprints, digest-key evidence, sender and DNS evidence, disabled tracking, a signed webhook binding,
and one unique release reference identifying the reviewed command-specific release artifact. CI, Outside-In tests,
and review establish that the artifact leaves exactly one send path. The activation registry records the artifact
under `release.onePath` as `website-pr-<number>` and validates its bounded identity and uniqueness; runtime does not
infer source topology from the reference. The registry contains no legal, privacy, compliance, retention, or
public-document approval fields.

Legal, privacy, compliance, retention, key-management, and public-document review continue in
[management issue #396](https://github.com/findmydoc-platform/management/issues/396) against the implemented
Production data flow. Technical activation neither records nor implies their approval. A later decision may add a
real enforceable gate if those reviews identify one.

## Technical Debt

Management issue #396 must document concrete findings and any required product, policy, retention, or public-document
changes. It must not be represented by synthetic activation-registry references.

## Risks

- A governance issue discovered after activation may require a configuration or product change. The mitigation is a
  separately owned review of the actual data flow and the existing immediate command-deactivation rollback.
- Removing opaque approval fields may be mistaken for removing the reviews themselves. The activation documentation
  therefore names the follow-up boundary explicitly and states that technical activation is not legal approval.

## Supersedes

[ADR 028: Lettermint for transactional email](./028-adr-lettermint-for-transactional-email.md)
