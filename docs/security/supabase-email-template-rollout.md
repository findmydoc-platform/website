# Supabase Email Template TokenHash Rollout

Invite and recovery links for the website and Clinic Dashboard use one prefetch-safe callback contract. This runbook
changes hosted Supabase templates only after both application previews support the contract.

## Template Contract

Keep each application's `redirectTo` value on its own `/auth/callback` route with an allowlisted internal `next`
parameter. The hosted templates append the provider token and fixed flow:

- Invite action URL: `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite`
- Recovery action URL: `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`

The callback `GET` validates the exact `type` and `next` pair and moves the token into a short-lived server-side
confirmation context. It never calls `verifyOtp`. The user-facing confirmation action performs the same-origin `POST`
that consumes the token. Existing website authorization-code callbacks and browser-hash completion remain available
during rollout.

## Required Evidence and Order

1. Export the currently deployed Invite and Recovery templates from Staging and Production. Store the complete export,
   project reference, and capture time in restricted rollout evidence before changing either project.
2. Confirm that the Website and Clinic Dashboard preview deployments both support authorization-code and TokenHash
   callbacks. Do not modify a hosted template based only on repository defaults.
3. Apply the TokenHash templates to Staging. Send a fresh invite and recovery email; do not reuse already delivered
   browser-hash links.
4. Prove confirmation, password completion, first login, repeat login, reload, refresh, and logout. Inspect cookies,
   cache headers, browser traffic, and server logs for token or email leakage.
5. Merge and deploy both applications from current `main`. Apply the templates to Production only after the deployed
   callback routes are verified.
6. Send fresh Production invite and recovery emails, repeat the proof, and keep the exported templates as the rollback
   source. If verification fails, restore the exact prior template and stop the rollout.

The later clinic-login cutover issue remains a separate gate. Template rollout must not remove existing website auth
flows or change patient and platform-staff routing.
