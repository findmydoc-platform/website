# Supabase native-mail suppression

[ADR 032](../adrs/032-adr-supabase-native-mail-suppression.md) permits a no-op Supabase Send Email Hook solely to
suppress native Auth email. Operations owns the function, grants, environment configuration and reconciliation.
These are infrastructure controls without product logic. Their canonical implementation and operator procedure
belong in the [Operations Supabase configuration runbook](https://github.com/findmydoc-platform/ops/blob/f3deafd54970e4fad48a1e59cc24e39e0b4c8b3f/docs/supabase-auth-mail-config.md).
Website owns Auth product paths and command availability; its Transactional Email platform owns delivery.

Website does not maintain a duplicate suppression migration, executable desired-state declaration or configuration validator. Removing those
sources does not uninstall a function, alter grants or bindings, or repair migration history. Any existing objects
and history entries remain intact. Operations accounts for that history when reconciling its desired state.
Preview and Production require separate verification under ADR 032 and
[ADR 031](../adrs/031-adr-transactional-email-technical-activation-gates.md). Repository checks alone establish no
hosted binding or activation. Rollback keeps suppression enabled and disables affected Auth commands.

## Production Auth staging

`activationRegistry.json` declares the three Production Auth commands with distinct Website artifacts:
patient verification uses PR #2040, clinic invitation uses PR #2043, and password recovery uses PR #2041.
Existing Preview records and Production clinic registration remain unchanged.

The Production preflight's `nativeMailSuppression` records expected configuration, not observed state.
It identifies the Production Ops instance and project, enabled binding, and function, and pins Ops revision
`f3deafd54970e4fad48a1e59cc24e39e0b4c8b3f`. `declarationSha256` is the SHA-256 of the exact UTF-8 Git blob at
`config/supabase/native-mail-suppression.json` in that revision, including its trailing newline.
That Ops-owned declaration covers the function signature, body, invoker security, search path, and permissions.
Website validates declaration completeness and record/version uniqueness through its existing activation parser.
It does not inspect Supabase or establish that the expected hook is installed or enabled.

The shared Operations release must compare the pinned declaration and instance with actual hosted configuration
and verify convergence before runtime cutover. Repository staging requires neither a currently enabled Production
hook nor disabled Custom SMTP. It performs no hosted configuration write, deployment, provider call, or Production smoke.

## Native Auth call inventory

`supabase/native-auth-call-inventory.json` remains Website-owned and records the existing native calls and their
product-flow scopes:

| Flow | Source and function | Native API | State |
| --- | --- | --- | --- |
| Patient verification | `src/app/api/auth/register/patient/route.ts`, `POST` | `signUp` | Replaced, #1734 |
| Shared recovery | `src/app/api/auth/password/reset/route.ts`, `POST` | none | Replaced, #1734 |
| Initial clinic invitation | `src/auth/utilities/supabaseProvision.ts`, `createInitialClinicSupabaseAccount` | none | Replaced, #1734 |
| Generic legacy account invitation | `src/auth/utilities/supabaseProvision.ts`, `inviteSupabaseUser` | `inviteUserByEmail` | Excluded from #1734 |

`scripts/check-supabase-native-auth-calls.mjs` blocks the three native APIs only within declared #1734 scopes marked
`replaced`. Unreplaced and excluded flows retain their behavior. The historical inventory does not imply that a
flow was replaced, and removing a native call does not change its declared status automatically.

The guard parses productive source with the TypeScript compiler. It resolves local aliases by lexical symbol,
independently of declaration order, and retains possible Auth receivers across conditional expressions and block
assignments. Shadowing variables remain separate. It recognizes Auth property access, destructuring, bracket access,
detached and bound calls, and nested callbacks. Dynamic Auth method selection in a replaced scope fails closed.
Supabase action-link generation and unrelated method names remain allowed. A missing replaced scope fails instead
of silently dropping coverage when code moves.

The guard has a known local-alias limitation for `??`, `||`, `&&`, their logical assignments and destructuring
defaults. Product-flow replacement review must account for those patterns and register native API access in any
extracted or cross-module helper. Each completed flow must explicitly be marked `replaced`. The source check does
not execute Auth requests or establish ADR 031's runtime one-send-path evidence.

Run `pnpm auth:native-calls:check` for the native-call source guard. `pnpm check` also runs it, and the tooling suite
retains the guard's unreplaced, replaced, excluded and alias regression tests. Function, grant and hosted
configuration validation belong to Operations.
