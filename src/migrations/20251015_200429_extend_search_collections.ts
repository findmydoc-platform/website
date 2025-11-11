import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "search" ADD COLUMN "city_id" integer;
  ALTER TABLE "search" ADD COLUMN "country" varchar;
  ALTER TABLE "search" ADD COLUMN "clinic_id" integer;
  ALTER TABLE "search" ADD COLUMN "min_price" numeric;
  ALTER TABLE "search" ADD COLUMN "max_price" numeric;
  ALTER TABLE "search" ADD COLUMN "treatment_name" varchar;
  ALTER TABLE "search_rels" ADD COLUMN "clinics_id" integer;
  ALTER TABLE "search_rels" ADD COLUMN "treatments_id" integer;
  ALTER TABLE "search_rels" ADD COLUMN "doctors_id" integer;
  ALTER TABLE "search" ADD CONSTRAINT "search_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "search" ADD CONSTRAINT "search_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_clinics_fk" FOREIGN KEY ("clinics_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_treatments_fk" FOREIGN KEY ("treatments_id") REFERENCES "public"."treatments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_doctors_fk" FOREIGN KEY ("doctors_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "search_city_idx" ON "search" USING btree ("city_id");
  CREATE INDEX "search_clinic_idx" ON "search" USING btree ("clinic_id");
  CREATE INDEX "search_rels_clinics_id_idx" ON "search_rels" USING btree ("clinics_id");
  CREATE INDEX "search_rels_treatments_id_idx" ON "search_rels" USING btree ("treatments_id");
  CREATE INDEX "search_rels_doctors_id_idx" ON "search_rels" USING btree ("doctors_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "search" DROP CONSTRAINT "search_city_id_cities_id_fk";
  
  ALTER TABLE "search" DROP CONSTRAINT "search_clinic_id_clinics_id_fk";
  
  ALTER TABLE "search_rels" DROP CONSTRAINT "search_rels_clinics_fk";
  
  ALTER TABLE "search_rels" DROP CONSTRAINT "search_rels_treatments_fk";
  
  ALTER TABLE "search_rels" DROP CONSTRAINT "search_rels_doctors_fk";
  
  DROP INDEX "search_city_idx";
  DROP INDEX "search_clinic_idx";
  DROP INDEX "search_rels_clinics_id_idx";
  DROP INDEX "search_rels_treatments_id_idx";
  DROP INDEX "search_rels_doctors_id_idx";
  ALTER TABLE "search" DROP COLUMN "city_id";
  ALTER TABLE "search" DROP COLUMN "country";
  ALTER TABLE "search" DROP COLUMN "clinic_id";
  ALTER TABLE "search" DROP COLUMN "min_price";
  ALTER TABLE "search" DROP COLUMN "max_price";
  ALTER TABLE "search" DROP COLUMN "treatment_name";
  ALTER TABLE "search_rels" DROP COLUMN "clinics_id";
  ALTER TABLE "search_rels" DROP COLUMN "treatments_id";
  ALTER TABLE "search_rels" DROP COLUMN "doctors_id";`)
}
