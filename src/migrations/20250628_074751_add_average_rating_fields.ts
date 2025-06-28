import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "doctors" RENAME COLUMN "rating" TO "average_rating";
  ALTER TABLE "treatments" ADD COLUMN "average_rating" numeric;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "doctors" RENAME COLUMN "average_rating" TO "rating";
  ALTER TABLE "treatments" DROP COLUMN "average_rating";`)
}
