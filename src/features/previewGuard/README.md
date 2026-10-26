# Preview Guard

## Purpose

- Protect Preview deployments inside the application while Vercel Deployment Protection remains disabled.
- Restrict known platform pages and valid dynamic CMS deep links to platform staff sessions.
- Keep the patient login, recovery, invitation, and implemented patient-owned pages available for Preview QA.
- Keep patient account creation staff-managed through Payload Admin while the guard is enabled.
- Reject unknown and scanner traffic without turning it into login traffic or Payload work.

## Activation

- `VERCEL_ENV=preview` activates the guard for every Vercel-generated branch, deployment, and alias host.
- `DEPLOYMENT_ENVIRONMENT=preview` provides the same behavior for explicitly configured non-Vercel Preview runtimes.
- Runtime policy determines whether a deployment is Preview. Only the canonical host `preview.findmydoc.eu` allows the server-side PostHog flag `preview-guard-enabled` to disable the guard for an approved public test window. Generated deployment and branch hosts stay guarded.
- The canonical Preview host stays guarded when flag evaluation is missing, invalid, unavailable or not configured. Only an explicitly evaluated boolean `false` opens it. Preview remains `noindex` during the public test window.
- Canonical Preview routing uses the request's `Host` header because Vercel can supply an internal deployment URL to Proxy. It does not trust `x-forwarded-host`. Requests without a `Host` header use the URL hostname.
- Unavailable canonical Preview flag evaluation writes the operational event `auth.preview_guard.flag_unavailable` with its reason, without credential values or visitor identity.
- Local development stays open. A PostHog result cannot activate the guard while runtime policy resolves to `development`.
- The server-side PostHog flag `preview-guard-enabled` can additionally activate the guard in a non-local, non-Preview runtime.
- Guard flag evaluation uses a server-side site actor, not the visitor-controlled PostHog cookie identity.

## Behavior

- Exact anonymous page exemptions are `/admin/login`, `/admin/logout`, `/login/patient`, `/logout`, and the callback, confirmation, invitation, and password-reset routes.
- Required public files use an exact asset allowlist. Prefixes such as `/images/**` and `/stories/**` are not broadly exempt.
- Platform users: Supabase users with `app_metadata.user_type === "platform"` may access all guarded routes.
- Patient users may access the implemented `/patient/favorites`, `/patient/inquiries`, and inquiry-detail pages.
- Anonymous patient-route requests are redirected to `/login/patient` with a safe internal `next` path.
- Known platform and Payload Admin pages redirect anonymous requests to `/admin/login` with a safe internal `next` path.
- Anonymous dynamic CMS paths return `404` without a Payload lookup. A platform session can continue to the application so Payload can resolve a valid deep link.
- Obvious scanner and invalid reserved paths return `404` before feature-flag evaluation or authentication.
- Guarded Preview APIs never receive an HTML login redirect. The exact anonymous API allowlist is `/api/auth/login`, `/api/auth/callback`, and `/api/auth/password/reset`.
- Other guarded Preview APIs require a server-validated Supabase session or Bearer token before endpoint authorization. Invalid credentials return JSON `401`; a recognizable temporary validation failure returns JSON `503`.
- When the canonical Preview guard is disabled, APIs use their normal endpoint authorization, including guest inquiry submission. Visitor-supplied guard headers are removed before forwarding.
- `/api/mcp` and `/api/clinic-dashboard/**` pass directly to their own machine-authentication contracts. Form Bridge forwards only `Cookie` and `Authorization` to same-origin Payload calls after validating the request host.
- `/register/patient` is not exempt. While Preview Guard is enabled, patient creation is redirected to the staff-only Payload Admin form and the public registration API rejects direct submissions.
- Preview Guard takes precedence over Temporary Landing Mode when both are active. Temporary Landing Mode keeps its existing behavior when Preview Guard is inactive.

## Related Auth Flow

- Preview admin/login recovery decision flow is documented in:
  - `src/auth/README.md` -> `Preview Runtime Admin Recovery Flow`

## Limits

- Endpoint role and resource authorization remains mandatory after the Preview API guard.
- Vercel Firewall filtering remains a separate outer layer. The route classifier is the application fallback, not a replacement for the firewall.

## Rollback

Restore the existing canonical Preview host condition for `preview-guard-enabled` to 100% after a public test window. Production conditions stay unchanged. Wait for flag-definition propagation and verify anonymous profile denial and guest API denial before declaring the guard restored. Turning the guard off does not disable Temporary Landing Mode or endpoint authorization.

1. Remove completely:
   - Delete `src/features/previewGuard/**`
   - Remove integration in `src/proxy.ts`
   - Remove login-guard UI handling in `src/app/(frontend)/admin/login/page.tsx`
   - Remove lock-header logic in `src/app/(frontend)/layout.tsx`
   - Remove related runtime-policy entries and docs
