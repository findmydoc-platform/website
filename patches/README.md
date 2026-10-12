# Dependency patches

## braces 3.0.3

`braces@3.0.3.patch` backports the runtime depth guards from
[upstream PR #88](https://github.com/micromatch/braces/pull/88), commit
`a795ee83ecd011131b2d618fe754ac5a8e124dae`, with whitespace adjustments.
The upstream PR is unmerged. The patch mitigates
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

The parser bounds brace and parenthesis nesting. Compile, expand, and stringify
validate AST depth and reject cycles before recursive traversal. Inputs exceeding
the safe depth throw `SyntaxError`; callers must handle invalid input. Ordinary
patterns and shared acyclic nodes remain supported.

`tests/tooling/dependencies/braces-security.test.ts` exercises the installed
dependency through both Next.js lint globs and the Payload Sass watcher.
Remove this patch when an upstream release fixes the advisory and all dependency
paths resolve to that release. Version-based scanners still flag 3.0.3 while the
patch is in use; no advisory is suppressed.

## postcss-selector-parser

Tailwind Typography 0.5.20 pins postcss-selector-parser to vulnerable version
6.0.10. A parent-scoped override in `package.json` resolves that dependency to
7.1.6, the patched release for
[GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).
Remove the override when Typography itself declares a patched parser version.
