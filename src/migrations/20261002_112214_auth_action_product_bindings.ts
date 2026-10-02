import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_auth_actions_callback_destination" ADD VALUE 'clinic-dashboard-auth-callback';
  ALTER TABLE "auth_actions" ADD COLUMN "supabase_subject" varchar;
  ALTER TABLE "auth_actions" ADD COLUMN "subject_bound_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "auth_actions" ALTER COLUMN "callback_destination" SET DATA TYPE text;
  DROP TYPE "public"."enum_auth_actions_callback_destination";
  CREATE TYPE "public"."enum_auth_actions_callback_destination" AS ENUM('website-auth-callback');
  ALTER TABLE "auth_actions" ALTER COLUMN "callback_destination" SET DATA TYPE "public"."enum_auth_actions_callback_destination" USING "callback_destination"::"public"."enum_auth_actions_callback_destination";
  ALTER TABLE "auth_actions" DROP COLUMN "supabase_subject";
  ALTER TABLE "auth_actions" DROP COLUMN "subject_bound_at";`)
}
