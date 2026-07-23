import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $migration$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payload_mcp_api_keys'
          AND column_name = 'clinic_gallery_entries_find'
      )
      THEN
        RAISE EXCEPTION 'Clinic gallery MCP snapshot alignment failed: clinic_gallery_entries_find still exists';
      END IF;
    END
    $migration$;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Snapshot-only alignment; the preceding gallery migration owns the schema change.
}
