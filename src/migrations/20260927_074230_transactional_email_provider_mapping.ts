import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'provider.sent';
  ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'provider.soft-bounced';
  ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'provider.failed';
  ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'provider.suppressed';
  ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'provider.policy-rejected';
  ALTER TYPE "public"."enum_transactional_email_events_type" ADD VALUE 'provider.event-ignored';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "transactional_email_events" ALTER COLUMN "type" SET DATA TYPE text;
  DROP TYPE "public"."enum_transactional_email_events_type";
  CREATE TYPE "public"."enum_transactional_email_events_type" AS ENUM('command.accepted', 'lease.acquired', 'preparation.completed', 'preparation.failed', 'delivery.attempt-started', 'delivery.retry-scheduled', 'delivery.ambiguous', 'delivery.accepted', 'delivery.delivered', 'delivery.bounced', 'delivery.complained', 'delivery.suppressed', 'delivery.failed', 'delivery.expired', 'payload.scrubbed', 'provider.created');
  ALTER TABLE "transactional_email_events" ALTER COLUMN "type" SET DATA TYPE "public"."enum_transactional_email_events_type" USING "type"::"public"."enum_transactional_email_events_type";`)
}
