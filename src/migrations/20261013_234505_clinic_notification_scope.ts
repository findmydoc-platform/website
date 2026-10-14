import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_notification_occurrences" ALTER COLUMN "clinic_id" DROP NOT NULL;
  ALTER TABLE "clinic_notification_occurrences" ADD COLUMN IF NOT EXISTS "clinic_scope_id" varchar;
  UPDATE "clinic_notification_occurrences"
    SET "clinic_scope_id" = "clinic_id"::text
    WHERE "clinic_scope_id" IS NULL AND "clinic_id" IS NOT NULL;
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM "clinic_notification_occurrences" WHERE "clinic_scope_id" IS NULL) THEN
      RAISE EXCEPTION 'Notification clinic scope backfill requires preserved original clinic identities.';
    END IF;
  END $$;
  CREATE INDEX IF NOT EXISTS "clinic_notification_occurrences_clinic_scope_id_idx" ON "clinic_notification_occurrences" USING btree ("clinic_scope_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "clinicScopeId_eventType_sourceOccurrenceKind_sourceOccur_idx" ON "clinic_notification_occurrences" USING btree ("clinic_scope_id","event_type","source_occurrence_kind","source_occurrence_id");`)
}

/** Rollback preserves the expanded storage because a permanently deleted clinic cannot regain its relationship. */
export async function down(_args: MigrateDownArgs): Promise<void> {}
