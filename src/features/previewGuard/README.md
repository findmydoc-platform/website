# Preview Guard (Temporary)

## Purpose

- Provide a temporary in-app guard for preview deployments when external deployment protection is unavailable.
- Restrict access to frontend pages to platform staff sessions only.

## Activation

- Runtime resolves to `preview` (server: `VERCEL_ENV` → `DEPLOYMENT_ENV` fallback).
- No feature flag toggle: behavior is controlled by the central runtime policy in code.

## Behavior

- Guard applies to frontend page routes matched by `src/proxy.ts`.
- Exempt routes: `/admin/login`, `/admin/first-admin`.
- Allowed users: Supabase users with `app_metadata.user_type === "platform"`.
- Unauthorized users are redirected to `/admin/login?message=preview-login-required&next=...`.

## Related Auth Flow

- Preview admin/login recovery decision flow (including first-admin recovery) is documented in:
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
