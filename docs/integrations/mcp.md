# MCP (Model Context Protocol)

This repo exposes a Payload MCP server at `POST /api/mcp` using `@payloadcms/plugin-mcp`.

Important notes:
- **Only platform staff with the current `admin` role can create, read, update, or delete MCP API keys**.
- **Only platform staff-owned keys can authenticate to MCP**.
- MCP requests authenticate with an **Authorization Bearer token** (not Payload "API-Key" auth).

The Admin navigation and key-management routes are hidden from Support and Content Manager users. Server-side access
checks reload the current staff role, so a removed admin role denies management even when a request carries an old role.
Existing platform staff-owned keys remain usable with their configured MCP permissions, including keys owned by Support
or Content Manager users. Key creation binds the owner to the administrator creating it; the owner cannot be reassigned.

## Create an MCP API key (administrators only)

1. Log in to the Payload Admin UI with a **Platform Staff administrator** account.
   - Admin UI principals live in the `platformStaff` collection.
   - The principal's current role must be `admin`.

2. Go to **MCP → API Keys**.

3. Click **Create New**.

4. Configure the key:
   - **Enable API Key**: on
   - **Label** / **Description**: set something descriptive (for auditing)
   - **Per-collection permissions** (sidebar): enable only what you need
     - In this repo, most collections are `Find`-only.
     - A small curated set is allowed to `Create`/`Update` (configured in [`src/plugins/mcp.ts`](../../src/plugins/mcp.ts)).

5. Save.

6. Copy the generated API key value.
   - Treat it like a password. Store it in a password manager.
   - You typically can’t recover the plaintext value later.

## Clinic profiles and media

