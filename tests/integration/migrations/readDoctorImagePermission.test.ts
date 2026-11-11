import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { drizzle, type NodePgClient } from '@payloadcms/db-postgres/drizzle/node-postgres'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { up, down } from '@/migrations/20261109_100853_read_doctor_image_mcp'
import { deriveDatabaseConfig } from '../../../scripts/test-database-harness.mjs'

describe('doctor image MCP permission migration', () => {
  let client: Client
  let db: ReturnType<typeof drizzle>

  beforeEach(async () => {
    const { connectionString } = deriveDatabaseConfig(process.env.DATABASE_URI)
    client = new Client({ connectionString })
    await client.connect()
    db = drizzle(client as unknown as NodePgClient)
    const schema = `doctor_image_permission_${randomUUID().replaceAll('-', '')}`
    await client.query(`BEGIN; CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}";`)
    await client.query(`
      CREATE TABLE payload_mcp_api_keys (
        id integer PRIMARY KEY,
        doctor_media_find boolean,
        payload_mcp_tool_upload_doctor_image boolean
      );
      INSERT INTO payload_mcp_api_keys VALUES (1, true, true), (2, false, false);
    `)
  })

  afterEach(async () => {
    await client?.query('ROLLBACK')
    await client?.end()
  })

  it('keeps existing keys ungranted until an explicit grant and removes only the new permission on rollback', async () => {
    await up({ db } as unknown as Parameters<typeof up>[0])
    expect((await client.query('SELECT * FROM payload_mcp_api_keys ORDER BY id')).rows).toEqual([
      {
        id: 1,
        doctor_media_find: true,
        payload_mcp_tool_upload_doctor_image: true,
        payload_mcp_tool_read_doctor_image: false,
      },
      {
        id: 2,
        doctor_media_find: false,
        payload_mcp_tool_upload_doctor_image: false,
        payload_mcp_tool_read_doctor_image: false,
      },
    ])
    await client.query('UPDATE payload_mcp_api_keys SET payload_mcp_tool_read_doctor_image = true WHERE id = 1')
    expect(
      (await client.query('SELECT payload_mcp_tool_read_doctor_image FROM payload_mcp_api_keys WHERE id = 1')).rows,
    ).toEqual([{ payload_mcp_tool_read_doctor_image: true }])
    await down({ db } as unknown as Parameters<typeof down>[0])
    expect((await client.query('SELECT * FROM payload_mcp_api_keys ORDER BY id')).rows).toEqual([
      { id: 1, doctor_media_find: true, payload_mcp_tool_upload_doctor_image: true },
      { id: 2, doctor_media_find: false, payload_mcp_tool_upload_doctor_image: false },
    ])
  })
})
