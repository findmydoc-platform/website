import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_inquiry_audit_events_event_type" ADD VALUE 'moderation-restricted';
  ALTER TYPE "public"."enum_inquiry_audit_events_event_type" ADD VALUE 'moderation-restored';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$
   BEGIN
     IF EXISTS (
       SELECT 1
       FROM "inquiry_audit_events"
       WHERE "event_type"::text IN ('moderation-restricted', 'moderation-restored')
     ) THEN
       RAISE EXCEPTION 'Cannot remove inquiry moderation audit event types while moderation audit records exist';
     END IF;
   END
   $$;
  ALTER TABLE "inquiry_audit_events" ALTER COLUMN "event_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_inquiry_audit_events_event_type";
  CREATE TYPE "public"."enum_inquiry_audit_events_event_type" AS ENUM('inquiry-created', 'message-sent', 'internal-note-added', 'handling-status-changed', 'closed', 'reopened', 'marked-spam', 'spam-removed', 'attachment-draft-created', 'attachment-finalized', 'attachment-discarded', 'contact-revealed');
  ALTER TABLE "inquiry_audit_events" ALTER COLUMN "event_type" SET DATA TYPE "public"."enum_inquiry_audit_events_event_type" USING "event_type"::"public"."enum_inquiry_audit_events_event_type";`)
}
