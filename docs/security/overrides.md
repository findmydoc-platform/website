# pnpm security overrides and rationale

This document records the security-related version pins referenced from `package.json`.
JSON does not support comments, so we keep the rationale and evidence here for reviewers and future maintainers.

## Summary
- The actual enforced pins live in `pnpm.overrides` in `package.json`.
- The entries below explain why each pin exists and provide links to vendor advisories or release notes.

## Entries

### @modelcontextprotocol/sdk (@modelcontextprotocol/sdk@<1.25.2 -> pinned >=1.25.2)
- Reason: Pin to >=1.25.2 due to a security fix in the SDK; see upstream release notes for details.
- References:
  - https://github.com/modelcontextprotocol/sdk-js/releases

### hono (hono@<4.11.7 -> pinned >=4.11.7)
- Reason: Pin to >=4.11.7 due to security fixes in Hono; see the project changelog and advisories.
- References:
  - https://github.com/honojs/hono/releases

### fast-xml-parser (fast-xml-parser@<5.3.4 -> pinned >=5.3.4)
- Reason: Pin to >=5.3.4 to address a RangeError DoS issue in fast-xml-parser.
- References:
  - https://github.com/NaturalIntelligence/fast-xml-parser/releases

### lodash (lodash@>=4.0.0 <=4.17.22 -> pinned >=4.17.23)
- Reason: Pin to >=4.17.23 to avoid known prototype pollution vulnerabilities in older lodash versions.
- References:
  - https://github.com/lodash/lodash/releases
  - https://github.com/lodash/lodash/security

### diff (diff@<4.0.4 -> pinned >=4.0.4)
- Reason: Pin to >=4.0.4 due to a security fix in diff; see the upstream release notes and advisories.
- References:
  - https://github.com/kpdecker/jsdiff/releases
  - https://github.com/kpdecker/jsdiff/security/advisories

## Notes
- If you prefer the rationale next to the override entries, consider keeping this file in `.github/` or adding a PR template that references this page. `package.json` cannot contain comments.