The `POST /api/mcp` route awaits the complete tool response before returning to Next.js. Collection and global hooks
can therefore register their cache revalidations before the request is finalized. The adapter preserves the SDK's
status, headers and response bytes, including its event-stream framing. Existing hooks and the cache planner retain
invalidation ownership. This completion adapter addresses [Payload issue #18490](https://github.com/payloadcms/payload/issues/18490)
and can be removed when the upstream endpoint itself awaits tool completion.

Enable each collection operation and custom tool needed by the key. Custom tools are disabled by default and still use
the key owner's current platform role and Payload access rules. `createClinics` and `createDoctors` generate the slug
when it is omitted. `trashClinic` and `trashDoctor` move one profile to the trash. The
`deleteClinicTreatment`, `deleteDoctorTreatment`, and `deleteDoctorSpecialty` tools delete individual relationship
records without deleting the shared catalog entries.

Admin and Support can use the separately granted `findClinicGroups` permission to find a group before assigning it
when creating a clinic. The existing group access rules also apply to MCP.

The local Payload MCP patch makes only the configured generated slug fields optional in the tool schema. Payload still
validates every field and applies its access rules during creation. Remove the patch when the plugin supports this
behavior upstream.

Clinic gallery images can be uploaded with `uploadClinicGalleryImage`, then added with `publishClinicGalleryImage`.
Use `readClinicGallery` with `clinicId` to obtain the current revision and ordered items. To read a gallery image,
call the same tool with both `clinicId` and the item's numeric `mediaId`. The response is a JSON object with `data`
(base64 image bytes) and `mimeType`; the image must still belong to that gallery. `saveClinicGallery` accepts the
current revision and the complete desired item list; a stale revision is rejected. Removing an item returns it to draft.
Image status remains system-managed. `uploadDoctorImage` uploads an image for its doctor, and `updateDoctorImage`
changes its alternative text. `readDoctorImage` returns an authorized doctor image as base64 bytes and a MIME type.
The `clinicMedia` and `doctorMedia` find permissions expose media metadata.
`deleteClinicImage` and `deleteDoctorImage` permanently delete individual images only after references are removed.
Uploads accept base64-encoded image bytes and the configured media size and type limits apply.

## Clinic onboarding

In the API key form, expand **Clinic profiles** and **Onboarding**. Reading, staging and correcting have separate
checkboxes, all off by default. Existing clinic collection grants remain in **Profile care**. Staging and correcting
also require the current clinic management role and the applicable Payload application and clinic permissions.

| Tool | Required onboarding grant | Inputs |
| --- | --- | --- |
| `stageClinicOnboarding` | Stage an application | `requestKey`, `staffMode: "new_account"`, `clinicName`, `clinicWebsite`, `medicalSpecialtyIds`, `contactFirstName`, `contactLastName`, `contactEmail` and `contactRole` |
| `readClinicOnboarding` | Read applications | `applicationId` |
| `correctClinicOnboarding` | Correct an open application | `applicationId` and one or more changed intake fields |

Use a fresh request key for a new intake and reuse it when retrying as the same key owner. The response returns the
same application, clinic and staff IDs after a successful replay. A separate request matching an open or approved
application for the same clinic name and contact email returns a conflict. A new account requires a contact email
that is available for clinic staff. Medical specialties must be main
specialties. The supported contact roles are `Medical Director`, `Clinic Management` and `International Office`.

The response distinguishes the application decision (`decisionStatus`), account setup (`accountSetupStatus`),
Dashboard participation (`participationStatus`) and the clinic's publication state (`publicStatus`). Staging leaves
the application submitted, the clinic unpublished and the first staff account pending without Dashboard access.
The read action includes the intake fields. Correcting the first contact's email updates the application, the
clinic's internal primary contact and the pending account together.

## Configure VS Code (Copilot Chat MCP)

VS Code supports HTTP MCP servers via `.vscode/mcp.json`.

1. Create `.vscode/mcp.json` in this workspace.

2. Add a server definition with an input prompt (recommended so you don’t hardcode keys):

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "findmydoc-mcp-key",
      "description": "findmydoc Payload MCP API key",
      "password": true
    }
  ],
  "servers": {
    "findmydocPayload": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer ${input:findmydoc-mcp-key}"
      }
    }
  }
}
```

3. Restart MCP discovery:
   - Run **MCP: List Servers** and start/restart `findmydocPayload`.
   - If tools look stale, run **MCP: Reset Cached Tools**.

4. Use in chat:
   - Open Copilot Chat.
   - In the tool picker, enable tools from `findmydocPayload`.
   - Example prompts:
     - “List the latest published posts.”
     - “Find clinics in Istanbul.”

## Configure Claude

There are multiple “Claude” clients. The setup differs by transport.

### Claude Code (supports HTTP MCP)

Claude Code supports HTTP/SSE MCP servers configured via `.mcp.json`.

Create a `.mcp.json` at the project root:

```json
{
  "mcpServers": {
    "findmydocPayload": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer ${FINDMYDOC_MCP_API_KEY}"
      }
    }
  }
}
```

Then set the environment variable before launching Claude Code:

```bash
export FINDMYDOC_MCP_API_KEY="<paste key here>"
```

### Claude Desktop (stdio-only) via `mcp-remote`

Claude Desktop launches MCP servers via stdio. Because our Payload MCP server is HTTP, you need a bridge.

Recommended bridge: `mcp-remote` (https://github.com/geelen/mcp-remote)

In Claude Desktop:
1. Open **Settings → Developer → Edit Config**.
2. Add a server entry to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "findmydocPayload": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "http://localhost:3000/api/mcp",
        "--header",
        "Authorization: Bearer ${FINDMYDOC_MCP_API_KEY}"
      ],
      "env": {
        "FINDMYDOC_MCP_API_KEY": "<paste key here>"
      }
    }
  }
}
```

3. Restart Claude Desktop.

Security note:
- This config file is local to your machine (not in git), but it still contains a secret if you paste the key.

## Troubleshooting

### 401 Unauthorized
- Confirm the API key record is enabled in **MCP → API Keys**.
- Confirm you are using `Authorization: Bearer <KEY>`.
- Confirm the key belongs to a Platform Staff user.

### VS Code shows no tools
- Run **MCP: Reset Cached Tools**.
- Restart the server from **MCP: List Servers**.
- Check Output panel logs: **MCP: List Servers → Show Output**.

### Claude Desktop doesn’t connect
- Ensure Node.js 24.x is installed (Claude Desktop executes `npx`).
- Check Claude Desktop logs (path varies by OS).
- Try running the bridge manually in a terminal to validate connectivity.
