import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_transactional_email_events_outcome_code" AS ENUM('fake-accepted', 'recipient-changed', 'ineligible', 'preparation-failed', 'permanent-failure', 'expired');
  ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'lease.acquired';
  ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'preparation.completed';
  ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'preparation.failed';
  ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'delivery.attempt-started';
  ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'delivery.accepted';
  ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'delivery.suppressed';
  ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'delivery.failed';
  ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'delivery.expired';
  ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'payload.scrubbed';
  ALTER TABLE "transactional_email_outbox" ALTER COLUMN "command_payload" DROP NOT NULL;
  ALTER TABLE "transactional_email_outbox" ALTER COLUMN "recipient_address" DROP NOT NULL;
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "prepared_subject" varchar;
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "prepared_html" varchar;
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "prepared_text" varchar;
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "prepared_at" timestamp(3) with time zone;
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "lease_token" varchar;
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "lease_expires_at" timestamp(3) with time zone;
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "attempt_count" numeric DEFAULT 0;
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "last_attempt_at" timestamp(3) with time zone;
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "provider_message_id" varchar;
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "provider_accepted_at" timestamp(3) with time zone;
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "terminal_at" timestamp(3) with time zone;
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "scrubbed_at" timestamp(3) with time zone;
  ALTER TABLE "transactional_email_events" ADD COLUMN "attempt_number" numeric;
  ALTER TABLE "transactional_email_events" ADD COLUMN "outcome_code" "enum_transactional_email_events_outcome_code";
  CREATE INDEX "transactional_email_outbox_lease_expires_at_idx" ON "transactional_email_outbox" USING btree ("lease_expires_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "transactional_email_events" ALTER COLUMN "type" SET DATA TYPE text;
  DROP TYPE "public"."enum_transactional_email_events_type";
  CREATE TYPE "public"."enum_transactional_email_events_type" AS ENUM('command.accepted');
  ALTER TABLE "transactional_email_events" ALTER COLUMN "type" SET DATA TYPE "public"."enum_transactional_email_events_type" USING "type"::"public"."enum_transactional_email_events_type";
  DROP INDEX "transactional_email_outbox_lease_expires_at_idx";
  ALTER TABLE "transactional_email_outbox" ALTER COLUMN "command_payload" SET NOT NULL;
  ALTER TABLE "transactional_email_outbox" ALTER COLUMN "recipient_address" SET NOT NULL;
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "prepared_subject";
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "prepared_html";
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "prepared_text";
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "prepared_at";
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "lease_token";
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "lease_expires_at";
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "attempt_count";
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "last_attempt_at";
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "provider_message_id";
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "provider_accepted_at";
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "terminal_at";
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "scrubbed_at";
  ALTER TABLE "transactional_email_events" DROP COLUMN "attempt_number";
  ALTER TABLE "transactional_email_events" DROP COLUMN "outcome_code";
  DROP TYPE "public"."enum_transactional_email_events_outcome_code";`)
}
