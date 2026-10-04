# Website auth-action protocol v1

The Website owns Clinic invitation and recovery AuthActions. Clinic Dashboard calls the private
`POST /api/internal/auth-actions/v1/{operation}` endpoint from its server. Service authentication grants
transport access only. A Website-signed `actionRef` identifies the action. Confirmation and completion also
require current Supabase user authority. The protocol accepts only `clinic-invitation` and `clinic-recovery`.
Dashboard UI, callback integration and hosted activation belong to separate work.

## Request authentication

All operations require `Content-Type: application/json` and these headers:

| Header | Value |
| --- | --- |
| `x-auth-action-timestamp` | UTC ISO timestamp with milliseconds, exactly `Date.toISOString()` |
| `x-auth-action-request-id` | Lowercase UUID, unique per logical request |
| `x-auth-action-key-version` | Configured service-key version |
| `x-auth-action-signature` | Lowercase hexadecimal HMAC-SHA-256 |

Compute the HMAC over the UTF-8 encoding of this JSON array, without added whitespace:

```text
["auth-action-protocol-v1", environment, "POST", operation, timestamp, requestId, sha256(rawBody)]
```

`sha256(rawBody)` is the lowercase hexadecimal digest of the exact UTF-8 request bytes. The Website rejects
future timestamps and requests aged five minutes or more. Bodies are limited to 16,384 bytes. Authentication
precedes Payload initialization in the route and every database, provider and original-IP operation in the
handler. Malformed JSON, invalid UTF-8, unsupported operations and extra body properties fail closed.

`AUTH_ACTION_PROTOCOL_KEYS_JSON` is server-only configuration with exactly `environment`, `service` and
`reference`. Each ring contains objects with `version` and `secret`, current key first. Versions are unique
within a ring and secrets contain at least 32 characters. Service and reference secrets must differ.
Dashboard receives the service ring only. The Website keeps the reference ring private. Separate environments
require separate secret material and independent availability. Missing or mismatched configuration returns
a generic unavailable response; it never falls back to another environment or native email sending.

Keep an old service key through the final five-minute request window. Keep an old reference key until all
actions signed with it have expired, including the 24-hour invitation lifetime. Rotation of recovery counting
keys follows the longer-lived correlation contract in [AuthActions](../security/auth-actions.md).

## Action reference

The Website creates `actionRef` during existing Clinic invitation or recovery catalog preparation, before
Supabase link generation. The current pinned template receives the resulting callback URL through its
existing `actionUrl` prop. Catalog acceptance, Outbox storage and delivery behavior retain their ownership.
Patient and platform recovery links retain their existing contract.

The reference has three dot-separated parts: reference-key version, canonical base64url JSON and a
lowercase hexadecimal HMAC-SHA-256. The JSON contains exactly `version: 1`, the positive native numeric
`actionId`, `flow` and `environment`. Its signing input is:

```text
["auth-action-reference-v1", referenceKeyVersion, encodedJson]
```

Dashboard carries this opaque value unchanged. A raw `authActionId`, a browser flag or a service HMAC cannot
replace it. The reference does not grant user authority or extend action expiry. Every operation reads
current Website policy, state and principal authority. References, token hashes and rendered links never
enter AuthAction or protocol receipts.

## Operations and results

All bodies are strict JSON objects. `flow` is either `clinic-invitation` or `clinic-recovery`.

| Operation | Body properties | Successful result |
| --- | --- | --- |
| `requestRecovery` | `email`, `clientIP` | HTTP 202, `accepted` |
| `validateAction` | `actionRef`, `flow` | HTTP 200, `valid` |
| `confirmAction` | `actionRef`, `flow`, `accessToken` | HTTP 200, `confirmed` |
| `completeAction` | `actionRef`, `flow`, `accessToken`, `password` | HTTP 200, `completed` |

Success bodies contain exactly `{ "version": 1, "ok": true, "outcome": result }`. Invalid references,
expired actions, illegal transitions, changed subjects and changed recipients share HTTP 400 with
`{ "version": 1, "ok": false, "code": "INVALID_OR_EXPIRED_ACTION" }`. Infrastructure uncertainty uses
HTTP 503 with `AUTH_ACTION_TEMPORARILY_UNAVAILABLE`. Every response is `private, no-store` and
`no-referrer`. Responses contain no principal, recipient, action ID or destination.

