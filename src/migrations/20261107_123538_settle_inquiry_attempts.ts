import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "inquiry_preparations" ADD COLUMN "last_attempt_key" varchar;
  ALTER TABLE "inquiry_preparations" ADD COLUMN "last_attempt_settled_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "inquiry_preparations" DROP COLUMN "last_attempt_key";
  ALTER TABLE "inquiry_preparations" DROP COLUMN "last_attempt_settled_at";`)
}
