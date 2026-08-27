import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_inquiry_internal_notes_content_state" AS ENUM('available', 'hard-deleted');
  ALTER TABLE "patient_clinic_inquiries" ALTER COLUMN "full_name" DROP NOT NULL;
  ALTER TABLE "patient_clinic_inquiries" ALTER COLUMN "email" DROP NOT NULL;
  ALTER TABLE "patient_clinic_inquiries" ALTER COLUMN "phone_number" DROP NOT NULL;
  ALTER TABLE "patient_clinic_inquiries" ALTER COLUMN "message" DROP NOT NULL;
  ALTER TABLE "inquiry_conversations" ALTER COLUMN "patient_id" DROP NOT NULL;
  ALTER TABLE "inquiry_conversations" ALTER COLUMN "actor_key" DROP NOT NULL;
  ALTER TABLE "inquiry_messages" ALTER COLUMN "patient_id" DROP NOT NULL;
  ALTER TABLE "inquiry_messages" ALTER COLUMN "actor_key" DROP NOT NULL;
  ALTER TABLE "inquiry_internal_notes" ALTER COLUMN "author_clinic_staff_id" DROP NOT NULL;
  ALTER TABLE "inquiry_internal_notes" ALTER COLUMN "text" DROP NOT NULL;
  ALTER TABLE "inquiry_internal_notes" ALTER COLUMN "actor_key" DROP NOT NULL;
  ALTER TABLE "inquiry_attachments" ALTER COLUMN "patient_id" DROP NOT NULL;
  ALTER TABLE "inquiry_attachments" ALTER COLUMN "actor_key" DROP NOT NULL;
  ALTER TABLE "inquiry_read_positions" ALTER COLUMN "reader_key" DROP NOT NULL;
  ALTER TABLE "inquiry_moderation_cases" ALTER COLUMN "patient_id" DROP NOT NULL;
  ALTER TABLE "inquiry_moderation_cases" ALTER COLUMN "reporter_key" DROP NOT NULL;
  ALTER TABLE "inquiry_moderation_events" ALTER COLUMN "patient_id" DROP NOT NULL;
  ALTER TABLE "inquiry_internal_notes" ADD COLUMN "content_state" "enum_inquiry_internal_notes_content_state" DEFAULT 'available' NOT NULL;
  CREATE INDEX "inquiry_internal_notes_content_state_idx" ON "inquiry_internal_notes" USING btree ("content_state");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$
   BEGIN
     IF EXISTS (
       SELECT 1 FROM "patient_clinic_inquiries"
       WHERE "full_name" IS NULL OR "email" IS NULL OR "phone_number" IS NULL OR "message" IS NULL
     ) OR EXISTS (
       SELECT 1 FROM "inquiry_conversations" WHERE "patient_id" IS NULL OR "actor_key" IS NULL
     ) OR EXISTS (
       SELECT 1 FROM "inquiry_messages" WHERE "patient_id" IS NULL OR "actor_key" IS NULL
     ) OR EXISTS (
       SELECT 1 FROM "inquiry_internal_notes"
       WHERE "author_clinic_staff_id" IS NULL OR "text" IS NULL OR "actor_key" IS NULL
     ) OR EXISTS (
       SELECT 1 FROM "inquiry_attachments" WHERE "patient_id" IS NULL OR "actor_key" IS NULL
     ) OR EXISTS (
       SELECT 1 FROM "inquiry_read_positions" WHERE "reader_key" IS NULL
     ) OR EXISTS (
       SELECT 1 FROM "inquiry_moderation_cases" WHERE "patient_id" IS NULL OR "reporter_key" IS NULL
     ) OR EXISTS (
       SELECT 1 FROM "inquiry_moderation_events" WHERE "patient_id" IS NULL
     ) THEN
       RAISE EXCEPTION 'Cannot roll back inquiry identity deletion after an identity scrub. Restore from a pre-scrub backup or roll forward.';
     END IF;
   END $$;
  DROP INDEX "inquiry_internal_notes_content_state_idx";
  ALTER TABLE "patient_clinic_inquiries" ALTER COLUMN "full_name" SET NOT NULL;
  ALTER TABLE "patient_clinic_inquiries" ALTER COLUMN "email" SET NOT NULL;
  ALTER TABLE "patient_clinic_inquiries" ALTER COLUMN "phone_number" SET NOT NULL;
  ALTER TABLE "patient_clinic_inquiries" ALTER COLUMN "message" SET NOT NULL;
  ALTER TABLE "inquiry_conversations" ALTER COLUMN "patient_id" SET NOT NULL;
  ALTER TABLE "inquiry_conversations" ALTER COLUMN "actor_key" SET NOT NULL;
  ALTER TABLE "inquiry_messages" ALTER COLUMN "patient_id" SET NOT NULL;
  ALTER TABLE "inquiry_messages" ALTER COLUMN "actor_key" SET NOT NULL;
  ALTER TABLE "inquiry_internal_notes" ALTER COLUMN "author_clinic_staff_id" SET NOT NULL;
  ALTER TABLE "inquiry_internal_notes" ALTER COLUMN "text" SET NOT NULL;
  ALTER TABLE "inquiry_internal_notes" ALTER COLUMN "actor_key" SET NOT NULL;
  ALTER TABLE "inquiry_attachments" ALTER COLUMN "patient_id" SET NOT NULL;
  ALTER TABLE "inquiry_attachments" ALTER COLUMN "actor_key" SET NOT NULL;
  ALTER TABLE "inquiry_read_positions" ALTER COLUMN "reader_key" SET NOT NULL;
  ALTER TABLE "inquiry_moderation_cases" ALTER COLUMN "patient_id" SET NOT NULL;
  ALTER TABLE "inquiry_moderation_cases" ALTER COLUMN "reporter_key" SET NOT NULL;
  ALTER TABLE "inquiry_moderation_events" ALTER COLUMN "patient_id" SET NOT NULL;
  ALTER TABLE "inquiry_internal_notes" DROP COLUMN "content_state";
  DROP TYPE "public"."enum_inquiry_internal_notes_content_state";`)
}
