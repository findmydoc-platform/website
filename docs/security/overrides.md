# pnpm security overrides and rationale

This document records the security-related version pins referenced from `package.json`.
JSON does not support comments, so we keep the rationale and evidence here for reviewers and future maintainers.

## Summary
- The actual enforced pins live in `pnpm.overrides` in `package.json`.
- The entries below explain why each pin exists and provide links to vendor advisories or release notes.

## Entries

### undici (`undici` -> `^7.28.0`)
- Reason: `payload@3.86.0` declares `undici@7.28.0`. A fresh resolution without the override restores that vulnerable version, while the override resolves the graph to `undici@7.29.0`.
- References:
  - https://registry.npmjs.org/payload/3.86.0
  - https://github.com/advisories/GHSA-8xcm-r25x-g524
  - https://github.com/advisories/GHSA-4cwx-7wf7-3272
  - https://github.com/advisories/GHSA-m8rv-5g2x-5cg5
  - https://github.com/advisories/GHSA-jr45-8vmc-qm54
  - https://github.com/advisories/GHSA-v3r7-h72x-cjcm

### @modelcontextprotocol/sdk (`@modelcontextprotocol/sdk` -> `1.26.0`)
- Reason: `mcp-handler@1.1.0` declares an exact `@modelcontextprotocol/sdk@1.26.0` peer. Removing the pin resolves another path to `1.27.1` and produces an unmet peer warning.
- References:
  - https://registry.npmjs.org/mcp-handler/1.1.0

### esbuild (`esbuild@<0.28.1` -> `0.28.1`)
- Reason: `@esbuild-kit/core-utils@3.3.2` declares `esbuild@~0.18.20`. Without the range override, the graph restores vulnerable `esbuild@0.18.20` and resolves Vite's esbuild peer to an unsupported `0.25.12`.
- References:
  - https://registry.npmjs.org/@esbuild-kit/core-utils/3.3.2
  - https://registry.npmjs.org/vite/8.1.0
  - https://github.com/advisories/GHSA-67mh-4wv8-2f99

### @hono/node-server (`@hono/node-server@<2.0.5` -> `>=2.0.5`)
- Reason: `@modelcontextprotocol/sdk@1.26.0` declares `@hono/node-server@^1.19.9`. Removing the override restores vulnerable `1.19.17`; the override resolves the graph to `2.1.0`.
- References:
  - https://registry.npmjs.org/@modelcontextprotocol/sdk/1.26.0
  - https://github.com/advisories/GHSA-frvp-7c67-39w9

### postcss (`postcss@<8.5.23` -> `8.5.23`)
- Reason: `next@16.2.11` declares `postcss@8.4.31`. Removing the override restores that version and four known advisories; the override keeps the graph on the patched `8.5.23` line.
- References:
  - https://registry.npmjs.org/next/16.2.11
  - https://github.com/advisories/GHSA-qx2v-qp2m-jg93
  - https://github.com/advisories/GHSA-6g55-p6wh-862q
  - https://github.com/advisories/GHSA-r28c-9q8g-f849
  - https://github.com/advisories/GHSA-fxqj-rqcc-2cmp

### brace-expansion (`brace-expansion@<5.0.9` -> `5.0.9`)
- Reason: the patched `minimatch@3.1.5` compatibility path uses the current `brace-expansion` API. Removing the override resolves `brace-expansion@1.1.18` and makes ESLint fail with `TypeError: expand is not a function`.
- References:
  - https://registry.npmjs.org/brace-expansion/5.0.9

### sharp (`sharp@<0.35.0` -> `0.35.3`)
- Reason: `next@16.2.11` declares optional `sharp@^0.34.5`. Removing the override restores vulnerable `0.34.5`; the override resolves production paths to `0.35.3`.
- References:
  - https://registry.npmjs.org/next/16.2.11
  - https://github.com/advisories/GHSA-f88m-g3jw-g9cj

### dompurify (`dompurify@<=3.4.12` -> `3.4.13`)
- Reason: `posthog-js@1.399.0` resolves `dompurify@3.4.12`, which is vulnerable to detached-subtree XSS when `IN_PLACE` sanitization is combined with a hook that removes an element. The override keeps the transitive runtime dependency on the first patched release.
- References:
  - https://github.com/advisories/GHSA-55q2-fjhq-7xh7
  - https://github.com/cure53/DOMPurify/releases/tag/3.4.13

## Temporary audit-ci exceptions

The scheduled dependency audit has two temporary, path-specific exceptions for `image-size@2.0.2` because npm has no newer release and the relevant GitHub advisories currently list no patched version:

- `GHSA-5p2g-fcmc-qvqq|@storybook/nextjs-vite>vite-plugin-storybook-nextjs>image-size`
- `GHSA-w3rx-r6r6-pgpr|@storybook/nextjs-vite>vite-plugin-storybook-nextjs>image-size`

The exceptions are enforced by the native `audit-ci` configuration in `audit-ci.jsonc`. They are owned by `SebastianSchuetze`, tracked in [issue #1666](https://github.com/findmydoc-platform/website/issues/1666), and expire at `2026-09-08T23:59:59Z`. A different dependency path or a new advisory still fails CI. The acceptance records the current risk; it does not claim that `image-size` is patched or universally safe. The reviewed application upload paths are authenticated, and current accepted image formats exclude the vulnerable parser formats. Reassess the issue before expiry and remove the exceptions when an upstream fix or safer dependency path is available.

## Notes
- If you prefer the rationale next to the override entries, consider keeping this file in `.github/` or adding a PR template that references this page. `package.json` cannot contain comments.
