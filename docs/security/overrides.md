# pnpm security overrides and rationale

This document records the security-related version pins referenced from `package.json`.
JSON does not support comments, so we keep the rationale and evidence here for reviewers and future maintainers.

## Summary
- The actual enforced pins live in `pnpm.overrides` in `package.json`.
- The entries below explain why each pin exists and provide links to vendor advisories or release notes.

## Entries

### esbuild (esbuild@<=0.24.2 -> pinned >=0.25.0)
- Reason: `@payloadcms/db-postgres` still brings a `drizzle-kit` path that can resolve vulnerable esbuild versions without the override.
- References:
  - https://github.com/advisories/GHSA-67mh-4wv8-2f99

### hono (hono@<4.12.21 -> pinned >=4.12.21)
- Reason: `@payloadcms/plugin-mcp` and `shadcn` both bring `@modelcontextprotocol/sdk` paths that resolve vulnerable Hono versions without the override.
- References:
  - https://github.com/advisories/GHSA-2gcr-mfcq-wcc3
  - https://github.com/advisories/GHSA-3hrh-pfw6-9m5x
  - https://github.com/advisories/GHSA-xrhx-7g5j-rcj5
  - https://github.com/advisories/GHSA-f577-qrjj-4474

### postcss (postcss@<8.5.10 -> pinned >=8.5.10)
- Reason: `next@16.2.6` declares `postcss@8.4.31`; the override keeps all lockfile PostCSS resolutions on the patched 8.5 line.
- References:
  - https://github.com/advisories/GHSA-qx2v-qp2m-jg93

## Temporary audit-ci exceptions

The scheduled dependency audit has two temporary, path-specific exceptions for `image-size@2.0.2` because npm has no newer release and the relevant GitHub advisories currently list no patched version:

- `GHSA-5p2g-fcmc-qvqq|@storybook/nextjs-vite>vite-plugin-storybook-nextjs>image-size`
- `GHSA-w3rx-r6r6-pgpr|@storybook/nextjs-vite>vite-plugin-storybook-nextjs>image-size`

The exceptions are enforced by the native `audit-ci` configuration in `audit-ci.jsonc`. They are owned by `SebastianSchuetze`, tracked in [issue #1666](https://github.com/findmydoc-platform/website/issues/1666), and expire at `2026-09-08T23:59:59Z`. A different dependency path or a new advisory still fails CI. The acceptance records the current risk; it does not claim that `image-size` is patched or universally safe. The reviewed application upload paths are authenticated, and current accepted image formats exclude the vulnerable parser formats. Reassess the issue before expiry and remove the exceptions when an upstream fix or safer dependency path is available.

## Notes
- If you prefer the rationale next to the override entries, consider keeping this file in `.github/` or adding a PR template that references this page. `package.json` cannot contain comments.
