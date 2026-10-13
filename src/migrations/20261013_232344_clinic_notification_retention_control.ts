import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_clinic_notification_controls_retention_result" AS ENUM('running', 'success', 'incomplete', 'failure');
  ALTER TABLE "clinic_notification_controls" ADD COLUMN "retention_started_at" timestamp(3) with time zone;
  ALTER TABLE "clinic_notification_controls" ADD COLUMN "retention_completed_at" timestamp(3) with time zone;
  ALTER TABLE "clinic_notification_controls" ADD COLUMN "retention_slot" numeric;
  ALTER TABLE "clinic_notification_controls" ADD COLUMN "retention_lease_token" varchar;
  ALTER TABLE "clinic_notification_controls" ADD COLUMN "retention_lease_expires_at" timestamp(3) with time zone;
  ALTER TABLE "clinic_notification_controls" ADD COLUMN "retention_result" "enum_clinic_notification_controls_retention_result";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_notification_controls" DROP COLUMN "retention_started_at";
  ALTER TABLE "clinic_notification_controls" DROP COLUMN "retention_completed_at";
  ALTER TABLE "clinic_notification_controls" DROP COLUMN "retention_slot";
  ALTER TABLE "clinic_notification_controls" DROP COLUMN "retention_lease_token";
  ALTER TABLE "clinic_notification_controls" DROP COLUMN "retention_lease_expires_at";
  ALTER TABLE "clinic_notification_controls" DROP COLUMN "retention_result";
  DROP TYPE "public"."enum_clinic_notification_controls_retention_result";`)
}
