import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "user_profile_media" DROP COLUMN IF EXISTS "caption";
    ALTER TABLE "user_profile_media" DROP COLUMN IF EXISTS "alt";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "user_profile_media" ADD COLUMN IF NOT EXISTS "alt" varchar;
    ALTER TABLE "user_profile_media" ADD COLUMN IF NOT EXISTS "caption" jsonb;

    UPDATE "user_profile_media" SET "alt" = 'User profile image' WHERE "alt" IS NULL;
    ALTER TABLE "user_profile_media" ALTER COLUMN "alt" SET NOT NULL;
  `)
}
