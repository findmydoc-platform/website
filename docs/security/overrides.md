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

### Payload Drizzle (`@payloadcms/drizzle@3.90.0`)
- Reason: Payload 3.90.0 is the first patched release for the current Payload security advisories. The local transaction error propagation patch remains required for the website's transactional email flows and is carried forward from the 3.88.0 package.
- References:
  - https://github.com/advisories/GHSA-r488-j9vj-wx3q
  - https://github.com/payloadcms/payload/releases/tag/v3.90.0

### esbuild (`esbuild@<0.28.1` -> `0.28.1`)
- Reason: `@esbuild-kit/core-utils@3.3.2` declares `esbuild@~0.18.20`. Without the range override, the graph restores vulnerable `esbuild@0.18.20` and resolves Vite's esbuild peer to an unsupported `0.25.12`.
- References:
  - https://registry.npmjs.org/@esbuild-kit/core-utils/3.3.2
  - https://registry.npmjs.org/vite/8.2.2
  - https://github.com/advisories/GHSA-67mh-4wv8-2f99

## Notes
- If you prefer the rationale next to the override entries, consider keeping this file in `.github/` or adding a PR template that references this page. `package.json` cannot contain comments.
