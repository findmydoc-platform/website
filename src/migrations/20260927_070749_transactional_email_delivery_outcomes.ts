import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_transactional_email_events_outcome_code" ADD VALUE 'provider-accepted' BEFORE 'recipient-changed';
  ALTER TYPE "public"."enum_transactional_email_events_outcome_code" ADD VALUE 'provider-temporary' BEFORE 'recipient-changed';
  ALTER TYPE "public"."enum_transactional_email_events_outcome_code" ADD VALUE 'provider-rate-limited' BEFORE 'recipient-changed';
  ALTER TYPE "public"."enum_transactional_email_events_outcome_code" ADD VALUE 'provider-ambiguous' BEFORE 'recipient-changed';
  ALTER TYPE "public"."enum_transactional_email_events_outcome_code" ADD VALUE 'provider-idempotency-conflict' BEFORE 'recipient-changed';
  ALTER TYPE "public"."enum_transactional_email_events_outcome_code" ADD VALUE 'provider-request-in-progress' BEFORE 'recipient-changed';
  ALTER TYPE "public"."enum_transactional_email_events_outcome_code" ADD VALUE 'provider-conflict-unknown' BEFORE 'recipient-changed';
  ALTER TYPE "public"."enum_transactional_email_events_outcome_code" ADD VALUE 'provider-request-rejected' BEFORE 'recipient-changed';
  ALTER TYPE "public"."enum_transactional_email_events_outcome_code" ADD VALUE 'provider-policy-rejected' BEFORE 'recipient-changed';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "transactional_email_events" ALTER COLUMN "outcome_code" SET DATA TYPE text;
  DROP TYPE "public"."enum_transactional_email_events_outcome_code";
  CREATE TYPE "public"."enum_transactional_email_events_outcome_code" AS ENUM('fake-accepted', 'recipient-changed', 'ineligible', 'preparation-failed', 'permanent-failure', 'retryable-failure', 'ambiguous', 'expired', 'command-not-enabled', 'preview-recipient-not-allowed');
  ALTER TABLE "transactional_email_events" ALTER COLUMN "outcome_code" SET DATA TYPE "public"."enum_transactional_email_events_outcome_code" USING "outcome_code"::"public"."enum_transactional_email_events_outcome_code";`)
}
