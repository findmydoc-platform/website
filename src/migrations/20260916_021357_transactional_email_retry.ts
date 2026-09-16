import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'delivery.retry-scheduled' BEFORE 'delivery.accepted';
  ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'delivery.ambiguous' BEFORE 'delivery.accepted';
  ALTER TYPE "public"."enum_transactional_email_events_outcome_code" ADD VALUE 'retryable-failure' BEFORE 'expired';
  ALTER TYPE "public"."enum_transactional_email_events_outcome_code" ADD VALUE 'ambiguous' BEFORE 'expired';
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "delivery_deadline" timestamp(3) with time zone;
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "next_attempt_at" timestamp(3) with time zone;
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "first_ambiguous_at" timestamp(3) with time zone;
  CREATE INDEX "transactional_email_outbox_delivery_deadline_idx" ON "transactional_email_outbox" USING btree ("delivery_deadline");
  CREATE INDEX "transactional_email_outbox_next_attempt_at_idx" ON "transactional_email_outbox" USING btree ("next_attempt_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "transactional_email_events" ALTER COLUMN "type" SET DATA TYPE text;
  DROP TYPE "public"."enum_transactional_email_events_type";
  CREATE TYPE "public"."enum_transactional_email_events_type" AS ENUM('command.accepted', 'lease.acquired', 'preparation.completed', 'preparation.failed', 'delivery.attempt-started', 'delivery.accepted', 'delivery.suppressed', 'delivery.failed', 'delivery.expired', 'payload.scrubbed');
  ALTER TABLE "transactional_email_events" ALTER COLUMN "type" SET DATA TYPE "public"."enum_transactional_email_events_type" USING "type"::"public"."enum_transactional_email_events_type";
  ALTER TABLE "transactional_email_events" ALTER COLUMN "outcome_code" SET DATA TYPE text;
  DROP TYPE "public"."enum_transactional_email_events_outcome_code";
  CREATE TYPE "public"."enum_transactional_email_events_outcome_code" AS ENUM('fake-accepted', 'recipient-changed', 'ineligible', 'preparation-failed', 'permanent-failure', 'expired');
  ALTER TABLE "transactional_email_events" ALTER COLUMN "outcome_code" SET DATA TYPE "public"."enum_transactional_email_events_outcome_code" USING "outcome_code"::"public"."enum_transactional_email_events_outcome_code";
  DROP INDEX "transactional_email_outbox_delivery_deadline_idx";
  DROP INDEX "transactional_email_outbox_next_attempt_at_idx";
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "delivery_deadline";
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "next_attempt_at";
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "first_ambiguous_at";`)
}
