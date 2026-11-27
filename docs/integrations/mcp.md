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

In the API key form, expand **Clinic profiles** and **Onboarding**. Reading, staging, correcting and deciding have
separate checkboxes, all off by default. Existing clinic collection grants remain in **Profile care**. Staging,
correcting and deciding require the key owner's current clinic management role and the applicable Payload permissions.

| Tool | Required onboarding grant | Inputs |
| --- | --- | --- |
| `stageClinicOnboarding` | Stage an application | `requestKey`, `clinicName`, `clinicWebsite`, `medicalSpecialtyIds`, `contactRole` and the account selection described below |
| `readClinicOnboarding` | Read applications | `applicationId` |
| `findEligibleClinicOnboardingStaff` | Read applications | Exact `email` of the account to look up |
| `correctClinicOnboarding` | Correct an open application | `applicationId` and one or more changed intake fields, including `clinicStaffId` to replace an existing-account selection |
| `approveClinicOnboarding` | Decide applications | `applicationId` and `applicationRevision` |
| `rejectClinicOnboarding` | Decide applications | `applicationId`, `applicationRevision` and a non-empty `reason` |

Use a fresh request key for a new intake and reuse it when retrying as the same key owner. The response returns the
same application, clinic and staff IDs after a successful replay. A separate request matching an open or approved
application for the same clinic name and contact email returns a conflict. A new account requires a contact email
that is available for clinic staff. Medical specialties must be main
specialties. The supported contact roles are `Medical Director`, `Clinic Management` and `International Office`.

- For `staffMode: "new_account"`, supply `contactFirstName`, `contactLastName` and `contactEmail`. A staff account
  that already uses the email results in a conflict. A rejected application releases its pending account's
  email when the account has no identity, activation, invitation or provisioning evidence. The rejected
  application keeps the original contact and the staff record link.
- For `staffMode: "existing_account"`, supply the selected `clinicStaffId`. The application uses the account's email
  and defaults the contact names to the account's names. Supply `contactLastName` if the account has none. Supplied
  contact names apply to the application and clinic contact. If the first name is missing, add it to the
  open application or select another account before approval.
- The optional lookup normalizes the email and uses the caller's existing staff read access. It returns
  `candidate` with the account ID, email and names if the exact match is eligible, or `candidate: null`. Eligibility
  requires approved status, synchronized identity, activation evidence for that account and identity, and explicit
  unassigned scope with neither a clinic nor a group. Pass the ID explicitly when staging or changing the selection.

The response distinguishes the application decision (`decisionStatus`), account setup (`accountSetupStatus`),
Dashboard participation (`participationStatus`) and the clinic's publication state (`publicStatus`). Staging leaves
the application submitted and the clinic unpublished. The new-account path creates a pending staff account;
the existing-account path records the selected ID and leaves the account unassigned. The read action includes the intake,
`clinicGroupId` and `applicationRevision`. The group ID is `null` for an independent clinic. Review the intake, staff
selection and clinic group before submitting a decision. If the application or clinic group changes, read and review
the new revision.

For a new account, corrections to the first contact update the application, clinic contact and pending account together.
For an existing account, changing the selected ID updates the application and clinic contact. Use the existing staff
workflows to update the selected account.

For a new account, approval saves the Dashboard participation decision before account setup. The first staff member
must complete the existing account activation to use the Dashboard. Rejection records the reason and leaves the pending
account without an identity or invitation.

For an existing account, approval requires current staff assignment authority and checks the selected account's
eligibility again. Approval commits the application decision, participation and local staff assignment together.
The original account retains its login and activation. The response reports `accountSetupStatus: "completed"` and
`invitationStatus: "not_started"`. If the selected account becomes ineligible, approval returns a conflict and the
application stays open. Rejection records the reason and preserves the existing account and its current assignment.

If account setup fails, the same response reports `decisionStatus: "approved"`, `accountSetupStatus: "failed"` and
an `accountSetupErrorCode`. Call `approveClinicOnboarding` again with the same application ID and the latest revision
to resume setup for the same clinic and staff account. The decision tools also report `invitationStatus`. A prepared invitation uses
the existing Auth Action and is eligible for delivery under the current environment policy. Retrying the approval
reuses the existing invitation authorization. Public publication remains a separate Payload Admin action. Onboarding can still record a rejection after
Payload Admin rejects the public clinic profile. While onboarding is open, the linked clinic is protected
from trash and permanent deletion.

### Continue onboarding after MCP is disabled

