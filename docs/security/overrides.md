# pnpm security overrides and rationale

This document records the security-related version pins referenced from `package.json`.
JSON does not support comments, so we keep the rationale and evidence here for reviewers and future maintainers.

## Summary
- The actual enforced pins live in `pnpm.overrides` in `package.json`.
- The entries below explain why each pin exists and provide links to vendor advisories or release notes.

## Entries

### @modelcontextprotocol/sdk (`@modelcontextprotocol/sdk` -> `1.31.0`)
- Reason: `@payloadcms/plugin-mcp@3.90.0` and `mcp-handler@1.1.0` resolve the SDK at `1.31.0`, which contains the OAuth issuer binding fix for `GHSA-6qxp-vccf-f47h`.
- References:
  - https://github.com/advisories/GHSA-6qxp-vccf-f47h
  - https://registry.npmjs.org/mcp-handler/1.1.0

### Payload and Drizzle patches (`payload@3.92.1` and `@payloadcms/drizzle@3.92.1`)
- Reason: The native transaction error propagation and gallery failure provenance patches remain required for transactional email and gallery uploads. The patched upstream functions are unchanged between 3.90.2 and 3.92.1, so both patches retain their existing behavior. Payload 3.92.1 directly requires `undici@7.30.1`; the former version-scoped Undici override is no longer needed.
- References:
  - https://github.com/advisories/GHSA-r488-j9vj-wx3q
  - https://github.com/payloadcms/payload/releases/tag/v3.92.1
  - https://registry.npmjs.org/payload/3.92.1

### esbuild (`esbuild@<0.28.1` -> `0.28.1`)
- Reason: `@esbuild-kit/core-utils@3.3.2` declares `esbuild@~0.18.20`. Without the range override, the graph restores vulnerable `esbuild@0.18.20` and resolves Vite's esbuild peer to an unsupported `0.25.12`.
- References:
  - https://registry.npmjs.org/@esbuild-kit/core-utils/3.3.2
  - https://registry.npmjs.org/vite/8.2.2
  - https://github.com/advisories/GHSA-67mh-4wv8-2f99

### glob (`react-email>glob` and `@joshwooding/vite-plugin-react-docgen-typescript>glob` -> `14.0.2`)
- Reason: The production email path and the Storybook documentation plugin resolve vulnerable `glob@13.0.6`. Scoped overrides move only those paths to `glob@14.0.2`, which also resolves a patched minimatch release, without changing the older glob used by `copyfiles`.
- References:
  - https://github.com/advisories/GHSA-3g3m-2fjr-6pw4
  - https://github.com/advisories/GHSA-g3hv-75wg-m249

### minimatch (`@ts-morph/common` and `@typescript-eslint/typescript-estree` -> `11.0.5`)
- Reason: Dependabot alert `#253` identified `minimatch@10.2.6` in development-only paths. Scoped overrides move the two direct package paths to the patched `11.0.5` release without changing the separate `minimatch@3.1.5` path used by `glob@7`.
- References:
  - https://github.com/advisories/GHSA-g3hv-75wg-m249
  - https://github.com/isaacs/minimatch/releases/tag/v11.0.5

### graphql-scalars (`@payloadcms/graphql@3.92.1` -> `2.0.1`)
- Reason: Payload resolves `graphql-scalars@1.22.2` through an exact dependency. Version 2.0.1 contains the linear-time `PhoneNumber` scalar parser that fixes the high-severity regular-expression denial-of-service advisory. Payload uses the unchanged `DateTimeResolver` and `EmailAddressResolver` exports.
- References:
  - https://github.com/advisories/GHSA-x8rm-f576-gq67
  - https://github.com/graphql-hive/graphql-scalars/releases/tag/v2.0.1

### csv-parse (`@payloadcms/plugin-import-export@3.92.1` -> `7.0.2`)
- Reason: The import/export plugin still requires `csv-parse@5.6.0`. The existing prototype vulnerability safeguard remains necessary and moves with the plugin's version selector to preserve `csv-parse@7.0.2`.
- References:
  - https://github.com/findmydoc-platform/website/pull/1872
  - https://registry.npmjs.org/@payloadcms/plugin-import-export/3.92.1

### AWS S3 storage (`@payloadcms/storage-s3@3.92.1` -> `@aws-sdk/lib-storage@3.1152.0`)
- Reason: Fresh resolution selects `lib-storage@3.1165.0`, whose client peer range excludes the application's pinned `@aws-sdk/client-s3@3.1161.0`. The scoped override stays within the storage plugin's declared dependency range and supports the application's client.
- References:
  - https://registry.npmjs.org/@payloadcms/storage-s3/3.92.1
  - https://registry.npmjs.org/@aws-sdk/lib-storage/3.1165.0

## Notes
- If you prefer the rationale next to the override entries, consider keeping this file in `.github/` or adding a PR template that references this page. `package.json` cannot contain comments.
