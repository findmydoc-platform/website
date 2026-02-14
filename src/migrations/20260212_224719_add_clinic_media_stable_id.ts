import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_media" ADD COLUMN "stable_id" varchar;
  CREATE UNIQUE INDEX "clinic_media_stable_id_idx" ON "clinic_media" USING btree ("stable_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "clinic_media_stable_id_idx";
  ALTER TABLE "clinic_media" DROP COLUMN "stable_id";`)
}
