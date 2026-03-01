import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    CREATE TYPE "public"."enum_doctors_gender" AS ENUM('female', 'male');
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;
  ALTER TABLE "exports" ALTER COLUMN "format" SET NOT NULL;
  ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "gender" "enum_doctors_gender";
  UPDATE "doctors" SET "gender" = 'male' WHERE "gender" IS NULL;
  ALTER TABLE "doctors" ALTER COLUMN "gender" SET NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "exports" ALTER COLUMN "format" DROP NOT NULL;
  ALTER TABLE "doctors" DROP COLUMN IF EXISTS "gender";
  DO $$ BEGIN
   DROP TYPE "public"."enum_doctors_gender";
  EXCEPTION
   WHEN undefined_object THEN null;
  END $$;`)
}
