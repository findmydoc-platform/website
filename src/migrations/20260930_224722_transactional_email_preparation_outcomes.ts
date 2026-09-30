import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_transactional_email_events_outcome_code" ADD VALUE 'source-unavailable' BEFORE 'preparation-failed';
  ALTER TYPE "public"."enum_transactional_email_events_outcome_code" ADD VALUE 'superseded' BEFORE 'preparation-failed';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "transactional_email_events" ALTER COLUMN "outcome_code" SET DATA TYPE text;
  DROP TYPE "public"."enum_transactional_email_events_outcome_code";
  CREATE TYPE "public"."enum_transactional_email_events_outcome_code" AS ENUM('fake-accepted', 'provider-accepted', 'provider-temporary', 'provider-rate-limited', 'provider-ambiguous', 'provider-idempotency-conflict', 'provider-request-in-progress', 'provider-conflict-unknown', 'provider-request-rejected', 'provider-policy-rejected', 'recipient-changed', 'ineligible', 'preparation-failed', 'permanent-failure', 'retryable-failure', 'ambiguous', 'expired', 'command-not-enabled', 'preview-recipient-not-allowed');
  ALTER TABLE "transactional_email_events" ALTER COLUMN "outcome_code" SET DATA TYPE "public"."enum_transactional_email_events_outcome_code" USING "outcome_code"::"public"."enum_transactional_email_events_outcome_code";`)
}
