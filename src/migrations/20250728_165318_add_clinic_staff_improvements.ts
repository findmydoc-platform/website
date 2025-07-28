import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_staff" ALTER COLUMN "user_id" DROP NOT NULL;
  ALTER TABLE "clinic_staff" ALTER COLUMN "email" SET NOT NULL;
  ALTER TABLE "clinic_staff" ADD COLUMN "temp_password" varchar;
  CREATE UNIQUE INDEX "clinic_staff_email_idx" ON "clinic_staff" USING btree ("email");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "clinic_staff_email_idx";
  ALTER TABLE "clinic_staff" ALTER COLUMN "user_id" SET NOT NULL;
  ALTER TABLE "clinic_staff" ALTER COLUMN "email" DROP NOT NULL;
  ALTER TABLE "clinic_staff" DROP COLUMN "temp_password";`)
}
