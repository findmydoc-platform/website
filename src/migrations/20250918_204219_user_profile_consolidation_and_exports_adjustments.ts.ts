import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_exports_sort_order" AS ENUM('asc', 'desc');
  ALTER TABLE "platform_staff" DROP CONSTRAINT "platform_staff_profile_image_id_media_id_fk";
  
  DROP INDEX "platform_staff_profile_image_idx";
  ALTER TABLE "basic_users" ALTER COLUMN "supabase_user_id" DROP NOT NULL;
  ALTER TABLE "patients" ALTER COLUMN "supabase_user_id" DROP NOT NULL;
  ALTER TABLE "basic_users" ADD COLUMN "first_name" varchar NOT NULL;
  ALTER TABLE "basic_users" ADD COLUMN "last_name" varchar NOT NULL;
  ALTER TABLE "basic_users" ADD COLUMN "profile_image_id" integer;
  ALTER TABLE "exports" ADD COLUMN "page" numeric DEFAULT 1;
  ALTER TABLE "exports" ADD COLUMN "sort_order" "enum_exports_sort_order";
  ALTER TABLE "basic_users" ADD CONSTRAINT "basic_users_profile_image_id_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "basic_users_profile_image_idx" ON "basic_users" USING btree ("profile_image_id");
  ALTER TABLE "clinic_staff" DROP COLUMN "first_name";
  ALTER TABLE "clinic_staff" DROP COLUMN "last_name";
  ALTER TABLE "clinic_staff" DROP COLUMN "email";
  ALTER TABLE "platform_staff" DROP COLUMN "first_name";
  ALTER TABLE "platform_staff" DROP COLUMN "last_name";
  ALTER TABLE "platform_staff" DROP COLUMN "profile_image_id";
  ALTER TABLE "exports" DROP COLUMN "selection_to_use";
  DROP TYPE "public"."enum_exports_selection_to_use";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_exports_selection_to_use" AS ENUM('currentSelection', 'currentFilters', 'all');
  ALTER TABLE "basic_users" DROP CONSTRAINT "basic_users_profile_image_id_media_id_fk";
  
  DROP INDEX "basic_users_profile_image_idx";
  ALTER TABLE "basic_users" ALTER COLUMN "supabase_user_id" SET NOT NULL;
  ALTER TABLE "patients" ALTER COLUMN "supabase_user_id" SET NOT NULL;
  ALTER TABLE "clinic_staff" ADD COLUMN "first_name" varchar NOT NULL;
  ALTER TABLE "clinic_staff" ADD COLUMN "last_name" varchar NOT NULL;
  ALTER TABLE "clinic_staff" ADD COLUMN "email" varchar;
  ALTER TABLE "platform_staff" ADD COLUMN "first_name" varchar NOT NULL;
  ALTER TABLE "platform_staff" ADD COLUMN "last_name" varchar NOT NULL;
  ALTER TABLE "platform_staff" ADD COLUMN "profile_image_id" integer;
  ALTER TABLE "exports" ADD COLUMN "selection_to_use" "enum_exports_selection_to_use";
  ALTER TABLE "platform_staff" ADD CONSTRAINT "platform_staff_profile_image_id_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "platform_staff_profile_image_idx" ON "platform_staff" USING btree ("profile_image_id");
  ALTER TABLE "basic_users" DROP COLUMN "first_name";
  ALTER TABLE "basic_users" DROP COLUMN "last_name";
  ALTER TABLE "basic_users" DROP COLUMN "profile_image_id";
  ALTER TABLE "exports" DROP COLUMN "page";
  ALTER TABLE "exports" DROP COLUMN "sort_order";
  DROP TYPE "public"."enum_exports_sort_order";`)
}
