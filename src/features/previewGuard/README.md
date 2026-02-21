# Preview Guard (Temporary)

## Purpose

- Provide a temporary in-app guard for preview deployments when external deployment protection is unavailable.
- Restrict access to frontend pages to platform staff sessions only.

## Activation

- `PREVIEW_GUARD_ENABLED=true`
- Deployment environment resolves to `preview` (via `DEPLOYMENT_ENV`, `NEXT_PUBLIC_DEPLOYMENT_ENV`, `VERCEL_ENV`, `NEXT_PUBLIC_VERCEL_ENV`)

## Behavior

- Guard applies to frontend page routes matched by `src/proxy.ts`.
- Exempt routes: `/admin/login`, `/admin/first-admin`.
- Allowed users: Supabase users with `app_metadata.user_type === "platform"`.
- Unauthorized users are redirected to `/admin/login?message=preview-login-required&next=...`.

## Limits

- This guard does not harden API routes.
- API authorization remains the responsibility of existing backend access controls.

## Rollback

1. Disable immediately without code changes:
   - `PREVIEW_GUARD_ENABLED=false`
2. Remove completely:
   - Delete `src/features/previewGuard/**`
   - Remove integration in `src/proxy.ts`
   - Remove login-guard UI handling in `src/app/(frontend)/admin/login/page.tsx`
   - Remove lock-header logic in `src/app/(frontend)/layout.tsx`
   - Remove related env declarations and docs
