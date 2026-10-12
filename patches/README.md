# Dependency override

## postcss-selector-parser

Tailwind Typography 0.5.20 pins postcss-selector-parser to vulnerable version
6.0.10. A parent-scoped override in `package.json` resolves that dependency to
7.1.6, the patched release for
[GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).
Remove the override when Typography itself declares a patched parser version.
