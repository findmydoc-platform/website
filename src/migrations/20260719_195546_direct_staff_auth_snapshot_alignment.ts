import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $migration$
    BEGIN
      IF to_regclass('public.basic_users') IS NOT NULL
        OR to_regclass('public.payload_locked_documents_rels_basic_users_id_idx') IS NOT NULL
        OR to_regtype('public.enum_basic_users_user_type') IS NOT NULL
        OR EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'payload_locked_documents_rels'
            AND column_name = 'basic_users_id'
        )
        OR EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'payload_locked_documents_rels_basic_users_fk'
        )
      THEN
        RAISE EXCEPTION 'Direct staff auth snapshot alignment failed: legacy BasicUsers schema artifacts remain after the contract migration';
      END IF;
    END
    $migration$;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    'The direct staff auth snapshot alignment is irreversible because the preceding contract migration removed BasicUsers.',
  )
}