`requestRecovery` passes the original client IP through an opaque authenticated recovery context into the
existing target/IP rate-limit owner. The service restricts action creation to Clinic recovery. Unknown,
ambiguous, ineligible, throttled and temporarily unavailable recovery requests return the same acceptance
result. The protocol never trusts arbitrary forwarded headers, persists the IP or returns account existence.

`validateAction` requires an active, unexpired action and current eligible principal. It makes no AuthAction
write and consumes no Supabase token. Request-ID bookkeeping is separate private storage.

`confirmAction` uses Supabase's server-verified [getUser](https://supabase.com/docs/reference/javascript/auth-getuser)
result. The current user must have the authoritative Clinic role, the bound UUID and the current principal's
email. The native lifecycle transaction rechecks immutable policy, environment, expiry and principal
eligibility before `active` becomes `confirmed`. Reconfirmation preserves the original state and timestamps.
Dashboard must consume the matching token and retain its verified session before calling this operation.

`completeAction` requires the same current authority and a confirmed action. The Website performs one ordinary
authenticated password update, using the user session and public API key. It observes a successful provider
response for the bound UUID before committing `completed`. This uses the ordinary authenticated
`PUT /auth/v1/user` contract underlying [updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser),
without Admin password mutation or an automatically retried transaction. The protocol does not accept an
AMR claim, browser boolean or Dashboard assertion as password-change evidence. Password and access token
exist only in the bounded request and provider call. They are never persisted or logged. Dashboard remains
responsible for its session cookies and post-recovery session invalidation in its separate integration.

## Retries and uncertainty

An exact retry preserves the request ID, timestamp, key version and raw body. A changed signed body or
timestamp under the same ID is invalid. Immutable unique native Local API creates in the existing private
`payload-kv` collection claim execution across instances. A separate immutable result receipt records the
closed outcome after execution. Early invalid body or reference checks return the same invalid result on
every exact retry without storing a result receipt. Receipt binding uses a purpose-separated HMAC.
Storage contains neither raw body nor transport HMAC. Namespace hooks reject generic writes and deletions
even with access overrides.
No schema, migration, SQL escape hatch or new transaction owner is introduced.

Exact validation retries recheck active state. Confirmation retries recheck current user and principal,
including when the confirmation committed but receipt acknowledgement was lost. Exact completion retries
can return the original success for a completed action only while the request and action remain unexpired
and current authority still matches. Other terminal or replayed action attempts return the uniform invalid
result. Cached receipts grant no authority on their own.

A unique per-subject password claim excludes competing actions as well as duplicate requests. The claim
is committed before the provider call, which rechecks current authority again. A definitive pre-persistence
`weak_password` or `same_password` HTTP 422 rejection releases the claim; a corrected password needs a new
request ID. Other errors, connection loss, malformed responses and missing persistence acknowledgements
leave the claim closed. They cannot authorize another password attempt.

After an observed password success, an immutable receipt binds the action, flow, original expiry and a
subject digest. A lifecycle retry can finish from that receipt without repeating the password update.
The Website releases the subject claim only after observing `completed` with that proof. A process crash
between provider success and proof persistence remains uncertain and blocked. This is a deliberate
availability limit: there is no automatic unlock, timeout takeover or claim-adoption command. Operational
reconciliation must establish the provider outcome before changing storage; hosted activation requires
that procedure. Uncertain claims and password proofs currently have no automatic retention sweep.

Each authenticated request removes at most 100 expired request claims or receipts in its own environment.
Expiry remains the original timestamp plus five minutes and retries do not extend it. Cleanup is
opportunistic; an idle environment retains expired bookkeeping until another authenticated call. Deletion
cannot make an expired envelope valid again.

## Validation and activation boundary

Offline HTTP contracts run the production handler, native lifecycle decisions and collection guards over
fake native persistence. They cover both flows, tampering, clock bounds, subject and environment mismatch,
illegal transitions, exact retries, competing completion and uncertain provider responses. Provider tests
stub every network call and assert the ordinary GET/PUT boundary. Catalog tests render signed references
through the unchanged pinned templates. These tests do not prove native database scheduling, live Supabase
configuration, Dashboard callback behavior or mail arrival.

Cache impact is `no-public-impact`. Reads remain private and live, with no public tags or invalidation.
This protocol adds no hosted credentials, feature activation, Supabase callback binding, delivery provider
configuration or deployment. Preview and Production require their own separately approved configuration
and verification before use.
