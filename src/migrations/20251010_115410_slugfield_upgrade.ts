import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages" RENAME COLUMN "slug_lock" TO "generate_slug";
  ALTER TABLE "_pages_v" RENAME COLUMN "version_slug_lock" TO "version_generate_slug";
  ALTER TABLE "posts" RENAME COLUMN "slug_lock" TO "generate_slug";
  ALTER TABLE "_posts_v" RENAME COLUMN "version_slug_lock" TO "version_generate_slug";
  ALTER TABLE "categories" RENAME COLUMN "slug_lock" TO "generate_slug";
  ALTER TABLE "clinics" RENAME COLUMN "slug_lock" TO "generate_slug";
  ALTER TABLE "doctors" RENAME COLUMN "slug_lock" TO "generate_slug";
  ALTER TABLE "tags" RENAME COLUMN "slug_lock" TO "generate_slug";
  DROP INDEX "pages_slug_idx";
  DROP INDEX "posts_slug_idx";
  DROP INDEX "categories_slug_idx";
  DROP INDEX "clinics_slug_idx";
  DROP INDEX "doctors_slug_idx";
  ALTER TABLE "categories" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "clinics" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "doctors" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "tags" ALTER COLUMN "slug" SET NOT NULL;
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE UNIQUE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE UNIQUE INDEX "clinics_slug_idx" ON "clinics" USING btree ("slug");
  CREATE UNIQUE INDEX "doctors_slug_idx" ON "doctors" USING btree ("slug");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages" RENAME COLUMN "generate_slug" TO "slug_lock";
  ALTER TABLE "_pages_v" RENAME COLUMN "version_generate_slug" TO "version_slug_lock";
  ALTER TABLE "posts" RENAME COLUMN "generate_slug" TO "slug_lock";
  ALTER TABLE "_posts_v" RENAME COLUMN "version_generate_slug" TO "version_slug_lock";
  ALTER TABLE "categories" RENAME COLUMN "generate_slug" TO "slug_lock";
  ALTER TABLE "clinics" RENAME COLUMN "generate_slug" TO "slug_lock";
  ALTER TABLE "doctors" RENAME COLUMN "generate_slug" TO "slug_lock";
  ALTER TABLE "tags" RENAME COLUMN "generate_slug" TO "slug_lock";
  DROP INDEX "pages_slug_idx";
  DROP INDEX "posts_slug_idx";
  DROP INDEX "categories_slug_idx";
  DROP INDEX "clinics_slug_idx";
  DROP INDEX "doctors_slug_idx";
  ALTER TABLE "categories" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "clinics" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "doctors" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "tags" ALTER COLUMN "slug" DROP NOT NULL;
  CREATE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");
  CREATE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "clinics_slug_idx" ON "clinics" USING btree ("slug");
  CREATE INDEX "doctors_slug_idx" ON "doctors" USING btree ("slug");`)
}
