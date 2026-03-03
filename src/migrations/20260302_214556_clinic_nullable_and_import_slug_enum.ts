import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_imports_collection_slug" AS ENUM('pages', 'posts', 'platformContentMedia', 'clinicMedia', 'doctorMedia', 'userProfileMedia', 'categories', 'basicUsers', 'patients', 'clinicStaff', 'platformStaff', 'clinics', 'doctors', 'accreditation', 'medical-specialties', 'treatments', 'clinictreatments', 'doctortreatments', 'doctorspecialties', 'favoriteclinics', 'reviews', 'countries', 'cities', 'tags');
  ALTER TABLE "clinic_media" ALTER COLUMN "clinic_id" DROP NOT NULL;
  ALTER TABLE "clinic_gallery_media" ALTER COLUMN "clinic_id" DROP NOT NULL;
  ALTER TABLE "clinic_gallery_entries" ALTER COLUMN "clinic_id" DROP NOT NULL;
  ALTER TABLE "doctors" ALTER COLUMN "clinic_id" DROP NOT NULL;
  ALTER TABLE "clinictreatments" ALTER COLUMN "clinic_id" DROP NOT NULL;
  ALTER TABLE "exports" ALTER COLUMN "collection_slug" DROP DEFAULT;
  ALTER TABLE "imports" ALTER COLUMN "collection_slug" DROP DEFAULT;
  ALTER TABLE "imports" ALTER COLUMN "collection_slug" SET DATA TYPE "public"."enum_imports_collection_slug" USING "collection_slug"::"public"."enum_imports_collection_slug";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_media" ALTER COLUMN "clinic_id" SET NOT NULL;
  ALTER TABLE "clinic_gallery_media" ALTER COLUMN "clinic_id" SET NOT NULL;
  ALTER TABLE "clinic_gallery_entries" ALTER COLUMN "clinic_id" SET NOT NULL;
  ALTER TABLE "doctors" ALTER COLUMN "clinic_id" SET NOT NULL;
  ALTER TABLE "clinictreatments" ALTER COLUMN "clinic_id" SET NOT NULL;
  ALTER TABLE "exports" ALTER COLUMN "collection_slug" SET DEFAULT 'pages';
  ALTER TABLE "imports" ALTER COLUMN "collection_slug" SET DATA TYPE varchar;
  ALTER TABLE "imports" ALTER COLUMN "collection_slug" SET DEFAULT 'pages';
  DROP TYPE "public"."enum_imports_collection_slug";`)
}
