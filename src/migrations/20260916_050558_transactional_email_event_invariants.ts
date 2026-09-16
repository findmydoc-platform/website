import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'delivery.delivered' BEFORE 'delivery.suppressed';
  ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'delivery.bounced' BEFORE 'delivery.suppressed';
  ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'delivery.complained' BEFORE 'delivery.suppressed';
  DROP INDEX "transactional_email_events_provider_event_id_idx";
  ALTER TABLE "transactional_email_events" ADD COLUMN "source_occurred_at" timestamp(3) with time zone;
  CREATE UNIQUE INDEX "transactional_email_events_provider_event_id_idx" ON "transactional_email_events" USING btree ("provider_event_id") WHERE "transactional_email_events"."provider_event_id" IS NOT NULL AND "transactional_email_events"."provider_event_id" <> '';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "transactional_email_events" ALTER COLUMN "type" SET DATA TYPE text;
  DROP TYPE "public"."enum_transactional_email_events_type";
  CREATE TYPE "public"."enum_transactional_email_events_type" AS ENUM('command.accepted', 'lease.acquired', 'preparation.completed', 'preparation.failed', 'delivery.attempt-started', 'delivery.retry-scheduled', 'delivery.ambiguous', 'delivery.accepted', 'delivery.suppressed', 'delivery.failed', 'delivery.expired', 'payload.scrubbed');
  ALTER TABLE "transactional_email_events" ALTER COLUMN "type" SET DATA TYPE "public"."enum_transactional_email_events_type" USING "type"::"public"."enum_transactional_email_events_type";
  DROP INDEX "transactional_email_events_provider_event_id_idx";
  CREATE UNIQUE INDEX "transactional_email_events_provider_event_id_idx" ON "transactional_email_events" USING btree ("provider_event_id");
  ALTER TABLE "transactional_email_events" DROP COLUMN "source_occurred_at";`)
}
