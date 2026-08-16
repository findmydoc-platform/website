import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_clinic_media_status" AS ENUM('draft', 'published');
  ALTER TABLE "clinic_media" ALTER COLUMN "alt" DROP NOT NULL;
  ALTER TABLE "clinic_media" ADD COLUMN "status" "enum_clinic_media_status" DEFAULT 'draft' NOT NULL;
  ALTER TABLE "clinics_rels" ADD COLUMN "clinic_media_id" integer;
  ALTER TABLE "clinics_rels" ADD CONSTRAINT "clinics_rels_clinic_media_fk" FOREIGN KEY ("clinic_media_id") REFERENCES "public"."clinic_media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "clinic_media_status_idx" ON "clinic_media" USING btree ("status");
  CREATE INDEX "clinic_status_createdAt_idx" ON "clinic_media" USING btree ("clinic_id","status","created_at");
  CREATE INDEX "clinics_rels_clinic_media_id_idx" ON "clinics_rels" USING btree ("clinic_media_id");

  UPDATE "clinic_media"
  SET "status" = 'published'
  FROM "clinics"
  WHERE "clinics"."thumbnail_id" = "clinic_media"."id"
    AND "clinic_media"."clinic_id" = "clinics"."id";

  INSERT INTO "clinics_rels" ("order", "parent_id", "path", "clinic_media_id")
  SELECT 1, "clinics"."id", 'profileGallery', "clinics"."thumbnail_id"
  FROM "clinics"
  WHERE "clinics"."thumbnail_id" IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "clinic_media"
      WHERE "clinic_media"."id" = "clinics"."thumbnail_id"
        AND "clinic_media"."clinic_id" = "clinics"."id"
    )
    AND NOT EXISTS (
      SELECT 1 FROM "clinics_rels"
      WHERE "clinics_rels"."parent_id" = "clinics"."id"
        AND "clinics_rels"."path" = 'profileGallery'
        AND "clinics_rels"."clinic_media_id" = "clinics"."thumbnail_id"
    );`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinics_rels" DROP CONSTRAINT "clinics_rels_clinic_media_fk";
  
  DELETE FROM "clinics_rels" WHERE "path" = 'profileGallery';
  UPDATE "clinic_media" SET "alt" = COALESCE(NULLIF("alt", ''), "filename", 'Clinic image') WHERE "alt" IS NULL;
  DROP INDEX "clinic_media_status_idx";
  DROP INDEX "clinic_status_createdAt_idx";
  DROP INDEX "clinics_rels_clinic_media_id_idx";
  ALTER TABLE "clinic_media" ALTER COLUMN "alt" SET NOT NULL;
  ALTER TABLE "clinic_media" DROP COLUMN "status";
  ALTER TABLE "clinics_rels" DROP COLUMN "clinic_media_id";
  DROP TYPE "public"."enum_clinic_media_status";`)
}
