# Collection permission matrix

Use the [generated matrix](./permission-matrix.generated.md) for collection-level create, read, update, delete, Admin,
and version access expectations. Its source is the [permission matrix configuration](../../src/security/permission-matrix.config.ts).
[Collection access and hooks](../../src/collections) enforce access alongside the [shared access helpers](../../src/access).
An Admin entry describes expected administrative access or authority. It does not imply a separate Payload
`access.admin` handler.

## Authorization boundaries

- Platform staff roles and clinic staff eligibility come from the current Payload principal. An operator or user's
  role, clinic, account state, field access, and record ownership can narrow an operation shown in the matrix.
  [Authentication and integrity](./authentication-system.md#authorization-and-integrity)
- A staff member's active local or group assignment limits current clinic scope. Invitation and participation evidence
  can enable private Dashboard access independently of public clinic publication.
  [Staff assignments](./clinic-staff-assignments.md) · [Clinic participation](./clinic-participation.md)
- Domain operations can require tighter checks than generic collection access. The Website owns the request contracts
  for Dashboard writes, review history, and private AuthAction commands.
  [Clinic Dashboard API](../integrations/clinic-dashboard-api.md) · [Review access and audit](../review-modification-process.md) ·
  [Auth actions](./auth-actions.md)
- Public Page and Post reads require publication in the requested locale and return only that locale.
  Platform staff can read drafts and version history.
- A media file request and a media document read are different operations. File delivery follows the collection's
  publication and ownership rules. [Media access and storage](../integrations/storage.md)
- Editorial image uploads through MCP require the key's image upload grant and the current staff member's
  `platformContentMedia` create permission. [Editorial image upload](../integrations/mcp.md#editorial-image-upload)

A collection with `trash: true` uses Payload's native soft delete. The collection configuration determines where
Trash is available. [Payload collection options](https://payloadcms.com/docs/configuration/collections#options)

## Maintenance

Update the matrix configuration and the matching test in [the collection access-matrix suite](../../tests/unit/access-matrix)
when adding or changing a collection's access rules. Each collection has a `<slug>.permission.test.ts` file.

- `pnpm matrix:derive` updates the checked-in Markdown table.
- `pnpm matrix:derive json` writes `tmp/permission-matrix.json` for verification.
- `pnpm matrix:verify` checks collection coverage and matching permission test files.
