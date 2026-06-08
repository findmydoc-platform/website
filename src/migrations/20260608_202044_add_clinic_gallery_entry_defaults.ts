import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_gallery_entries" ADD COLUMN "stable_id" varchar;
  ALTER TABLE "clinic_gallery_entries" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  CREATE UNIQUE INDEX "clinic_gallery_entries_stable_id_idx" ON "clinic_gallery_entries" USING btree ("stable_id");
  CREATE INDEX "clinic_gallery_entries_deleted_at_idx" ON "clinic_gallery_entries" USING btree ("deleted_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "clinic_gallery_entries_stable_id_idx";
  DROP INDEX "clinic_gallery_entries_deleted_at_idx";
  ALTER TABLE "clinic_gallery_entries" DROP COLUMN "stable_id";
  ALTER TABLE "clinic_gallery_entries" DROP COLUMN "deleted_at";`)
}
