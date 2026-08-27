import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_inquiry_messages_content_state" AS ENUM('available', 'hard-deleted');
  CREATE TYPE "public"."enum_inquiry_attachments_content_state" AS ENUM('available', 'hard-deleted');
  ALTER TABLE "inquiry_messages" ADD COLUMN "content_state" "enum_inquiry_messages_content_state" DEFAULT 'available' NOT NULL;
  ALTER TABLE "inquiry_attachments" ADD COLUMN "content_state" "enum_inquiry_attachments_content_state" DEFAULT 'available' NOT NULL;
  CREATE INDEX "inquiry_messages_content_state_idx" ON "inquiry_messages" USING btree ("content_state");
  CREATE INDEX "inquiry_attachments_content_state_idx" ON "inquiry_attachments" USING btree ("content_state");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM "inquiry_messages" WHERE "content_state" = 'hard-deleted')
       OR EXISTS (SELECT 1 FROM "inquiry_attachments" WHERE "content_state" = 'hard-deleted')
       OR (
         to_regclass('public.inquiry_deletion_proofs') IS NOT NULL
         AND EXISTS (SELECT 1 FROM "inquiry_deletion_proofs")
       )
       OR (
         to_regclass('public.inquiry_legal_holds') IS NOT NULL
         AND EXISTS (SELECT 1 FROM "inquiry_legal_holds")
       ) THEN
       RAISE EXCEPTION 'Cannot roll back inquiry content state while retention safeguards exist.';
     END IF;
   END $$;
   DROP INDEX IF EXISTS "inquiry_messages_content_state_idx";
  DROP INDEX IF EXISTS "inquiry_attachments_content_state_idx";
  ALTER TABLE "inquiry_messages" DROP COLUMN IF EXISTS "content_state";
  ALTER TABLE "inquiry_attachments" DROP COLUMN IF EXISTS "content_state";
  DROP TYPE IF EXISTS "public"."enum_inquiry_messages_content_state";
  DROP TYPE IF EXISTS "public"."enum_inquiry_attachments_content_state";`)
}
