# Supabase native-mail suppression

[ADR 032](../adrs/032-adr-supabase-native-mail-suppression.md) permits a Postgres Send Email Hook solely to suppress
native Supabase email. [Website #1987](https://github.com/findmydoc-platform/website/issues/1987) supplies the repository
implementation. The migration installs no hook binding and changes no product Auth flow, SMTP setting, provider
configuration, or Preview or Production activation state.

## Function and permissions

The Supabase CLI generated `supabase/migrations/20261001103540_native_mail_suppression.sql`. It creates
`auth_mail_suppression.send_email_v1(event jsonb) returns jsonb` in a dedicated schema. The SQL body returns `{}` for
every input, which is the [Send Email Hook success response](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook).
It ignores the event and has no table, renderer, recipient, provider, retry, logging, or network dependency. A successful
invocation acknowledges suppression; it supplies no delivery outcome.

The function uses `SECURITY INVOKER` and a fixed empty `search_path`. The migration revokes all function and schema
privileges from `PUBLIC`, `anon`, and `authenticated`. Only `supabase_auth_admin` receives function `EXECUTE` and schema
`USAGE`, without schema `CREATE` or grant options. The migration owner retains PostgreSQL's owner privileges. This
matches the [Postgres Auth hook permission contract](https://supabase.com/docs/guides/auth/auth-hooks).

The dedicated schema must remain absent from each environment's exposed Data API schemas. The repository contains
neither environment configuration nor evidence of actual exposure or an enabled Send Email Hook.

## Declaration check

`supabase/native-mail-suppression.json` records the reviewed function identity, signature, no-op definition, execution
mode, search path, and permission contract. Separate SHA-256 fingerprints cover the function and permissions. The
fingerprint input is canonical JSON with lexicographically sorted object keys and preserved array order. It contains
configuration only, with no event, identity, recipient, token, credential, or environment binding.

`scripts/supabase-native-mail-suppression.mjs` rejects missing, malformed, unexpected, or inconsistent declarations.
It recomputes both fingerprints and compares the declared definition and permissions with the approved no-op contract.
The repository check also requires the declared migration to match the closed SQL contract. Extra statements, payload
use, rendering, network calls, persistence, and broader grants therefore fail before SQL execution. Diagnostics contain
fixed reason codes and never echo input data or parser errors.

Run `pnpm auth:suppression:check` to check the declaration, migration, and replaced-flow source guard. `pnpm check` and
the existing CI tooling suite run these checks. A passing declaration check verifies desired repository state only.
It does not authorize commands or prove that any Supabase project installed or enabled the function.

## Native Auth call inventory

`supabase/native-auth-call-inventory.json` records these existing native calls and their product-flow scopes:

| Flow | Source and function | Native API | State |
| --- | --- | --- | --- |
| Patient verification | `src/app/api/auth/register/patient/route.ts`, `POST` | `signUp` | Unreplaced, #1734 |
| Shared recovery | `src/app/api/auth/password/reset/route.ts`, `POST` | `resetPasswordForEmail` | Unreplaced, #1734 |
| Initial clinic invitation | `src/auth/utilities/supabaseProvision.ts`, `inviteClinicSupabaseAccount` | `inviteUserByEmail` | Unreplaced, #1734 |
| Generic legacy account invitation | `src/auth/utilities/supabaseProvision.ts`, `inviteSupabaseUser` | `inviteUserByEmail` | Excluded from #1734 |

`scripts/check-supabase-native-auth-calls.mjs` blocks the three native APIs only within declared #1734 scopes marked
`replaced`. Unreplaced and excluded flows retain their behavior. The historical call inventory does not imply that a
flow was replaced, and removing a native call does not change its declared status automatically.

The guard parses productive source with the TypeScript compiler. It resolves local aliases by lexical symbol,
independently of declaration order, and retains possible Auth receivers across conditional expressions and block
assignments. Shadowing variables remain separate. It recognizes Auth property access, destructuring, bracket access,
detached and bound calls, and nested callbacks. Dynamic Auth method selection in a replaced scope
fails closed. Supabase action-link generation and unrelated method names remain allowed. A missing replaced scope
fails instead of silently dropping coverage when code moves.

The #1734 replacement must update the scopes to include its actual native API access locations and mark each completed
flow `replaced`. Named helpers outside a declared scope and cross-module call graphs require explicit scope entries
and review. This source check does not execute Auth requests or establish the runtime one-send-path evidence required
by [ADR 031](../adrs/031-adr-transactional-email-technical-activation-gates.md).

## Local and CI evidence

The focused Vitest tooling tests execute the actual migration in pinned `@electric-sql/pglite` 0.5.8, which runs
Postgres in memory. They verify the empty result, invoker execution, fixed search path, effective grants, actual denied
client-role invocations, and an Auth-role invocation. Synthetic inputs contain no recipients, tokens, token hashes,
action links, or template data. An offline test blocks Node HTTP, HTTPS, TCP, UDP, fetch, and console logging while
creating the database, applying the migration, and invoking the function. Declaration mutation tests reject unsafe
definitions, permissions, stale fingerprints, and unreadable files. Source-guard tests distinguish unreplaced,
replaced, and excluded flows.

On 1 October 2026, the same migration was applied to a dedicated disposable Supabase Postgres 17.6.1.143 container
with networking disabled. PostgreSQL 17.6 reported only owner and `supabase_auth_admin` ACL entries. Effective schema
usage and function execution were false for `anon`, `authenticated`, and `service_role`, and true for
`supabase_auth_admin`. The function returned `{}`.

The function-related Supabase [Splinter security advisors](https://github.com/supabase/splinter/tree/fccca4b1c4d8b48b8ccd69bd6b30e84adcb92975)
0011, 0028, and 0029, pinned to revision `fccca4b1c4d8b48b8ccd69bd6b30e84adcb92975`, reported zero findings for the added
function. A disposable public `SECURITY DEFINER` function without a fixed search path produced one finding in each
rule as a negative control. The control and container were removed. This is a review of the added function and grants,
not a full project advisor sweep or hosted hook-binding proof.

## Environment binding remains separate

Preview and Production each require independent verification of the installed function, effective privileges,
non-exposed schema, enabled Send Email Hook identity, and reviewed Website revision. Their binding fingerprints and
activation evidence remain separate from the declaration fingerprints and ADR 031 credential fingerprints. Missing,
stale, disabled, unverifiable, or inconsistent runtime evidence must keep affected commands disabled. That gate and
environment binding are separate work; #1987 neither installs a runtime activation gate nor activates a command.

Rollback retains the verified no-op hook and disables the affected Auth commands. It never restores native SMTP or
removes the hook to recover delivery. [ADR 032](../adrs/032-adr-supabase-native-mail-suppression.md) defines the complete
activation, drift, and rollback contract.
