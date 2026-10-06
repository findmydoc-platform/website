# Preview authentication email activation

Website issue #1998 declares `auth.email-verification`, `auth.invitation`, and
`auth.password-recovery` for the existing Preview transactional-email preflight. The declaration is additive.
It retains `clinic.registration-received` and every Production record. It does not bind a Supabase hook, provision
credentials, deploy a revision, or establish hosted delivery evidence.

The declaration is safe only when Operations has separately verified the exact Preview project's no-op Send Email Hook
against its reviewed desired state. That verification must cover the enabled binding, function fingerprint, signature,
effective grants, isolated project identity, and a content-free result identifier. The Website command declaration
cannot substitute for that verification. Production has no new declaration and must remain unchanged.

## Bounded Preview operation

An operator may proceed only after a separate approval names the Preview project and the exact Website revision.
The operator first verifies the Operations-owned suppression control without changing Production. They then deploy the
approved Website revision with the existing Preview-only Lettermint target, credential fingerprints, digest allowlist,
and signed webhook configuration. The operator must stop if any binding, fingerprint, or environment identity differs
from the committed preflight.

Use controlled synthetic identities only. Each recipient must be explicitly allowlisted for the Preview digest scope.
The operation covers patient verification, clinic invitation, patient recovery, clinic recovery, and platform recovery.
It records bounded, content-free identifiers for action-link generation, package rendering, Lettermint delivery,
callback handling, lifecycle completion, signed provider outcomes, environment binding, and recipient-control checks.
Evidence must not include a recipient address, token, token hash, link, rendered content, secret, private endpoint, or
private hostname.

The negative control attempts a native Supabase send and proves that it produces neither email nor a fallback transport
call. The provider-failure control proves that principal approval and access state remain unchanged. A successful no-op
Send Email Hook proves suppression only. It is never delivery evidence.

## Rollback

If suppression verification, the provider binding, the allowlist, or any controlled flow fails, disable the three
Preview auth command declarations and their preparation and dispatch. Keep the verified no-op suppression binding
enabled. Do not re-enable native SMTP, remove the hook, or select another transport. Record the rollback with bounded,
content-free identifiers. Preview rollback does not change Production.

The authoritative operational procedure remains the Operations Supabase configuration runbook named by
[ADR 032](../adrs/032-adr-supabase-native-mail-suppression.md). The Website source declaration and offline tests
establish no hosted configuration, deployment, delivery, or completion claim.
