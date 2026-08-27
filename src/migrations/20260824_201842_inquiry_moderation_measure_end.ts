import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "inquiry_moderation_cases" ADD COLUMN "measure_ended_at" timestamp(3) with time zone;
  CREATE INDEX "inquiry_moderation_cases_measure_ended_at_idx" ON "inquiry_moderation_cases" USING btree ("measure_ended_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "inquiry_moderation_cases_measure_ended_at_idx";
  ALTER TABLE "inquiry_moderation_cases" DROP COLUMN IF EXISTS "measure_ended_at";`)
}
