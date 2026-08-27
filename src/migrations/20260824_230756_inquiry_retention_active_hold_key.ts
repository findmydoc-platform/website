import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "inquiry_legal_holds" ADD COLUMN "active_key" varchar;
  CREATE UNIQUE INDEX "inquiry_legal_holds_active_key_idx" ON "inquiry_legal_holds" USING btree ("active_key");
  CREATE UNIQUE INDEX "inquiry_audit_events_legacy_closed_migrated_idx" ON "inquiry_audit_events" USING btree ("inquiry_id","event_type") WHERE "event_type" = 'legacy-closed-migrated';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM "inquiry_legal_holds")
       OR EXISTS (SELECT 1 FROM "inquiry_deletion_proofs")
       OR EXISTS (SELECT 1 FROM "inquiry_messages" WHERE "content_state" = 'hard-deleted')
       OR EXISTS (SELECT 1 FROM "inquiry_attachments" WHERE "content_state" = 'hard-deleted') THEN
       RAISE EXCEPTION 'Cannot roll back inquiry retention safeguards while protected records exist.';
     END IF;
   END $$;
   DROP INDEX "inquiry_legal_holds_active_key_idx";
  DROP INDEX "inquiry_audit_events_legacy_closed_migrated_idx";
  ALTER TABLE "inquiry_legal_holds" DROP COLUMN "active_key";`)
}
