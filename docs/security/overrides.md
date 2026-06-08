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

## Notes
- If you prefer the rationale next to the override entries, consider keeping this file in `.github/` or adding a PR template that references this page. `package.json` cannot contain comments.
