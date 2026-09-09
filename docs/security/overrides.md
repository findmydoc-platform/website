# pnpm security overrides and rationale

This document records the security-related version pins referenced from `package.json`.
JSON does not support comments, so we keep the rationale and evidence here for reviewers and future maintainers.

## Summary
- The actual enforced pins live in `pnpm.overrides` in `package.json`.
- The entries below explain why each pin exists and provide links to vendor advisories or release notes.

## Entries

### @modelcontextprotocol/sdk (`@modelcontextprotocol/sdk` -> `1.26.0`)
- Reason: `mcp-handler@1.1.0` declares an exact `@modelcontextprotocol/sdk@1.26.0` peer. Removing the pin resolves another path to `1.30.0` and produces an unmet peer warning.
- References:
  - https://registry.npmjs.org/mcp-handler/1.1.0

### esbuild (`esbuild@<0.28.1` -> `0.28.1`)
- Reason: `@esbuild-kit/core-utils@3.3.2` declares `esbuild@~0.18.20`. Without the range override, the graph restores vulnerable `esbuild@0.18.20` and resolves Vite's esbuild peer to an unsupported `0.25.12`.
- References:
  - https://registry.npmjs.org/@esbuild-kit/core-utils/3.3.2
  - https://registry.npmjs.org/vite/8.2.2
  - https://github.com/advisories/GHSA-67mh-4wv8-2f99

## Notes
- If you prefer the rationale next to the override entries, consider keeping this file in `.github/` or adding a PR template that references this page. `package.json` cannot contain comments.
