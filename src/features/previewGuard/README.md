# Preview Guard (Temporary)

## Purpose

- Provide a temporary in-app guard for preview deployments when external deployment protection is unavailable.
- Restrict general frontend pages to platform staff sessions.
- Keep the patient login, recovery, invitation, and patient-owned route flow available for Preview QA.
- Keep patient account creation staff-managed through the Payload Admin.
- Keep the code default off unless the server-side PostHog flag `preview-guard-enabled` evaluates to enabled.
- Let PostHog decide where the guard is active; missing PostHog evaluation keeps the code default off.

## Activation

- PostHog host/path rules use `feature_flag_site_host` and `feature_flag_site_path`.
- Guard evaluation uses a server-side site actor, not the visitor-controlled PostHog cookie identity.
- The code does not special-case production, preview, local runtime, or known hosts for this flag.

## Behavior

- When enabled by PostHog, guard applies to frontend page routes matched by `src/proxy.ts`.
- Exempt routes: `/admin/login`, `/login/patient`, `/logout`, and the exact callback, confirmation, invite, and password-reset routes.
- Platform users: Supabase users with `app_metadata.user_type === "platform"` may access all guarded routes.
- Patient users: Supabase users with `app_metadata.user_type === "patient"` may access `/patient` and `/patient/**`.
- Anonymous patient-route requests are redirected to `/login/patient` with a safe internal `next` path.
- `/register/patient` is not exempt. In Preview, patient creation is redirected to the staff-only Payload Admin form and the public registration API rejects direct submissions.
- Unauthorized users are redirected to `/admin/login?message=preview-login-required&next=...`.

## Related Auth Flow

- Preview admin/login recovery decision flow is documented in:
  - `src/auth/README.md` -> `Preview Runtime Admin Recovery Flow`

## Limits

- This guard does not harden API routes.
- API authorization remains the responsibility of existing backend access controls.

## Rollback

1. Remove completely:
   - Delete `src/features/previewGuard/**`
   - Remove integration in `src/proxy.ts`
   - Remove login-guard UI handling in `src/app/(frontend)/admin/login/page.tsx`
   - Remove lock-header logic in `src/app/(frontend)/layout.tsx`
   - Remove related runtime-policy entries and docs
