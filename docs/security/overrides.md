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

## Temporary audit-ci exceptions

The scheduled dependency audit has two temporary, path-specific exceptions for `image-size@2.0.2` because npm has no newer release and the relevant GitHub advisories currently list no patched version:

- `GHSA-5p2g-fcmc-qvqq|@storybook/nextjs-vite>vite-plugin-storybook-nextjs>image-size`
- `GHSA-w3rx-r6r6-pgpr|@storybook/nextjs-vite>vite-plugin-storybook-nextjs>image-size`

The exceptions are enforced by the native `audit-ci` configuration in `audit-ci.jsonc`. They are owned by `SebastianSchuetze`, tracked in [issue #1666](https://github.com/findmydoc-platform/website/issues/1666), and expire at `2026-09-08T23:59:59Z`. A different dependency path or a new advisory still fails CI. The acceptance records the current risk; it does not claim that `image-size` is patched or universally safe. The reviewed application upload paths are authenticated, and current accepted image formats exclude the vulnerable parser formats. Reassess the issue before expiry and remove the exceptions when an upstream fix or safer dependency path is available.

## Notes
- If you prefer the rationale next to the override entries, consider keeping this file in `.github/` or adding a PR template that references this page. `package.json` cannot contain comments.
