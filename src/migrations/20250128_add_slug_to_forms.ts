import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   -- Add slug field to forms table
   ALTER TABLE "forms" ADD COLUMN "slug" varchar;
   
   -- Create index for slug field for fast queries
   CREATE INDEX "forms_slug_idx" ON "forms" USING btree ("slug");
   
   -- Create unique constraint for slug field
   ALTER TABLE "forms" ADD CONSTRAINT "forms_slug_unique" UNIQUE ("slug");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   -- Remove slug field and constraints
   DROP INDEX IF EXISTS "forms_slug_idx";
   ALTER TABLE "forms" DROP CONSTRAINT IF EXISTS "forms_slug_unique";
   ALTER TABLE "forms" DROP COLUMN IF EXISTS "slug";
  `)
}