In Payload Admin, open **Medical Network → Clinic Applications**. A current platform administrator or support user
can review a staged application and select **Approve participation** or enter a reason and select **Reject
participation**. An approved new-account application offers **Retry account setup** or **Check invitation**. Reload
after a conflict and review the saved details again. Admin and MCP use the same decision and assignment checks.

To stop intake, remove **Stage an application** from every affected key or disable the MCP keys. Use the Admin
controls to finish or reject the applications already staged. Keep this release or a maintenance release that
includes those controls while applications still need a decision, account setup, or invitation preparation. Before
rolling back to code that predates the workflow, finish that work and verify the linked records. Retain the additive
migration and application history. Handle prepared invitations and published profiles through their existing
lifecycle controls.

## Clinic profile maintenance

Under **Clinic profiles → Profile care**, enable **Read clinic profiles** or **Edit clinic profiles**.
These options use the existing `clinics.find` and `clinics.update` grants and continue to authorize `findClinics`
and `updateClinics`, respectively. **Create clinic profiles directly** is the existing `clinics.create` grant.

- `readClinicProfile` takes a numeric `clinicId` and returns the profile, including its public publication status.
- `updateClinicProfile` takes `clinicId` and a `profile` object. The accepted fields are `description` (Payload rich text),
  `address` (`country`, `city`, `street`, `houseNumber`, `zipCode`), `contact` (`email`, `phoneNumber`, `website`), and
  `openingHours` (Monday through Sunday). Omitted fields retain their stored values. The tool returns the updated profile.

Staff can edit a profile as soon as the clinic exists. Edits to public profiles use the normal clinic cache invalidation
hooks. Unpublished profiles stay private.

Use `readClinicOnboarding` to read the first contact while an application is submitted. Generic clinic reads and updates
omit `internalPrimaryContact` from their returned records during that time, including when selected explicitly. Existing
authorization still applies to generic filters and sorting. Use onboarding actions for participation decisions and
Payload Admin for public publication, suspension and resumption.

## Post drafts

Open **Blog posts → Posts** in the API key form. **Create** enables both `createPosts`
and `createPostDraft`. **Update** enables `updatePosts`, `updatePostDraft`, and `publishPost`. Existing keys keep
the grants they already have.

- `createPostDraft` takes `{ locale: "de", data: { title, ... } }` and returns a new Post ID.
- `updatePostDraft` takes `{ id, locale: "de" | "en", data }`. Use the same Post ID for both languages.
  Pass the fields to change. The other language's draft and any published version stay available as before.

Use `title`, `slug`, `excerpt`, `content` (Payload Lexical JSON), and `meta.title` or `meta.description` for the
selected language. Assign existing records by numeric ID in `heroImage`, `meta.image`, `categories`, `tags`,
`authors`, or `relatedPosts`. These references are shared across languages and must be readable by the key owner.
The referenced records retain their own access rules.

Both draft tools return `{ id, locale, status: "draft", advisories }` as JSON. The `missing_english` advisory
appears while the English draft has no title.

### Publish a Post by language

`publishPost` takes `{ id, locale: "de" | "en", dryRun?: boolean }` and uses the key owner's Post update access.
Set `dryRun: true` to check the requested language without publishing. The result includes `id`, `locale`,
`status`, and `advisories`. A check returns `ready` when it finds a draft. Either call can return
`missing_draft` or `already_published`. Publishing runs Payload validation on the selected language and
returns `published` on success. A German draft can be published with the `missing_english` advisory.

For a request to publish both languages, check `de` and `en` first. Report any missing draft before publishing.
If the requested drafts are available, call `publishPost` separately for each and report both outcomes, including
any validation or technical error. If one draft is missing, the editor can still explicitly publish the other.

## Editorial image upload

Enable `uploadEditorialImage` under **Blog posts → Images**. This grant is off by default. The key owner needs the
existing `platformContentMedia` create permission. Payload validates the image and records the uploader. The tool
returns `{ "id": 123 }`. Pass that ID as `data.heroImage` when calling `updatePostDraft` with the Post ID and
locale. Uploading a new image skips public cache invalidation. Publishing a Post that references the image refreshes
its public consumers through the existing Post hooks. Editorial media retain public read access.

Send one `tools/call` request with `name` (the filename), `mimeType`, `base64` (the encoded file bytes), and `alt`
(required alternative text). The media policy accepts JPEG, PNG, WebP, AVIF, GIF, and SVG. The file limit for this
MCP tool is 3,100,000 bytes. That leaves room for Base64 expansion and the JSON-RPC fields within the MCP
transport's 4 MiB request limit and Vercel's default 4.5 MB limit. Use a client that can send the file bytes as a
Base64 string. [Vercel request body limit](https://vercel.com/docs/functions/limitations#request-body-size)

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
