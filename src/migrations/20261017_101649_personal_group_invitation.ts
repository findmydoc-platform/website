import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_clinic_staff_account_completion_source" ADD VALUE 'group-initial-password' BEFORE 'legacy-password-login';
  ALTER TABLE "clinic_staff" ADD COLUMN "personal_group_invitation_group_id" varchar;
  ALTER TABLE "clinic_staff" ADD COLUMN "personal_group_invitation_operator_id" varchar;
  ALTER TABLE "clinic_staff" ADD COLUMN "personal_group_invitation_authorized_at" timestamp(3) with time zone;
  ALTER TABLE "clinic_staff" ADD COLUMN "account_completion_principal_id" varchar;
  ALTER TABLE "clinic_staff" ADD COLUMN "account_completion_group_id" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_staff" ALTER COLUMN "account_completion_source" SET DATA TYPE text;
  DROP TYPE "public"."enum_clinic_staff_account_completion_source";
  CREATE TYPE "public"."enum_clinic_staff_account_completion_source" AS ENUM('initial-password', 'legacy-password-login', 'legacy-audit');
  ALTER TABLE "clinic_staff" ALTER COLUMN "account_completion_source" SET DATA TYPE "public"."enum_clinic_staff_account_completion_source" USING "account_completion_source"::"public"."enum_clinic_staff_account_completion_source";
  ALTER TABLE "clinic_staff" DROP COLUMN "personal_group_invitation_group_id";
  ALTER TABLE "clinic_staff" DROP COLUMN "personal_group_invitation_operator_id";
  ALTER TABLE "clinic_staff" DROP COLUMN "personal_group_invitation_authorized_at";
  ALTER TABLE "clinic_staff" DROP COLUMN "account_completion_principal_id";
  ALTER TABLE "clinic_staff" DROP COLUMN "account_completion_group_id";`)
}
