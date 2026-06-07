import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_clinics_internal_primary_contact_role" AS ENUM('Medical Director', 'Clinic Management', 'International Office');
  ALTER TABLE "clinics" ADD COLUMN "internal_primary_contact_first_name" varchar;
  ALTER TABLE "clinics" ADD COLUMN "internal_primary_contact_last_name" varchar;
  ALTER TABLE "clinics" ADD COLUMN "internal_primary_contact_email" varchar;
  ALTER TABLE "clinics" ADD COLUMN "internal_primary_contact_role" "enum_clinics_internal_primary_contact_role";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinics" DROP COLUMN "internal_primary_contact_first_name";
  ALTER TABLE "clinics" DROP COLUMN "internal_primary_contact_last_name";
  ALTER TABLE "clinics" DROP COLUMN "internal_primary_contact_email";
  ALTER TABLE "clinics" DROP COLUMN "internal_primary_contact_role";
  DROP TYPE "public"."enum_clinics_internal_primary_contact_role";`)
}
