import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "clinic_gallery_entries_find";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "clinic_gallery_entries_find" boolean DEFAULT false;`)
}
