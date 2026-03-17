import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "forms" ADD COLUMN "generate_slug" boolean DEFAULT true;
  ALTER TABLE "forms" ADD COLUMN "slug" varchar;
  CREATE UNIQUE INDEX "forms_slug_idx" ON "forms" USING btree ("slug");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX "forms_slug_idx";
  ALTER TABLE "forms" DROP COLUMN "generate_slug";
  ALTER TABLE "forms" DROP COLUMN "slug";`)
}
