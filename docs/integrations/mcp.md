````markdown
# MCP (Model Context Protocol)

This repo exposes a Payload MCP server at `POST /api/mcp` using `@payloadcms/plugin-mcp`.

Important notes:
- **Only platform staff can create/manage MCP API keys**.
- **Only platform staff-owned keys can authenticate to MCP**.
- MCP requests authenticate with an **Authorization Bearer token** (not Payload "API-Key" auth).

## Create an MCP API key (Platform Staff only)

1. Log in to the Payload Admin UI with a **Platform Staff** account.
   - Admin UI user records live in the `basicUsers` collection.
   - The user must have `userType = platform`.

2. Go to **MCP → API Keys**.

3. Click **Create New**.

4. Configure the key:
   - **Enable API Key**: on
   - **Label** / **Description**: set something descriptive (for auditing)
   - **Per-collection permissions** (sidebar): enable only what you need
     - In this repo, most collections are `Find`-only.
     - A small curated set is allowed to `Create`/`Update` (configured in [src/plugins/mcp.ts](src/plugins/mcp.ts)).

5. Save.

6. Copy the generated API key value.
   - Treat it like a password. Store it in a password manager.
   - You typically can’t recover the plaintext value later.

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
- Ensure Node.js is installed (Claude Desktop executes `npx`).
- Check Claude Desktop logs (path varies by OS).
- Try running the bridge manually in a terminal to validate connectivity.

````
